import { PublicApiError } from "@infokit/api-client";
import { useCallback, useEffect, useState } from "react";

/**
 * Three states, no fourth: the reader is either waiting, reading, or told
 * plainly that nothing arrived. "Unreachable" is separated from "the server
 * refused" because the two ask different things of the reader — check your
 * connection, or come back later.
 */
export type PayloadState<Payload> =
  | { status: "loading" }
  | { status: "ready"; payload: Payload }
  | { status: "error"; unreachable: boolean; retryable: boolean };

export interface PayloadRequest<Payload> {
  state: PayloadState<Payload>;
  /** True while a pull-to-refresh runs over content already on screen. */
  refreshing: boolean;
  refresh: () => void;
  retry: () => void;
}

/**
 * Runs one public read and keeps its state. `load` must be stable (wrap it in
 * `useCallback`), because a new function means a new request.
 */
export function usePublicPayload<Payload>(
  load: (signal: AbortSignal) => Promise<Payload>,
): PayloadRequest<Payload> {
  const [state, setState] = useState<PayloadState<Payload>>({
    status: "loading",
  });
  const [refreshing, setRefreshing] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let current = true;

    const run = async () => {
      try {
        const payload = await load(controller.signal);
        if (current) setState({ status: "ready", payload });
      } catch (cause) {
        // A cancelled request is this screen leaving, not a failure to report.
        if (!current || controller.signal.aborted) return;
        const failure = cause instanceof PublicApiError ? cause : null;
        setState({
          status: "error",
          unreachable: failure?.status === 0,
          retryable: failure?.retryable ?? true,
        });
      } finally {
        if (current) setRefreshing(false);
      }
    };
    void run();

    return () => {
      current = false;
      controller.abort();
    };
  }, [load, attempt]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    setAttempt((previous) => previous + 1);
  }, []);

  const retry = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((previous) => previous + 1);
  }, []);

  return { state, refreshing, refresh, retry };
}
