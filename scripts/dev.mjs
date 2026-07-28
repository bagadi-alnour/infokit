#!/usr/bin/env node
/**
 * `pnpm dev`: the web app (site and API) and the Expo dev server together.
 *
 * Not `turbo run dev`. Turbo multiplexes its tasks' output, and Expo prints its
 * QR code and its keyboard shortcuts only while it owns a terminal — run as one
 * of several tasks it silently drops both, which leaves `pnpm dev` with no way
 * to open the app on a phone. So the web server goes to the background and Expo
 * stays in the foreground, holding stdin.
 */
import { spawn } from "node:child_process";

/** Backgrounded, and denied stdin: the foreground process owns the keyboard. */
const web = spawn("pnpm", ["--filter", "@infokit/web", "dev"], {
  stdio: ["ignore", "inherit", "inherit"],
  env: { ...process.env, FORCE_COLOR: process.env.FORCE_COLOR ?? "1" },
});

const mobile = spawn("pnpm", ["--filter", "@infokit/mobile", "dev"], {
  stdio: "inherit",
});

let stopping = false;
function stop(signal) {
  if (stopping) return;
  stopping = true;
  for (const child of [web, mobile]) {
    if (child.exitCode === null) child.kill(signal);
  }
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  // Ctrl-C reaches both already through the process group; this covers a signal
  // sent to this process alone, and keeps one dead half from orphaning the other.
  process.on(signal, () => {
    stop(signal);
  });
}

web.on("exit", (code) => {
  if (!stopping) {
    console.error(`\nThe web dev server exited (${String(code)}).`);
    stop("SIGTERM");
  }
});

mobile.on("exit", (code, signal) => {
  stop("SIGTERM");
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
