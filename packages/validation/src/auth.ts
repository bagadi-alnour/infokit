import { supportedLocales } from "@infokit/shared/i18n";
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

const passwordSchema = z.string().min(12).max(128);

export const passwordSignInSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128),
  locale: localeSchema,
  returnTo: z.string().default("/dashboard"),
});

export const passwordUpdateSchema = z
  .object({
    password: passwordSchema,
    passwordConfirmation: z.string(),
    locale: localeSchema,
  })
  .refine((value) => value.password === value.passwordConfirmation, {
    path: ["passwordConfirmation"],
  });

export const passwordResetSchema = z
  .object({
    token: z.string().min(1).max(255),
    password: passwordSchema,
    passwordConfirmation: z.string(),
    locale: localeSchema,
  })
  .refine((value) => value.password === value.passwordConfirmation, {
    path: ["passwordConfirmation"],
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

/**
 * The number an account enrols for the SMS step-up. People type numbers the
 * way they read them — spaces, dots, brackets — so the separators are stripped
 * before the E.164 shape is required; the country code is not optional, since
 * a national number cannot be dialled from the platform's sender.
 * `auth.user_second_factors` re-checks the same shape in PostgreSQL.
 */
export const secondFactorEnrolmentSchema = z.object({
  phone: z
    .string()
    .trim()
    .transform((value) => value.replace(/[\s().\-–—]/g, ""))
    .refine((value) => /^\+[1-9]\d{7,14}$/.test(value)),
  locale: localeSchema,
  returnTo: z.string().default("/dashboard"),
});

export type MagicLinkRequest = z.infer<typeof magicLinkRequestSchema>;
export type PasswordSignIn = z.infer<typeof passwordSignInSchema>;
export type PasswordUpdate = z.infer<typeof passwordUpdateSchema>;
export type PasswordReset = z.infer<typeof passwordResetSchema>;
export type SmsChallengeRequest = z.infer<typeof smsChallengeRequestSchema>;
export type SmsVerification = z.infer<typeof smsVerificationSchema>;
export type SecondFactorEnrolment = z.infer<typeof secondFactorEnrolmentSchema>;
