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
  MemberAgendaPayload,
  MemberEventPayload,
  MemberSessionPayload,
  PublicActivityDetailPayload,
  PublicActivityListPayload,
  PublicArticleDetailPayload,
  PublicArticleListPayload,
  PublicEventDetailPayload,
  PublicEventListPayload,
  PublicGuideDetailPayload,
  PublicGuideListPayload,
  PublicOrganizationDetailPayload,
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

export interface AgendaRequestOptions extends PublicRequestOptions {
  /** `YYYY-MM`. Moves the calendar's labels, never what may be read. */
  month?: string;
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

/** Query string for the parameters every endpoint here understands. */
function query(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const encoded = search.toString();
  return encoded ? `?${encoded}` : "";
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
  listArticles(
    options?: PublicRequestOptions,
  ): Promise<PublicArticleListPayload>;
  /** Null when nothing is published under this slug. */
  getArticle(
    slug: string,
    options?: PublicRequestOptions,
  ): Promise<PublicArticleDetailPayload | null>;
  listEvents(options?: AgendaRequestOptions): Promise<PublicEventListPayload>;
  /** Null for an id that is not an event open to everyone. */
  getEvent(
    id: string,
    options?: PublicRequestOptions,
  ): Promise<PublicEventDetailPayload | null>;
  listGuides(options?: PublicRequestOptions): Promise<PublicGuideListPayload>;
  /** Null when nothing is published under this slug. */
  getGuide(
    slug: string,
    options?: PublicRequestOptions,
  ): Promise<PublicGuideDetailPayload | null>;
  /** Null unless a verified organisation has published a profile there. */
  getOrganization(
    slug: string,
    options?: PublicRequestOptions,
  ): Promise<PublicOrganizationDetailPayload | null>;
}

export function createPublicClient(options: PublicClientOptions): PublicClient {
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const fetchImpl = options.fetch ?? globalThis.fetch;

  async function request<Payload>(
    path: string,
    { locale, signal, ...rest }: AgendaRequestOptions = {},
  ): Promise<Payload> {
    const url = `${baseUrl}${path}${query({ locale, month: rest.month })}`;
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
    listArticles: (requestOptions) =>
      request<PublicArticleListPayload>("/api/public/articles", requestOptions),
    getArticle: (slug, requestOptions) =>
      requestOptional<PublicArticleDetailPayload>(
        `/api/public/articles/${encodeURIComponent(slug)}`,
        requestOptions,
      ),
    listEvents: (requestOptions) =>
      request<PublicEventListPayload>("/api/public/events", requestOptions),
    getEvent: (id, requestOptions) =>
      requestOptional<PublicEventDetailPayload>(
        `/api/public/events/${encodeURIComponent(id)}`,
        requestOptions,
      ),
    listGuides: (requestOptions) =>
      request<PublicGuideListPayload>("/api/public/guides", requestOptions),
    getGuide: (slug, requestOptions) =>
      requestOptional<PublicGuideDetailPayload>(
        `/api/public/guides/${encodeURIComponent(slug)}`,
        requestOptions,
      ),
    getOrganization: (slug, requestOptions) =>
      requestOptional<PublicOrganizationDetailPayload>(
        `/api/public/organizations/${encodeURIComponent(slug)}`,
        requestOptions,
      ),
  };
}

/**
 * The members' client. It is a separate object from the public one on purpose:
 * every call here carries the session, nothing it returns may be cached, and a
 * 401 means one specific thing — sign in again. Keeping the two apart means a
 * public screen cannot accidentally send a credential, and a member screen
 * cannot accidentally forget one.
 */
export interface MemberClientOptions extends PublicClientOptions {
  /**
   * The headers that carry the session, or null while nobody is signed in.
   *
   * A function of headers rather than a bare token because the caller owns the
   * form: the phone app holds a Better Auth session and sends it as `cookie`
   * (which is what `authClient.getCookie()` returns), while anything speaking
   * `authorization: Bearer …` works just as well — Better Auth's `bearer()`
   * plugin reads both.
   */
  authHeaders: () =>
    Promise<Record<string, string> | null> | Record<string, string> | null;
}

/** The session is gone: expired, revoked, or never there. */
export class MemberSignedOutError extends Error {
  constructor() {
    super("This device is not signed in.");
    this.name = "MemberSignedOutError";
  }
}

export interface MemberClient {
  /** Who is reading this device — or the door's words when nobody is. */
  session(options?: PublicRequestOptions): Promise<MemberSessionPayload>;
  agenda(options?: AgendaRequestOptions): Promise<MemberAgendaPayload>;
  /** Null when this member may not read that event, or it does not exist. */
  event(
    id: string,
    options?: PublicRequestOptions,
  ): Promise<MemberEventPayload | null>;
  /** Ends the session on the server, not only on the phone. */
  signOut(options?: { signal?: AbortSignal }): Promise<void>;
}

export function createMemberClient(options: MemberClientOptions): MemberClient {
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const fetchImpl = options.fetch ?? globalThis.fetch;

  async function call<Payload>(
    path: string,
    {
      method = "GET",
      body,
      signal,
      authenticated = true,
    }: {
      method?: string;
      body?: unknown;
      signal?: AbortSignal;
      authenticated?: boolean;
    } = {},
  ): Promise<Payload> {
    const headers: Record<string, string> = { accept: "application/json" };
    if (authenticated) {
      const auth = await options.authHeaders();
      if (!auth) throw new MemberSignedOutError();
      Object.assign(headers, auth);
    }
    if (body !== undefined) headers["content-type"] = "application/json";

    const url = `${baseUrl}${path}`;
    let response: Response;
    try {
      response = await fetchImpl(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal,
        // The session is in the header this client put there. Letting the
        // runtime attach its own cookie jar as well would mean two possibly
        // different sessions on one request, and no way to tell which answered.
        credentials: "omit",
      });
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") throw cause;
      throw new PublicApiError("The request did not reach the server.", {
        status: 0,
        url,
      });
    }
    // A revoked session is not a failure to retry: it is a sign-in to redo.
    if (response.status === 401) throw new MemberSignedOutError();
    if (response.status === 204) return undefined as Payload;
    if (!response.ok) {
      throw new PublicApiError(
        `The server answered ${String(response.status)}.`,
        { status: response.status, url },
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

  return {
    async session({ locale, signal } = {}) {
      const auth = await options.authHeaders();
      // Signed out is an answer here, so the call goes out either way — with the
      // session when there is one, and plain when there is not.
      const url = `/api/member/session${query({ locale })}`;
      return auth
        ? call<MemberSessionPayload>(url, { signal })
        : call<MemberSessionPayload>(url, { signal, authenticated: false });
    },
    agenda: ({ locale, month, signal } = {}) =>
      call<MemberAgendaPayload>(
        `/api/member/agenda${query({ locale, month })}`,
        { signal },
      ),
    async event(id, { locale, signal } = {}) {
      try {
        return await call<MemberEventPayload>(
          `/api/member/events/${encodeURIComponent(id)}${query({ locale })}`,
          { signal },
        );
      } catch (cause) {
        if (cause instanceof PublicApiError && cause.status === 404)
          return null;
        throw cause;
      }
    },
    async signOut({ signal } = {}) {
      try {
        await call<unknown>("/api/member/session", {
          method: "DELETE",
          signal,
        });
      } catch (cause) {
        // Already signed out is the outcome the caller wanted.
        if (cause instanceof MemberSignedOutError) return;
        throw cause;
      }
    },
  };
}
