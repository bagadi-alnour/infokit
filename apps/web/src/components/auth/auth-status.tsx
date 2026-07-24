import { StatusNotice } from "@calais/ui";

const statuses = {
  login_error: "danger",
  sent: "info",
  invalid: "danger",
  cooldown: "warning",
  rate_limited: "warning",
  send_error: "danger",
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
  return <StatusNotice tone={statuses[code]}>{message}</StatusNotice>;
}
