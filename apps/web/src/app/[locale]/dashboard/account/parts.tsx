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
}: {
  status?: string;
  error?: string;
  savedLabel: string;
  /** Keyed by the action's error code; `invalid` is the fallback. */
  errorLabels: Record<string, string> & { invalid: string };
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
  if (status === "saved") {
    return (
      <Alert>
        <AlertDescription>{savedLabel}</AlertDescription>
      </Alert>
    );
  }
  return null;
}
