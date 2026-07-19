import { z } from "zod";

import { env } from "~/env";

const recipientSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .transform((value) => value.toLowerCase()),
  phone: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{7,14}$/),
});

export type EditorRecipient = z.infer<typeof recipientSchema>;

let recipients: EditorRecipient[] | undefined;

export function editorRecipients(): EditorRecipient[] {
  if (recipients) return recipients;

  if (!env.EDITOR_MFA_RECIPIENTS.trim()) {
    recipients = [];
    return recipients;
  }

  const parsed = env.EDITOR_MFA_RECIPIENTS.split(",").map((entry) => {
    const separator = entry.indexOf("=");
    return recipientSchema.parse({
      email: separator === -1 ? "" : entry.slice(0, separator),
      phone: separator === -1 ? "" : entry.slice(separator + 1),
    });
  });

  if (new Set(parsed.map(({ email }) => email)).size !== parsed.length) {
    throw new Error("EDITOR_MFA_RECIPIENTS contains a duplicate email");
  }

  recipients = parsed;
  return recipients;
}

export function editorRecipient(email: string): EditorRecipient | undefined {
  const normalizedEmail = email.trim().toLowerCase();
  return editorRecipients().find(
    (recipient) => recipient.email === normalizedEmail,
  );
}

export function maskPhone(phone: string): string {
  return `${phone.slice(0, 3)} ••• ••• ${phone.slice(-2)}`;
}
