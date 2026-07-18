CREATE SCHEMA "auth";
--> statement-breakpoint
CREATE SCHEMA "content";
--> statement-breakpoint
CREATE SCHEMA "core";
--> statement-breakpoint
CREATE TYPE "content"."contact_kind" AS ENUM('phone', 'whatsapp', 'email', 'on_site', 'url');--> statement-breakpoint
CREATE TYPE "content"."contact_visibility" AS ENUM('public', 'workspace');--> statement-breakpoint
CREATE TYPE "content"."holiday_behavior" AS ENUM('closed', 'open', 'unchanged');--> statement-breakpoint
CREATE TYPE "content"."location_precision" AS ENUM('exact', 'area_only', 'contact_to_learn');--> statement-breakpoint
CREATE TYPE "core"."organization_status" AS ENUM('draft', 'verified', 'suspended', 'archived');--> statement-breakpoint
CREATE TYPE "content"."schedule_exception_kind" AS ENUM('closure', 'cancellation', 'exceptional_opening', 'uncertain');--> statement-breakpoint
CREATE TYPE "content"."service_manual_status" AS ENUM('normal', 'cancelled', 'uncertain');--> statement-breakpoint
CREATE TYPE "content"."speciality_assignment_state" AS ENUM('requested', 'verified', 'rejected', 'retired');--> statement-breakpoint
CREATE TYPE "core"."text_direction" AS ENUM('ltr', 'rtl');--> statement-breakpoint
CREATE TYPE "content"."translation_method" AS ENUM('human', 'ai', 'ai_then_human_review');--> statement-breakpoint
CREATE TYPE "content"."translation_state" AS ENUM('draft', 'machine_generated', 'needs_review', 'verified', 'rejected');--> statement-breakpoint
CREATE TABLE "auth"."accounts" (
	"user_id" varchar(255) NOT NULL,
	"type" varchar(255) NOT NULL,
	"provider" varchar(255) NOT NULL,
	"provider_account_id" varchar(255) NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" varchar(255),
	"scope" varchar(255),
	"id_token" text,
	"session_state" varchar(255),
	CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "auth"."sessions" (
	"session_token" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"expires" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."users" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" varchar(255),
	"email" varchar(255) NOT NULL,
	"email_verified" timestamp with time zone,
	"image" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "auth"."verification_tokens" (
	"identifier" varchar(255) NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
CREATE TABLE "core"."cities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"timezone" varchar(50) DEFAULT 'Europe/Paris' NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cities_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "core"."city_area_translations" (
	"city_area_id" uuid NOT NULL,
	"language_code" varchar(35) NOT NULL,
	"label" varchar(100) NOT NULL,
	CONSTRAINT "city_area_translations_city_area_id_language_code_pk" PRIMARY KEY("city_area_id","language_code")
);
--> statement-breakpoint
CREATE TABLE "core"."city_areas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" uuid NOT NULL,
	"code" varchar(50) NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"lat" double precision,
	"lng" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."city_translations" (
	"city_id" uuid NOT NULL,
	"language_code" varchar(35) NOT NULL,
	"name" varchar(100) NOT NULL,
	CONSTRAINT "city_translations_city_id_language_code_pk" PRIMARY KEY("city_id","language_code")
);
--> statement-breakpoint
CREATE TABLE "core"."languages" (
	"code" varchar(35) PRIMARY KEY NOT NULL,
	"native_name" varchar(100) NOT NULL,
	"english_name" varchar(100) NOT NULL,
	"french_name" varchar(100) NOT NULL,
	"direction" text_direction DEFAULT 'ltr' NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"fallback_code" varchar(35),
	"public_sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content"."audience_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"icon" varchar(50) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audience_categories_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "content"."audience_category_translations" (
	"audience_category_id" uuid NOT NULL,
	"language_code" varchar(35) NOT NULL,
	"label" varchar(100) NOT NULL,
	"explanation" text,
	"state" "content"."translation_state" DEFAULT 'draft' NOT NULL,
	CONSTRAINT "audience_category_translations_audience_category_id_language_code_pk" PRIMARY KEY("audience_category_id","language_code")
);
--> statement-breakpoint
CREATE TABLE "content"."service_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"icon" varchar(50) NOT NULL,
	"color_token" varchar(50),
	"enabled" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "service_categories_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "content"."service_category_translations" (
	"category_id" uuid NOT NULL,
	"language_code" varchar(35) NOT NULL,
	"label" varchar(100) NOT NULL,
	"description" text,
	CONSTRAINT "service_category_translations_category_id_language_code_pk" PRIMARY KEY("category_id","language_code")
);
--> statement-breakpoint
CREATE TABLE "content"."specialities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"icon" varchar(50) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "specialities_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "content"."speciality_translations" (
	"speciality_id" uuid NOT NULL,
	"language_code" varchar(35) NOT NULL,
	"label" varchar(100) NOT NULL,
	"description" text,
	CONSTRAINT "speciality_translations_speciality_id_language_code_pk" PRIMARY KEY("speciality_id","language_code")
);
--> statement-breakpoint
CREATE TABLE "content"."contact_translations" (
	"contact_id" uuid NOT NULL,
	"language_code" varchar(35) NOT NULL,
	"label" varchar(100) NOT NULL,
	"instructions" text,
	CONSTRAINT "contact_translations_contact_id_language_code_pk" PRIMARY KEY("contact_id","language_code")
);
--> statement-breakpoint
CREATE TABLE "content"."contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"kind" "content"."contact_kind" NOT NULL,
	"value" varchar(255),
	"visibility" "content"."contact_visibility" DEFAULT 'public' NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content"."organization_languages" (
	"organization_id" uuid NOT NULL,
	"language_code" varchar(35) NOT NULL,
	"note" varchar(200),
	CONSTRAINT "organization_languages_organization_id_language_code_pk" PRIMARY KEY("organization_id","language_code")
);
--> statement-breakpoint
CREATE TABLE "content"."organization_profile_translations" (
	"organization_id" uuid NOT NULL,
	"language_code" varchar(35) NOT NULL,
	"purpose" text NOT NULL,
	"accessibility_summary" text,
	"state" "content"."translation_state" DEFAULT 'draft' NOT NULL,
	"method" "content"."translation_method" DEFAULT 'human' NOT NULL,
	CONSTRAINT "organization_profile_translations_organization_id_language_code_pk" PRIMARY KEY("organization_id","language_code")
);
--> statement-breakpoint
CREATE TABLE "content"."organization_profiles" (
	"organization_id" uuid PRIMARY KEY NOT NULL,
	"website" varchar(255),
	"logo_url" text,
	"logo_rights_confirmed" boolean DEFAULT false NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"last_verified_at" timestamp with time zone,
	"review_due_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content"."organization_specialities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"speciality_id" uuid NOT NULL,
	"state" "content"."speciality_assignment_state" DEFAULT 'verified' NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"retired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(100) NOT NULL,
	"legal_name" varchar(200),
	"display_name" varchar(200) NOT NULL,
	"timezone" varchar(50) DEFAULT 'Europe/Paris' NOT NULL,
	"status" "core"."organization_status" DEFAULT 'draft' NOT NULL,
	"publishing_suspended" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "content"."place_translations" (
	"place_id" uuid NOT NULL,
	"language_code" varchar(35) NOT NULL,
	"name" varchar(150) NOT NULL,
	"directions_hint" text,
	"state" "content"."translation_state" DEFAULT 'draft' NOT NULL,
	CONSTRAINT "place_translations_place_id_language_code_pk" PRIMARY KEY("place_id","language_code")
);
--> statement-breakpoint
CREATE TABLE "content"."places" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"city_id" uuid NOT NULL,
	"city_area_id" uuid,
	"address_line" varchar(255),
	"postal_code" varchar(20),
	"lat" double precision,
	"lng" double precision,
	"precision" "content"."location_precision" DEFAULT 'exact' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content"."schedule_exception_translations" (
	"exception_id" uuid NOT NULL,
	"language_code" varchar(35) NOT NULL,
	"public_reason" text NOT NULL,
	"state" "content"."translation_state" DEFAULT 'draft' NOT NULL,
	CONSTRAINT "schedule_exception_translations_exception_id_language_code_pk" PRIMARY KEY("exception_id","language_code")
);
--> statement-breakpoint
CREATE TABLE "content"."schedule_exceptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_id" uuid NOT NULL,
	"date" date NOT NULL,
	"kind" "content"."schedule_exception_kind" NOT NULL,
	"start_time" time,
	"end_time" time,
	"created_by_id" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content"."schedule_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_id" uuid NOT NULL,
	"weekday" smallint NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"ends_next_day" boolean DEFAULT false NOT NULL,
	"valid_from" date,
	"valid_to" date,
	"holiday_behavior" "content"."holiday_behavior" DEFAULT 'closed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schedule_rules_weekday_range" CHECK ("content"."schedule_rules"."weekday" between 1 and 7),
	CONSTRAINT "schedule_rules_time_order" CHECK ("content"."schedule_rules"."ends_next_day" or "content"."schedule_rules"."start_time" < "content"."schedule_rules"."end_time")
);
--> statement-breakpoint
CREATE TABLE "content"."service_audience_translations" (
	"service_id" uuid NOT NULL,
	"language_code" varchar(35) NOT NULL,
	"eligibility_details" text NOT NULL,
	"state" "content"."translation_state" DEFAULT 'draft' NOT NULL,
	CONSTRAINT "service_audience_translations_service_id_language_code_pk" PRIMARY KEY("service_id","language_code")
);
--> statement-breakpoint
CREATE TABLE "content"."service_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content"."service_translations" (
	"service_id" uuid NOT NULL,
	"language_code" varchar(35) NOT NULL,
	"name" varchar(150) NOT NULL,
	"short_description" text,
	"instructions" text,
	"cancellation_note" text,
	"state" "content"."translation_state" DEFAULT 'draft' NOT NULL,
	"method" "content"."translation_method" DEFAULT 'human' NOT NULL,
	CONSTRAINT "service_translations_service_id_language_code_pk" PRIMARY KEY("service_id","language_code")
);
--> statement-breakpoint
CREATE TABLE "content"."services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"place_id" uuid,
	"city_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"audience_category_id" uuid NOT NULL,
	"min_age" smallint,
	"max_age" smallint,
	"manual_status" "content"."service_manual_status" DEFAULT 'normal' NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"last_verified_at" timestamp with time zone,
	"verified_by_id" varchar(255),
	"review_due_at" timestamp with time zone,
	"source_note" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth"."accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."city_area_translations" ADD CONSTRAINT "city_area_translations_city_area_id_city_areas_id_fk" FOREIGN KEY ("city_area_id") REFERENCES "core"."city_areas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."city_area_translations" ADD CONSTRAINT "city_area_translations_language_code_languages_code_fk" FOREIGN KEY ("language_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."city_areas" ADD CONSTRAINT "city_areas_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "core"."cities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."city_translations" ADD CONSTRAINT "city_translations_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "core"."cities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."city_translations" ADD CONSTRAINT "city_translations_language_code_languages_code_fk" FOREIGN KEY ("language_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."languages" ADD CONSTRAINT "languages_fallback_code_languages_code_fk" FOREIGN KEY ("fallback_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."audience_category_translations" ADD CONSTRAINT "audience_category_translations_audience_category_id_audience_categories_id_fk" FOREIGN KEY ("audience_category_id") REFERENCES "content"."audience_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."audience_category_translations" ADD CONSTRAINT "audience_category_translations_language_code_languages_code_fk" FOREIGN KEY ("language_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."service_category_translations" ADD CONSTRAINT "service_category_translations_category_id_service_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "content"."service_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."service_category_translations" ADD CONSTRAINT "service_category_translations_language_code_languages_code_fk" FOREIGN KEY ("language_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."speciality_translations" ADD CONSTRAINT "speciality_translations_speciality_id_specialities_id_fk" FOREIGN KEY ("speciality_id") REFERENCES "content"."specialities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."speciality_translations" ADD CONSTRAINT "speciality_translations_language_code_languages_code_fk" FOREIGN KEY ("language_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."contact_translations" ADD CONSTRAINT "contact_translations_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "content"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."contact_translations" ADD CONSTRAINT "contact_translations_language_code_languages_code_fk" FOREIGN KEY ("language_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."contacts" ADD CONSTRAINT "contacts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."organization_languages" ADD CONSTRAINT "organization_languages_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."organization_languages" ADD CONSTRAINT "organization_languages_language_code_languages_code_fk" FOREIGN KEY ("language_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."organization_profile_translations" ADD CONSTRAINT "organization_profile_translations_organization_id_organization_profiles_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "content"."organization_profiles"("organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."organization_profile_translations" ADD CONSTRAINT "organization_profile_translations_language_code_languages_code_fk" FOREIGN KEY ("language_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."organization_profiles" ADD CONSTRAINT "organization_profiles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."organization_specialities" ADD CONSTRAINT "organization_specialities_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."organization_specialities" ADD CONSTRAINT "organization_specialities_speciality_id_specialities_id_fk" FOREIGN KEY ("speciality_id") REFERENCES "content"."specialities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."place_translations" ADD CONSTRAINT "place_translations_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "content"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."place_translations" ADD CONSTRAINT "place_translations_language_code_languages_code_fk" FOREIGN KEY ("language_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."places" ADD CONSTRAINT "places_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."places" ADD CONSTRAINT "places_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "core"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."places" ADD CONSTRAINT "places_city_area_id_city_areas_id_fk" FOREIGN KEY ("city_area_id") REFERENCES "core"."city_areas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."schedule_exception_translations" ADD CONSTRAINT "schedule_exception_translations_exception_id_schedule_exceptions_id_fk" FOREIGN KEY ("exception_id") REFERENCES "content"."schedule_exceptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."schedule_exception_translations" ADD CONSTRAINT "schedule_exception_translations_language_code_languages_code_fk" FOREIGN KEY ("language_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."schedule_exceptions" ADD CONSTRAINT "schedule_exceptions_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "content"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."schedule_exceptions" ADD CONSTRAINT "schedule_exceptions_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."schedule_rules" ADD CONSTRAINT "schedule_rules_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "content"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."service_audience_translations" ADD CONSTRAINT "service_audience_translations_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "content"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."service_audience_translations" ADD CONSTRAINT "service_audience_translations_language_code_languages_code_fk" FOREIGN KEY ("language_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."service_providers" ADD CONSTRAINT "service_providers_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "content"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."service_providers" ADD CONSTRAINT "service_providers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."service_translations" ADD CONSTRAINT "service_translations_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "content"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."service_translations" ADD CONSTRAINT "service_translations_language_code_languages_code_fk" FOREIGN KEY ("language_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."services" ADD CONSTRAINT "services_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."services" ADD CONSTRAINT "services_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "content"."places"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."services" ADD CONSTRAINT "services_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "core"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."services" ADD CONSTRAINT "services_category_id_service_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "content"."service_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."services" ADD CONSTRAINT "services_audience_category_id_audience_categories_id_fk" FOREIGN KEY ("audience_category_id") REFERENCES "content"."audience_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."services" ADD CONSTRAINT "services_verified_by_id_users_id_fk" FOREIGN KEY ("verified_by_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_user_id_idx" ON "auth"."accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "auth"."sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "city_areas_city_code_uq" ON "core"."city_areas" USING btree ("city_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "org_specialities_org_spec_uq" ON "content"."organization_specialities" USING btree ("organization_id","speciality_id");--> statement-breakpoint
CREATE UNIQUE INDEX "org_specialities_one_primary_uq" ON "content"."organization_specialities" USING btree ("organization_id") WHERE "content"."organization_specialities"."is_primary" = true and "content"."organization_specialities"."retired_at" is null;--> statement-breakpoint
CREATE INDEX "places_city_idx" ON "content"."places" USING btree ("city_id");--> statement-breakpoint
CREATE INDEX "schedule_exceptions_service_date_idx" ON "content"."schedule_exceptions" USING btree ("service_id","date");--> statement-breakpoint
CREATE INDEX "schedule_rules_service_idx" ON "content"."schedule_rules" USING btree ("service_id");--> statement-breakpoint
CREATE UNIQUE INDEX "service_providers_service_org_uq" ON "content"."service_providers" USING btree ("service_id","organization_id");--> statement-breakpoint
CREATE INDEX "services_city_idx" ON "content"."services" USING btree ("city_id");--> statement-breakpoint
CREATE INDEX "services_category_idx" ON "content"."services" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "services_published_idx" ON "content"."services" USING btree ("published");