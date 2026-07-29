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
    AUTH_EMAIL_FROM: z.string().default(""),
    /** Optional. Unset means the standard AWS credential chain. */
    AWS_PROFILE: z.string().min(1).optional(),
    /** Explicit keys win over AWS_PROFILE; both must be set to take effect. */
    AWS_ACCESS_KEY_ID: z.string().min(16).optional(),
    AWS_SECRET_ACCESS_KEY: z.string().min(1).optional(),
    AWS_SESSION_TOKEN: z.string().min(1).optional(),
    AWS_REGION: z.string().default("eu-west-3"),
    /**
     * Optional second identity, used by SES and SNS only. Leaving a sending
     * sandbox is per-account and cannot be inherited from an AWS Organization,
     * so assets may live in one account while email and SMS send from another
     * that already has production access. Both must be set to take effect;
     * unset means messaging shares the credentials above, which is how the
     * split ends — delete these variables, change no code.
     */
    AWS_MESSAGING_ACCESS_KEY_ID: z.string().min(16).optional(),
    AWS_MESSAGING_SECRET_ACCESS_KEY: z.string().min(1).optional(),
    /** Defaults to AWS_REGION. Set it only if the sending account differs. */
    AWS_MESSAGING_REGION: z.string().min(1).optional(),
    /** Private object storage for public-content source assets. */
    AWS_S3_ASSET_BUCKET: z.string().min(3).optional(),
    AWS_S3_ENDPOINT: z.string().url().optional(),
    AWS_S3_FORCE_PATH_STYLE: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    AWS_SNS_SENDER_ID: z
      .string()
      .regex(/^[A-Za-z0-9]{1,11}$/)
      .optional(),
    /** Standard OpenAI key plus the legacy spelling already used locally. */
    OPENAI_API_KEY: z.string().min(1).optional(),
    OPEN_AI_API_KEY: z.string().min(1).optional(),
    AI_TRANSLATION_PROVIDER: z.enum(["openai"]).default("openai"),
    AI_TRANSLATION_MODEL: z.string().min(1).default("gpt-5.6-terra"),
    SITE_URL: z.string().url().default("http://localhost:3030"),
    /** Dev/test only: log magic links + SMS codes to the server console instead of AWS. */
    AUTH_DEV_LOG_DELIVERY: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    /** Phase 3 gate: never enable with real member data before legal/operator approval. */
    ENABLE_PHASE3_MEMBER_ASSIGNMENTS: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    /** The application's own identity: `infokit_app`, which owns nothing. */
    DATABASE_URL: z.string().url(),
    /**
     * The owner, `postgres`. Optional and unused by the running app on purpose —
     * only migrations, seeds and introspection ask for it
     * (`~/server/db/migrator-url`). A deployment that never sets it can still
     * serve; it just cannot migrate itself, which is the correct division.
     */
    DATABASE_URL_MIGRATOR: z.string().url().optional(),
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
    AUTH_EMAIL_FROM: process.env.AUTH_EMAIL_FROM,
    AWS_PROFILE: process.env.AWS_PROFILE,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    AWS_SESSION_TOKEN: process.env.AWS_SESSION_TOKEN,
    AWS_REGION: process.env.AWS_REGION,
    AWS_MESSAGING_ACCESS_KEY_ID: process.env.AWS_MESSAGING_ACCESS_KEY_ID,
    AWS_MESSAGING_SECRET_ACCESS_KEY:
      process.env.AWS_MESSAGING_SECRET_ACCESS_KEY,
    AWS_MESSAGING_REGION: process.env.AWS_MESSAGING_REGION,
    AWS_S3_ASSET_BUCKET: process.env.AWS_S3_ASSET_BUCKET,
    AWS_S3_ENDPOINT: process.env.AWS_S3_ENDPOINT,
    AWS_S3_FORCE_PATH_STYLE: process.env.AWS_S3_FORCE_PATH_STYLE,
    AWS_SNS_SENDER_ID: process.env.AWS_SNS_SENDER_ID,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPEN_AI_API_KEY: process.env.OPEN_AI_API_KEY,
    AI_TRANSLATION_PROVIDER: process.env.AI_TRANSLATION_PROVIDER,
    AI_TRANSLATION_MODEL: process.env.AI_TRANSLATION_MODEL,
    SITE_URL: process.env.SITE_URL,
    AUTH_DEV_LOG_DELIVERY: process.env.AUTH_DEV_LOG_DELIVERY,
    ENABLE_PHASE3_MEMBER_ASSIGNMENTS:
      process.env.ENABLE_PHASE3_MEMBER_ASSIGNMENTS,
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_URL_MIGRATOR: process.env.DATABASE_URL_MIGRATOR,
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
