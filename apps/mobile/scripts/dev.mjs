#!/usr/bin/env node
/**
 * Starts the Expo dev server and prints the QR code that opens the app in
 * Expo Go.
 *
 * Three things have to be true for a phone to open the app, and none of them
 * holds by default when this runs under `pnpm dev`:
 *
 * 1. The dev server must be reachable on the network rather than on the
 *    loopback interface, and the published-content URL baked into the bundle
 *    must name this machine — on a phone, `localhost` is the phone, so a
 *    locally configured URL loads nothing. A URL pointing somewhere real
 *    (staging, production) is left exactly as configured.
 * 2. The port must be free. Asked to reuse a busy one, `expo start` prompts;
 *    with turbo holding the other end of stdout there is nobody to answer, so
 *    it exits and the phone never gets a server at all. We pick a free port
 *    ourselves and tell Expo which one.
 * 3. Something has to print the QR code. Expo draws its own — along with its
 *    keyboard shortcuts — only while it owns a terminal, which is why `pnpm dev`
 *    keeps it in the foreground. Where it does not (a piped log, CI, an editor's
 *    task runner) we draw the QR ourselves rather than leave the phone with no
 *    way in.
 *
 * Pass `--tunnel` when the phone is on a different network; any other
 * arguments are handed to `expo start` untouched.
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { networkInterfaces } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import qrcode from "qrcode-terminal";

const appDir = dirname(dirname(fileURLToPath(import.meta.url)));
const apiUrlName = "EXPO_PUBLIC_INFOKIT_API_URL";
const defaultPort = 8081;

/**
 * The address a phone on the same network can dial. Wi-Fi and Ethernet (`en*`)
 * come first: a VPN, a container bridge or Apple's peer-to-peer links also carry
 * IPv4 addresses, and none of them reaches the phone.
 */
function lanAddress() {
  const candidates = [];
  for (const [name, addresses] of Object.entries(networkInterfaces())) {
    if (/^(utun|bridge|vmnet|tun|tap|awdl|llw)/.test(name)) continue;
    for (const address of addresses ?? []) {
      if (address.family === "IPv4" && !address.internal) {
        candidates.push({ name, address: address.address });
      }
    }
  }
  const preferred = candidates.find((entry) => entry.name.startsWith("en"));
  return (preferred ?? candidates[0])?.address ?? null;
}

/** The shell wins over `.env`, exactly as Expo itself resolves the two. */
function configuredApiUrl() {
  const fromShell = process.env[apiUrlName];
  if (fromShell) return fromShell;
  const envFile = join(appDir, ".env");
  if (!existsSync(envFile)) return null;
  const match = new RegExp(`^${apiUrlName}=(.+)$`, "m").exec(
    readFileSync(envFile, "utf8"),
  );
  return match ? match[1].trim() : null;
}

function portIsFree(port) {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.once("error", () => {
      resolve(false);
    });
    probe.listen(port, "0.0.0.0", () => {
      probe.close(() => {
        resolve(true);
      });
    });
  });
}

/** The first port a second dev server can have to itself. */
async function freePort(from) {
  for (let port = from; port < from + 20; port += 1) {
    if (await portIsFree(port)) return port;
  }
  return from;
}

const delay = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Where Expo tells clients to reach it, once it is answering.
 *
 * The manifest is fetched over loopback and reports the host it was asked on,
 * so it is worth reading only under `--tunnel`, where the public host is
 * absolute and is the one address that cannot be worked out from here.
 * Otherwise this just waits for the server and the caller uses the LAN address.
 */
async function publishedHost(port, tunnelled) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    try {
      // Metro answers this as soon as it can serve anything at all.
      const status = await fetch(`http://127.0.0.1:${port}/status`);
      if (status.ok) {
        if (!tunnelled) return null;
        const response = await fetch(`http://127.0.0.1:${port}/`, {
          headers: {
            "expo-platform": "ios",
            accept: "application/expo+json,application/json",
          },
        });
        const manifest = await response.json();
        const hostUri = manifest?.extra?.expoClient?.hostUri;
        if (typeof hostUri === "string" && hostUri.length > 0) return hostUri;
      }
    } catch {
      // Still booting, or the tunnel is not up yet.
    }
    await delay(750);
  }
  return null;
}

const extraArgs = process.argv.slice(2);
const tunnelled = extraArgs.includes("--tunnel");
const portGiven = extraArgs.some((arg) => arg === "--port" || arg === "-p");
const configured = configuredApiUrl();
const isLocal =
  !configured ||
  /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(configured);
const lan = lanAddress();
const env = { ...process.env };

if (isLocal && lan) {
  const port = configured ? new URL(configured).port || "3030" : "3030";
  env[apiUrlName] = `http://${lan}:${port}`;
  console.log(`Reading published content from ${env[apiUrlName]}`);
} else if (isLocal) {
  console.log(
    "No network address found: the QR code will only open on a simulator running here.",
  );
}

const port = portGiven ? null : await freePort(defaultPort);
if (port !== null && port !== defaultPort) {
  console.log(`Port ${String(defaultPort)} is taken; using ${String(port)}.`);
}

const child = spawn(
  "pnpm",
  [
    "exec",
    "expo",
    "start",
    // Expo Go is the target this script exists for: no native build to install,
    // just the QR code below.
    "--go",
    ...(tunnelled ? [] : ["--host", "lan"]),
    ...(port === null ? [] : ["--port", String(port)]),
    ...extraArgs,
  ],
  { cwd: appDir, env, stdio: "inherit" },
);

child.on("exit", (code, signal) => {
  // Re-raise rather than translate: Ctrl-C has to look like Ctrl-C to turbo.
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});

// Only when Expo will not do it itself, and only once the server answers, so the
// QR lands after Metro's startup noise instead of scrolling away above it.
if (port !== null && !process.stdout.isTTY) {
  const host = await publishedHost(port, tunnelled);
  const url = `exp://${host ?? `${lan ?? "127.0.0.1"}:${String(port)}`}`;
  qrcode.generate(url, { small: true }, (qr) => {
    console.log(`\nOpen the app in Expo Go: ${url}\n`);
    console.log(qr);
    console.log(
      tunnelled
        ? "Scan it with Expo Go (Android) or the Camera app (iOS).\n"
        : "Scan it with Expo Go (Android) or the Camera app (iOS), on this Wi-Fi.\nOn another network: pnpm dev:mobile:tunnel\n",
    );
  });
}
