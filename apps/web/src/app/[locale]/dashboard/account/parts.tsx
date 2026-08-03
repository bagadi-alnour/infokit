import { Alert, AlertDescription } from "~/components/ui/alert";

/**
 * What just happened, in words, above the form it happened to. Every account
 * action returns to its own section with `?status=` or `?error=`, so the page
 * — not the action — owns the sentence the editor reads.
 */
export function AccountStatus({
  status,
  error,
  savedLabel,
  errorLabels,
  statusLabels,
}: {
  status?: string;
  error?: string;
  savedLabel: string;
  /** Keyed by the action's error code; `invalid` is the fallback. */
  errorLabels: Record<string, string> & { invalid: string };
  /**
   * For sections whose actions report more than "saved" — arming a second
   * factor, sending a code, proving a number. Keyed by the action's status code;
   * `saved` still falls back to `savedLabel`, so the pages that only ever save
   * need not pass this at all.
   */
  statusLabels?: Record<string, string>;
}) {
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {errorLabels[error] ?? errorLabels.invalid}
        </AlertDescription>
      </Alert>
    );
  }
  if (status) {
    const message =
      statusLabels?.[status] ?? (status === "saved" ? savedLabel : null);
    if (message) {
      return (
        <Alert>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      );
    }
  }
  return null;
}
