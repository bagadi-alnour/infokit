ALTER TABLE "operations"."coordination_events" ALTER COLUMN "city_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "operations"."coordination_events" ADD COLUMN "is_online" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "operations"."coordination_events" ADD COLUMN "online_url" varchar(500);--> statement-breakpoint
ALTER TABLE "operations"."coordination_events" ADD CONSTRAINT "coordination_events_where_check" CHECK ("operations"."coordination_events"."city_id" is not null or "operations"."coordination_events"."is_online");