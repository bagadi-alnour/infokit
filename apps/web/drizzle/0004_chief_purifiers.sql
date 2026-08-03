CREATE TABLE "auth"."rate_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(255) NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "rate_limits_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "auth"."two_factor" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"failed_verification_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "auth"."device_grants" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "auth"."password_reset_tokens" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "auth"."password_sign_in_attempts" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "auth"."second_factor_challenges" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "auth"."device_grants" CASCADE;--> statement-breakpoint
DROP TABLE "auth"."password_reset_tokens" CASCADE;--> statement-breakpoint
DROP TABLE "auth"."password_sign_in_attempts" CASCADE;--> statement-breakpoint
DROP TABLE "auth"."second_factor_challenges" CASCADE;--> statement-breakpoint
ALTER TABLE "auth"."accounts" DROP CONSTRAINT "accounts_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "auth"."sessions" DROP CONSTRAINT "sessions_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "auth"."accounts" DROP CONSTRAINT "accounts_provider_provider_account_id_pk";--> statement-breakpoint
ALTER TABLE "auth"."verification_tokens" DROP CONSTRAINT "verification_tokens_identifier_token_pk";--> statement-breakpoint
ALTER TABLE "auth"."users" ALTER COLUMN "name" SET DEFAULT '';--> statement-breakpoint
/* Hand-written: a DEFAULT does not backfill rows that already exist, so
   SET NOT NULL below would fail on any account whose name was never set — and
   `name` was nullable until now. Better Auth writes '' for a magic-link sign-up
   with no name, so '' is the value it would have chosen anyway. */
UPDATE "auth"."users" SET "name" = '' WHERE "name" IS NULL;--> statement-breakpoint
ALTER TABLE "auth"."users" ALTER COLUMN "name" SET NOT NULL;--> statement-breakpoint
/* Hand-written: `email_verified` goes from `timestamptz` to Better Auth's
   `boolean`, and PostgreSQL refuses that cast without being told how. A
   timestamp meant "confirmed at this moment", so its presence is the boolean.
   drizzle-kit does not emit USING clauses, so it generated a bare SET DATA TYPE
   that cannot run. */
ALTER TABLE "auth"."users" ALTER COLUMN "email_verified" SET DATA TYPE boolean USING ("email_verified" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "auth"."users" ALTER COLUMN "email_verified" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "auth"."users" ALTER COLUMN "email_verified" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "auth"."accounts" ADD COLUMN "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "auth"."accounts" ADD COLUMN "account_id" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "auth"."accounts" ADD COLUMN "provider_id" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "auth"."accounts" ADD COLUMN "password" text;--> statement-breakpoint
ALTER TABLE "auth"."accounts" ADD COLUMN "access_token_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "auth"."accounts" ADD COLUMN "refresh_token_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "auth"."accounts" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "auth"."accounts" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
/* Hand-written: the old primary key has to go before a new one can be added.
   `sessions.session_token` was declared with an inline PRIMARY KEY, and
   drizzle-kit only emits DROP CONSTRAINT for the *named* composite keys — it did
   so for accounts and verification_tokens above, but missed this one, leaving an
   ADD COLUMN ... PRIMARY KEY that PostgreSQL rejects with "multiple primary keys
   for table are not allowed". Looked up rather than named, because the inline
   form let PostgreSQL choose the name. */
DO $$
DECLARE existing_pk text;
BEGIN
	SELECT conname INTO existing_pk
	FROM pg_constraint
	WHERE conrelid = 'auth.sessions'::regclass AND contype = 'p';
	IF existing_pk IS NOT NULL THEN
		EXECUTE format('ALTER TABLE "auth"."sessions" DROP CONSTRAINT %I', existing_pk);
	END IF;
END $$;--> statement-breakpoint
ALTER TABLE "auth"."sessions" ADD COLUMN "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "auth"."sessions" ADD COLUMN "token" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "auth"."sessions" ADD COLUMN "expires_at" timestamp with time zone NOT NULL;--> statement-breakpoint
ALTER TABLE "auth"."sessions" ADD COLUMN "ip_address" varchar(45);--> statement-breakpoint
ALTER TABLE "auth"."sessions" ADD COLUMN "user_agent" text;--> statement-breakpoint
ALTER TABLE "auth"."sessions" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "auth"."sessions" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "auth"."users" ADD COLUMN "two_factor_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "auth"."users" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "auth"."users" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "auth"."verification_tokens" ADD COLUMN "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "auth"."verification_tokens" ADD COLUMN "value" text NOT NULL;--> statement-breakpoint
ALTER TABLE "auth"."verification_tokens" ADD COLUMN "expires_at" timestamp with time zone NOT NULL;--> statement-breakpoint
ALTER TABLE "auth"."verification_tokens" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "auth"."verification_tokens" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "auth"."two_factor" ADD CONSTRAINT "two_factor_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "two_factor_user_id_idx" ON "auth"."two_factor" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "two_factor_secret_idx" ON "auth"."two_factor" USING btree ("secret");--> statement-breakpoint
ALTER TABLE "auth"."accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "verification_tokens_identifier_idx" ON "auth"."verification_tokens" USING btree ("identifier");--> statement-breakpoint
ALTER TABLE "auth"."accounts" DROP COLUMN "type";--> statement-breakpoint
ALTER TABLE "auth"."accounts" DROP COLUMN "provider";--> statement-breakpoint
ALTER TABLE "auth"."accounts" DROP COLUMN "provider_account_id";--> statement-breakpoint
ALTER TABLE "auth"."accounts" DROP COLUMN "expires_at";--> statement-breakpoint
ALTER TABLE "auth"."accounts" DROP COLUMN "token_type";--> statement-breakpoint
ALTER TABLE "auth"."accounts" DROP COLUMN "session_state";--> statement-breakpoint
ALTER TABLE "auth"."sessions" DROP COLUMN "session_token";--> statement-breakpoint
ALTER TABLE "auth"."sessions" DROP COLUMN "expires";--> statement-breakpoint
ALTER TABLE "auth"."sessions" DROP COLUMN "second_factor_verified_at";--> statement-breakpoint
ALTER TABLE "auth"."users" DROP COLUMN "password_hash";--> statement-breakpoint
ALTER TABLE "auth"."users" DROP COLUMN "password_updated_at";--> statement-breakpoint
ALTER TABLE "auth"."verification_tokens" DROP COLUMN "token";--> statement-breakpoint
ALTER TABLE "auth"."verification_tokens" DROP COLUMN "expires";--> statement-breakpoint
ALTER TABLE "auth"."accounts" ADD CONSTRAINT "accounts_provider_account_uq" UNIQUE("provider_id","account_id");--> statement-breakpoint
ALTER TABLE "auth"."sessions" ADD CONSTRAINT "sessions_token_unique" UNIQUE("token");