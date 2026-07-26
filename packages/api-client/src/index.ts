/**
 * @infokit/api-client — the typed reader for the public endpoints of the web
 * app (`/api/public/*`). Both the native app and any future surface read the
 * platform through this one client, so the request shape, the error shape and
 * the URL rules live in a single place.
 *
 * It stays deliberately small: `fetch` only, no caching, no state, nothing
 * platform-specific. Payloads arrive already localized and formatted, so this
 * client never inspects content — it only resolves relative URLs, which is the
 * one thing a client off-origin has to do.
 */
import type { PublicLocale } from "@infokit/shared/i18n";
import type {
  PublicActivityDetailPayload,
  PublicActivityListPayload,
} from "@infokit/shared/public-content";

export interface PublicClientOptions {
  /** Origin of the web app, e.g. `https://infokit.example` — no trailing path. */
  baseUrl: string;
  /** Injectable for tests and for runtimes with their own fetch. */
  fetch?: typeof globalThis.fetch;
}

export interface PublicRequestOptions {
  locale?: PublicLocale;
  signal?: AbortSignal;
}

/**
 * A request that reached the server and came back unusable. `status` is 0 when
 * the request never completed (offline, DNS, timeout) — the common case on the
 * cheap connections this platform is built for, and the one worth telling the
 * reader about plainly.
 */
export class PublicApiError extends Error {
  readonly status: number;
  readonly url: string;

  constructor(message: string, options: { status: number; url: string }) {
    super(message);
    this.name = "PublicApiError";
    this.status = options.status;
    this.url = options.url;
  }

  /** True when retrying the same request could plausibly succeed. */
  get retryable(): boolean {
    return this.status === 0 || this.status >= 500;
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

/** Server payloads carry site-relative links; an off-origin client needs URLs. */
function absolute(baseUrl: string, path: string): string {
  return path.startsWith("/") ? `${baseUrl}${path}` : path;
}

export interface PublicClient {
  /** Absolute URL for a site-relative link or image from a payload. */
  resolveUrl(path: string): string;
  listActivities(
    options?: PublicRequestOptions,
  ): Promise<PublicActivityListPayload>;
  /** Null when nothing is published under this slug. */
  getActivity(
    slug: string,
    options?: PublicRequestOptions,
  ): Promise<PublicActivityDetailPayload | null>;
}

export function createPublicClient(options: PublicClientOptions): PublicClient {
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const fetchImpl = options.fetch ?? globalThis.fetch;

  async function request<Payload>(
    path: string,
    { locale, signal }: PublicRequestOptions = {},
  ): Promise<Payload> {
    const url = `${baseUrl}${path}${locale ? `?locale=${locale}` : ""}`;
    let response: Response;
    try {
      response = await fetchImpl(url, {
        signal,
        headers: { accept: "application/json" },
      });
    } catch (cause) {
      // An abort is the caller's own decision, not a failure to report.
      if (cause instanceof Error && cause.name === "AbortError") throw cause;
      throw new PublicApiError("The request did not reach the server.", {
        status: 0,
        url,
      });
    }
    if (!response.ok) {
      throw new PublicApiError(
        `The server answered ${String(response.status)}.`,
        {
          status: response.status,
          url,
        },
      );
    }
    try {
      return (await response.json()) as Payload;
    } catch {
      throw new PublicApiError("The server answer was not readable JSON.", {
        status: response.status,
        url,
      });
    }
  }

  /** "Nothing published under this slug" is an answer, not an error. */
  async function requestOptional<Payload>(
    path: string,
    requestOptions?: PublicRequestOptions,
  ): Promise<Payload | null> {
    try {
      return await request<Payload>(path, requestOptions);
    } catch (cause) {
      if (cause instanceof PublicApiError && cause.status === 404) return null;
      throw cause;
    }
  }

  return {
    resolveUrl: (path) => absolute(baseUrl, path),
    listActivities: (requestOptions) =>
      request<PublicActivityListPayload>(
        "/api/public/activities",
        requestOptions,
      ),
    getActivity: (slug, requestOptions) =>
      requestOptional<PublicActivityDetailPayload>(
        `/api/public/activities/${encodeURIComponent(slug)}`,
        requestOptions,
      ),
  };
}
