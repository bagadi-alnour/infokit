import { supportedLocales } from "@calais/shared/i18n";
import { z } from "zod";

export const localeSchema = z.enum(supportedLocales);

export const magicLinkRequestSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .transform((value) => value.toLowerCase()),
  locale: localeSchema,
  returnTo: z.string().default("/dashboard"),
});

export const smsChallengeRequestSchema = z.object({
  locale: localeSchema,
  returnTo: z.string().default("/dashboard"),
});

export const smsVerificationSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/),
  locale: localeSchema,
  returnTo: z.string().default("/dashboard"),
});

export type MagicLinkRequest = z.infer<typeof magicLinkRequestSchema>;
export type SmsChallengeRequest = z.infer<typeof smsChallengeRequestSchema>;
export type SmsVerification = z.infer<typeof smsVerificationSchema>;
