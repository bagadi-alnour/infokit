import { translatedInterfaceLocales } from "@infokit/shared/i18n";
import { z } from "zod";

import { localeSchema } from "./auth";

/**
 * Account settings input contracts (docs/DATABASE-SCHEMA.md §4 and §16).
 * The console posts plain forms, so every field parses from a string and an
 * absent checkbox means false — never "leave unchanged".
 */

export const themePreferenceSchema = z.enum(["system", "light", "dark"]);
export const workspaceDensitySchema = z.enum(["comfortable", "compact"]);
export const signInMethodSchema = z.enum(["magic_link", "password"]);
export const digestFrequencySchema = z.enum(["off", "daily", "weekly"]);
export const clockFormatSchema = z.enum(["h12", "h24"]);
export const landingSectionSchema = z.enum([
  "runbook",
  "activities",
  "articles",
  "simulator",
]);

/** The kinds a person may set channels for, in the order the page lists them. */
export const notificationKindSchema = z.enum([
  "activity_review_due",
  "activity_status_changed",
  "publication_state",
  "translation_assignment",
  "membership_invitation",
  "coordination_event",
  "security_alert",
  "product_update",
]);
export type NotificationKind = z.infer<typeof notificationKindSchema>;

export const notificationChannelSchema = z.enum([
  "email",
  "sms",
  "push",
  "inApp",
]);
export type NotificationChannel = z.infer<typeof notificationChannelSchema>;

/** Only languages the interface is fully translated into may be pinned. */
const interfaceLanguageSchema = z.enum(translatedInterfaceLocales);

/** An unticked checkbox posts nothing at all; a ticked one posts "on". */
const checkboxSchema = z
  .union([z.literal("on"), z.literal("true"), z.literal("false"), z.null()])
  .transform((value) => value === "on" || value === "true");

const timeOfDaySchema = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/);

/** IANA zone identifier, validated against the runtime's own zone table. */
const timeZoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  });

export const accountProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(255),
  locale: localeSchema,
});

export const accountPreferencesSchema = z.object({
  /** Empty string means "follow my browser" — the column goes back to null. */
  preferredLanguageCode: z
    .union([interfaceLanguageSchema, z.literal("")])
    .transform((value) => (value === "" ? null : value)),
  theme: themePreferenceSchema,
  density: workspaceDensitySchema,
  timeZone: timeZoneSchema,
  clockFormat: clockFormatSchema,
  /** ISO weekday: 1 Monday … 7 Sunday, matching `auth.user_settings`. */
  weekStartsOn: z.coerce.number().int().min(1).max(7),
  reducedMotion: checkboxSchema,
  highContrast: checkboxSchema,
  locale: localeSchema,
});

/**
 * Only the preferred way in. Whether a second factor is armed is no longer a
 * preference anybody submits: it is `auth.users.two_factor_enabled`, written by
 * Better Auth when an enrolment is proven, and the enrolment forms are their own
 * actions in `dashboard/account/two-factor-actions.ts`.
 */
export const accountSignInSchema = z.object({
  preferredSignInMethod: signInMethodSchema,
  locale: localeSchema,
});

export const accountNotificationsSchema = z
  .object({
    digest: digestFrequencySchema,
    quietHoursStart: z.union([timeOfDaySchema, z.literal("")]),
    quietHoursEnd: z.union([timeOfDaySchema, z.literal("")]),
    /** `kind:channel` pairs, one per ticked box in the matrix. */
    channels: z.array(z.string().regex(/^[a-z_]+:(email|sms|push|inApp)$/)),
    locale: localeSchema,
  })
  // A window needs both ends: one alone cannot say when quiet time stops.
  .refine(
    (value) => (value.quietHoursStart === "") === (value.quietHoursEnd === ""),
    { path: ["quietHoursEnd"] },
  );

export type AccountProfileInput = z.infer<typeof accountProfileSchema>;
export type AccountPreferencesInput = z.infer<typeof accountPreferencesSchema>;
export type AccountSignInInput = z.infer<typeof accountSignInSchema>;
export type AccountNotificationsInput = z.infer<
  typeof accountNotificationsSchema
>;
