import { Callout } from "~/components/public/primitives";

const statuses = {
  login_error: "danger",
  account_not_found: "danger",
  invalid_credentials: "danger",
  unavailable: "danger",
  sent: "info",
  invalid: "danger",
  cooldown: "warning",
  rate_limited: "warning",
  send_error: "danger",
  phone: "danger",
  /** The second factor locked the account after too many wrong codes. */
  locked: "danger",
  /** An SMS code was asked for on an account that has enrolled no number. */
  no_phone: "warning",
  /** A wrong code during enrolment, as opposed to during a sign-in. */
  invalidCode: "danger",
  reset: "info",
  reset_error: "danger",
} as const satisfies Record<string, "info" | "warning" | "danger">;

export type AuthStatusCode = keyof typeof statuses;

export function AuthStatus({
  status,
  labels,
}: {
  status?: string;
  labels: Partial<Record<AuthStatusCode, string>>;
}) {
  if (!status || !(status in statuses)) return null;
  const code = status as AuthStatusCode;
  const message = labels[code];
  if (!message) return null;
  const tone = statuses[code];
  return (
    <Callout tone={tone} role={tone === "info" ? "status" : "alert"}>
      {message}
    </Callout>
  );
}
