ALTER TABLE "auth"."user_settings" DROP COLUMN "two_factor_enabled";--> statement-breakpoint
ALTER TABLE "auth"."user_settings" DROP COLUMN "two_factor_method";--> statement-breakpoint
ALTER TABLE "auth"."user_settings" DROP COLUMN "two_factor_updated_at";--> statement-breakpoint
DROP TYPE "auth"."second_factor_method";