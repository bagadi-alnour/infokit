import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    AUTH_SECRET: z.string().min(32),
    AUTH_TRUST_HOST: z
      .enum(["true", "false"])
      .default("true")
      .transform((value) => value === "true"),
    /** Comma-separated `email=E.164 phone` pairs; also acts as the allowlist. */
    EDITOR_MFA_RECIPIENTS: z.string().default(""),
    AUTH_EMAIL_FROM: z.string().default(""),
    AWS_PROFILE: z.string().default("ep"),
    AWS_REGION: z.string().default("eu-west-3"),
    AWS_SNS_SENDER_ID: z
      .string()
      .regex(/^[A-Za-z0-9]{1,11}$/)
      .optional(),
    SITE_URL: z.string().url().default("http://localhost:3030"),
    /** Dev/test only: log magic links + SMS codes to the server console instead of AWS. */
    AUTH_DEV_LOG_DELIVERY: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    DATABASE_URL: z.string().url(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    // NEXT_PUBLIC_CLIENTVAR: z.string(),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_TRUST_HOST: process.env.AUTH_TRUST_HOST,
    EDITOR_MFA_RECIPIENTS: process.env.EDITOR_MFA_RECIPIENTS,
    AUTH_EMAIL_FROM: process.env.AUTH_EMAIL_FROM,
    AWS_PROFILE: process.env.AWS_PROFILE,
    AWS_REGION: process.env.AWS_REGION,
    AWS_SNS_SENDER_ID: process.env.AWS_SNS_SENDER_ID,
    SITE_URL: process.env.SITE_URL,
    AUTH_DEV_LOG_DELIVERY: process.env.AUTH_DEV_LOG_DELIVERY,
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
