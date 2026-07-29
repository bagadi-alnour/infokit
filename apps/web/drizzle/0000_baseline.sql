CREATE SCHEMA "audit";
--> statement-breakpoint
CREATE SCHEMA "auth";
--> statement-breakpoint
CREATE SCHEMA "content";
--> statement-breakpoint
CREATE SCHEMA "core";
--> statement-breakpoint
CREATE SCHEMA "notifications";
--> statement-breakpoint
CREATE SCHEMA "operations";
--> statement-breakpoint
CREATE SCHEMA "simulator";
--> statement-breakpoint
CREATE TYPE "content"."activity_actor_scope" AS ENUM('platform', 'organization', 'system');--> statement-breakpoint
CREATE TYPE "content"."activity_claim_state" AS ENUM('pending', 'accepted', 'declined', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "content"."activity_relationship_state" AS ENUM('proposed', 'confirmed', 'rejected', 'retired');--> statement-breakpoint
CREATE TYPE "content"."asset_text_track_kind" AS ENUM('transcript', 'captions', 'subtitles', 'description');--> statement-breakpoint
CREATE TYPE "content"."asset_variant_kind" AS ENUM('thumbnail', 'optimized_image', 'poster', 'low_bandwidth_video', 'low_bandwidth_audio', 'printable_pdf', 'other');--> statement-breakpoint
CREATE TYPE "content"."asset_visibility" AS ENUM('public', 'workspace');--> statement-breakpoint
CREATE TYPE "content"."attribution_role" AS ENUM('factual_owner', 'publisher', 'mentioned');--> statement-breakpoint
CREATE TYPE "audit"."actor_type" AS ENUM('user', 'system', 'provider', 'support', 'translator');--> statement-breakpoint
CREATE TYPE "audit"."audit_outcome" AS ENUM('success', 'failure', 'denied');--> statement-breakpoint
CREATE TYPE "audit"."audit_severity" AS ENUM('info', 'warning', 'critical');--> statement-breakpoint
CREATE TYPE "auth"."clock_format" AS ENUM('h12', 'h24');--> statement-breakpoint
CREATE TYPE "auth"."console_landing_section" AS ENUM('runbook', 'activities', 'articles', 'simulator');--> statement-breakpoint
CREATE TYPE "content"."contact_kind" AS ENUM('phone', 'whatsapp', 'email', 'on_site', 'url');--> statement-breakpoint
CREATE TYPE "content"."contact_visibility" AS ENUM('public', 'workspace');--> statement-breakpoint
CREATE TYPE "operations"."coordination_event_status" AS ENUM('scheduled', 'cancelled');--> statement-breakpoint
CREATE TYPE "operations"."coordination_event_visibility" AS ENUM('organization', 'inter_organization', 'public');--> statement-breakpoint
CREATE TYPE "operations"."coordination_participation_state" AS ENUM('attending', 'interested', 'declined');--> statement-breakpoint
CREATE TYPE "operations"."course_visibility" AS ENUM('organization', 'all_organizations', 'all_organizations_and_translators');--> statement-breakpoint
CREATE TYPE "content"."custodian_kind" AS ENUM('organization', 'platform');--> statement-breakpoint
CREATE TYPE "content"."custody_transfer_state" AS ENUM('pending', 'accepted', 'declined', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "notifications"."delivery_channel" AS ENUM('email', 'sms', 'push', 'in_app');--> statement-breakpoint
CREATE TYPE "notifications"."delivery_status" AS ENUM('queued', 'sent', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "auth"."digest_frequency" AS ENUM('off', 'daily', 'weekly');--> statement-breakpoint
CREATE TYPE "content"."editorial_kind" AS ENUM('article', 'fixed_information', 'basic_information');--> statement-breakpoint
CREATE TYPE "content"."editorial_workflow_state" AS ENUM('draft', 'in_review', 'published', 'unpublished', 'archived');--> statement-breakpoint
CREATE TYPE "simulator"."flow_version_status" AS ENUM('draft', 'published', 'retired');--> statement-breakpoint
CREATE TYPE "content"."holiday_behavior" AS ENUM('closed', 'open', 'unchanged');--> statement-breakpoint
CREATE TYPE "core"."invitation_kind" AS ENUM('association_publisher', 'organization_admin', 'member', 'translator', 'platform_admin');--> statement-breakpoint
CREATE TYPE "content"."location_precision" AS ENUM('exact', 'area_only', 'contact_to_learn');--> statement-breakpoint
CREATE TYPE "content"."malware_scan_state" AS ENUM('pending', 'clean', 'flagged');--> statement-breakpoint
CREATE TYPE "content"."media_kind" AS ENUM('image', 'video', 'audio', 'document', 'other');--> statement-breakpoint
CREATE TYPE "core"."member_status" AS ENUM('invited', 'active', 'inactive', 'offboarded');--> statement-breakpoint
CREATE TYPE "core"."moderation_case_kind" AS ENUM('duplicate', 'impersonation', 'conflict', 'unsafe_content', 'suspension', 'departure');--> statement-breakpoint
CREATE TYPE "core"."moderation_case_status" AS ENUM('open', 'in_review', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "notifications"."notification_endpoint_channel" AS ENUM('email', 'sms', 'push');--> statement-breakpoint
CREATE TYPE "notifications"."notification_kind" AS ENUM('activity_review_due', 'activity_status_changed', 'publication_state', 'translation_assignment', 'membership_invitation', 'coordination_event', 'security_alert', 'product_update');--> statement-breakpoint
CREATE TYPE "content"."occurrence_state" AS ENUM('scheduled', 'cancelled', 'uncertain');--> statement-breakpoint
CREATE TYPE "core"."organization_status" AS ENUM('draft', 'verified', 'suspended', 'archived');--> statement-breakpoint
CREATE TYPE "core"."permission_review_decision" AS ENUM('pending', 'keep', 'revoke');--> statement-breakpoint
CREATE TYPE "core"."permission_review_state" AS ENUM('open', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "operations"."requirement_necessity" AS ENUM('required', 'preferred');--> statement-breakpoint
CREATE TYPE "content"."review_task_status" AS ENUM('open', 'done', 'dismissed');--> statement-breakpoint
CREATE TYPE "content"."schedule_exception_kind" AS ENUM('closure', 'cancellation', 'exceptional_opening', 'uncertain');--> statement-breakpoint
CREATE TYPE "auth"."second_factor_method" AS ENUM('sms', 'totp', 'email');--> statement-breakpoint
CREATE TYPE "content"."service_manual_status" AS ENUM('normal', 'cancelled', 'uncertain');--> statement-breakpoint
CREATE TYPE "auth"."sign_in_method" AS ENUM('magic_link', 'password', 'passkey');--> statement-breakpoint
CREATE TYPE "simulator"."node_kind" AS ENUM('question', 'information', 'result');--> statement-breakpoint
CREATE TYPE "operations"."skill_kind" AS ENUM('skill', 'software', 'driving_permit', 'certification');--> statement-breakpoint
CREATE TYPE "content"."speciality_assignment_state" AS ENUM('requested', 'verified', 'rejected', 'retired');--> statement-breakpoint
CREATE TYPE "content"."speciality_change_action" AS ENUM('add', 'remove', 'reorder', 'set_primary');--> statement-breakpoint
CREATE TYPE "content"."speciality_change_item_decision" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "content"."speciality_change_state" AS ENUM('submitted', 'under_review', 'approved', 'partially_approved', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "auth"."theme_preference" AS ENUM('system', 'light', 'dark');--> statement-breakpoint
CREATE TYPE "operations"."training_record_state" AS ENUM('self_declared', 'awaiting_verification', 'verified', 'rejected', 'expired');--> statement-breakpoint
CREATE TYPE "core"."transit_mode" AS ENUM('bus', 'tram', 'metro', 'train', 'coach', 'ferry', 'bike', 'other');--> statement-breakpoint
CREATE TYPE "content"."translation_assignment_entity" AS ENUM('editorial_entry', 'activity', 'public_event', 'simulator_flow', 'organization_profile', 'place', 'service');--> statement-breakpoint
CREATE TYPE "content"."translation_assignment_state" AS ENUM('requested', 'draft', 'submitted', 'reviewed', 'accepted', 'rejected', 'published');--> statement-breakpoint
CREATE TYPE "content"."translation_impact" AS ENUM('initial', 'none', 'review_required', 'regenerate');--> statement-breakpoint
CREATE TYPE "content"."translation_job_state" AS ENUM('queued', 'submitted', 'succeeded', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "content"."translation_method" AS ENUM('human', 'ai', 'ai_then_human_review');--> statement-breakpoint
CREATE TYPE "content"."translation_review_stage" AS ENUM('none', 'team_requested', 'team_validated', 'platform_requested', 'platform_verified', 'changes_requested');--> statement-breakpoint
CREATE TYPE "core"."translation_state" AS ENUM('draft', 'machine_generated', 'needs_review', 'verified', 'rejected');--> statement-breakpoint
CREATE TYPE "core"."translator_directory_scope" AS ENUM('organization', 'all_organizations');--> statement-breakpoint
CREATE TYPE "core"."translator_status" AS ENUM('invited', 'active', 'inactive', 'suspended');--> statement-breakpoint
CREATE TYPE "core"."verification_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "auth"."workspace_density" AS ENUM('comfortable', 'compact');--> statement-breakpoint
CREATE TYPE "core"."writing_direction" AS ENUM('ltr', 'rtl');--> statement-breakpoint
CREATE TABLE "auth"."accounts" (
	"user_id" uuid NOT NULL,
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
CREATE TABLE "auth"."device_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"code_hash" varchar(64) NOT NULL,
	"second_factor_verified" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "device_grants_code_hash_unique" UNIQUE("code_hash")
);
--> statement-breakpoint
CREATE TABLE "auth"."password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "auth"."password_sign_in_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier_hash" varchar(64) NOT NULL,
	"user_id" uuid,
	"succeeded" boolean NOT NULL,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."second_factor_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_token" varchar(255) NOT NULL,
	"code_hash" varchar(64) NOT NULL,
	"locale" varchar(5) NOT NULL,
	"delivery_state" varchar(16) DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."sessions" (
	"session_token" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	"second_factor_verified_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "auth"."user_second_factors" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"phone" varchar(20) NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_second_factors_phone_e164_ck" CHECK ("auth"."user_second_factors"."phone" ~ '^[+][1-9][0-9]{7,14}$')
);
--> statement-breakpoint
CREATE TABLE "auth"."users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255),
	"email" varchar(255) NOT NULL,
	"email_verified" timestamp with time zone,
	"password_hash" text,
	"password_updated_at" timestamp with time zone,
	"image" varchar(255),
	CONSTRAINT "users_email_normalized_ck" CHECK ("auth"."users"."email" = lower(btrim("auth"."users"."email")))
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
	"direction" "core"."writing_direction" DEFAULT 'ltr' NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"fallback_code" varchar(35),
	"public_sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications"."preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid,
	"kind" "notifications"."notification_kind" NOT NULL,
	"email" boolean DEFAULT true NOT NULL,
	"sms" boolean DEFAULT false NOT NULL,
	"push" boolean DEFAULT false NOT NULL,
	"in_app" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."user_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"preferred_language_code" varchar(35),
	"theme" "auth"."theme_preference" DEFAULT 'system' NOT NULL,
	"density" "auth"."workspace_density" DEFAULT 'comfortable' NOT NULL,
	"reduced_motion" boolean DEFAULT false NOT NULL,
	"high_contrast" boolean DEFAULT false NOT NULL,
	"sidebar_collapsed" boolean DEFAULT false NOT NULL,
	"landing_section" "auth"."console_landing_section" DEFAULT 'runbook' NOT NULL,
	"time_zone" varchar(64) DEFAULT 'Europe/Paris' NOT NULL,
	"clock_format" "auth"."clock_format" DEFAULT 'h24' NOT NULL,
	"week_starts_on" integer DEFAULT 1 NOT NULL,
	"preferred_sign_in_method" "auth"."sign_in_method" DEFAULT 'magic_link' NOT NULL,
	"two_factor_enabled" boolean DEFAULT true NOT NULL,
	"two_factor_method" "auth"."second_factor_method" DEFAULT 'sms' NOT NULL,
	"two_factor_updated_at" timestamp with time zone,
	"digest" "auth"."digest_frequency" DEFAULT 'weekly' NOT NULL,
	"quiet_hours_start" time,
	"quiet_hours_end" time,
	"default_organization_id" uuid,
	"default_city_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_settings_week_start_ck" CHECK ("auth"."user_settings"."week_starts_on" between 1 and 7),
	CONSTRAINT "user_settings_quiet_hours_ck" CHECK (("auth"."user_settings"."quiet_hours_start" is null) = ("auth"."user_settings"."quiet_hours_end" is null))
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
	"state" "core"."translation_state" DEFAULT 'draft' NOT NULL,
	CONSTRAINT "audience_category_translations_pk" PRIMARY KEY("audience_category_id","language_code")
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
CREATE TABLE "core"."tag_translations" (
	"tag_id" uuid NOT NULL,
	"scope_key" text DEFAULT 'platform' NOT NULL,
	"language_code" varchar(35) NOT NULL,
	"label" varchar(120) NOT NULL,
	"description" text,
	CONSTRAINT "tag_translations_tag_id_language_code_pk" PRIMARY KEY("tag_id","language_code")
);
--> statement-breakpoint
CREATE TABLE "core"."tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"scope_key" text GENERATED ALWAYS AS (coalesce(organization_id::text, 'platform')) STORED,
	"namespace" varchar(60) DEFAULT 'topic' NOT NULL,
	"code" varchar(100) NOT NULL,
	"color_token" varchar(60) DEFAULT 'neutral' NOT NULL,
	"visibility" varchar(20) DEFAULT 'public' NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tags_id_scope_key_uq" UNIQUE("id","scope_key")
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
	"goals" text,
	"values" text,
	"accessibility_summary" text,
	"presentation_html" text,
	"presentation_text" text,
	"state" "core"."translation_state" DEFAULT 'draft' NOT NULL,
	"method" "content"."translation_method" DEFAULT 'human' NOT NULL,
	"source_version_id" uuid,
	"content_hash" varchar(64),
	"provider_code" varchar(100),
	"carried_forward_from_source_version_id" uuid,
	"verified_by_id" uuid,
	"verified_at" timestamp with time zone,
	CONSTRAINT "organization_profile_translations_pk" PRIMARY KEY("organization_id","language_code")
);
--> statement-breakpoint
CREATE TABLE "content"."organization_profiles" (
	"organization_id" uuid PRIMARY KEY NOT NULL,
	"website" varchar(255),
	"source_url" text,
	"source_checked_on" date,
	"logo_url" text,
	"logo_rights_confirmed" boolean DEFAULT false NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"narrative_source_language" varchar(35) DEFAULT 'fr' NOT NULL,
	"steward_name" varchar(120),
	"steward_phone" varchar(40),
	"steward_email" varchar(255),
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
	"founded_year" integer,
	"timezone" varchar(50) DEFAULT 'Europe/Paris' NOT NULL,
	"status" "core"."organization_status" DEFAULT 'draft' NOT NULL,
	"publishing_suspended" boolean DEFAULT false NOT NULL,
	"claimed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug"),
	CONSTRAINT "organizations_founded_year_check" CHECK ("core"."organizations"."founded_year" between 1800 and 2100)
);
--> statement-breakpoint
CREATE TABLE "content"."speciality_change_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"speciality_id" uuid NOT NULL,
	"action" "content"."speciality_change_action" NOT NULL,
	"requested_order" integer,
	"decision" "content"."speciality_change_item_decision" DEFAULT 'pending' NOT NULL,
	"decision_note" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "speciality_change_items_order_check" CHECK (("content"."speciality_change_items"."action" = 'reorder' and "content"."speciality_change_items"."requested_order" is not null) or ("content"."speciality_change_items"."action" <> 'reorder' and "content"."speciality_change_items"."requested_order" is null)),
	CONSTRAINT "speciality_change_items_decision_check" CHECK (("content"."speciality_change_items"."decision" = 'pending' and "content"."speciality_change_items"."decided_at" is null) or ("content"."speciality_change_items"."decision" <> 'pending' and "content"."speciality_change_items"."decided_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "content"."speciality_change_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"state" "content"."speciality_change_state" DEFAULT 'submitted' NOT NULL,
	"rationale" text,
	"submitted_by_id" uuid,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_by_id" uuid,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "speciality_change_requests_scope_uq" UNIQUE("id","organization_id"),
	CONSTRAINT "speciality_change_requests_decision_check" CHECK (("content"."speciality_change_requests"."state" in ('approved', 'partially_approved', 'rejected') and "content"."speciality_change_requests"."reviewed_at" is not null and "content"."speciality_change_requests"."reviewed_by_id" is not null) or ("content"."speciality_change_requests"."state" in ('submitted', 'under_review', 'cancelled')))
);
--> statement-breakpoint
CREATE TABLE "content"."place_translations" (
	"place_id" uuid NOT NULL,
	"language_code" varchar(35) NOT NULL,
	"name" varchar(150) NOT NULL,
	"directions_hint" text,
	"state" "core"."translation_state" DEFAULT 'draft' NOT NULL,
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
	"steward_name" varchar(120),
	"steward_phone" varchar(40),
	"steward_email" varchar(255),
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content"."activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(160),
	"organization_id" uuid,
	"city_id" uuid,
	"team_id" uuid,
	"place_id" uuid,
	"category_id" uuid NOT NULL,
	"audience_category_id" uuid NOT NULL,
	"source_language_code" varchar(35) DEFAULT 'fr' NOT NULL,
	"min_age" smallint,
	"max_age" smallint,
	"manual_status" "content"."service_manual_status" DEFAULT 'normal' NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"created_by_id" uuid,
	"created_by_scope" "content"."activity_actor_scope" DEFAULT 'organization' NOT NULL,
	"provisioned_by_platform" boolean DEFAULT false NOT NULL,
	"verified_by_id" uuid,
	"source_note" text,
	"steward_name" varchar(120),
	"steward_phone" varchar(40),
	"steward_email" varchar(255),
	"last_verified_at" timestamp with time zone,
	"review_due_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "activities_slug_unique" UNIQUE("slug"),
	CONSTRAINT "activities_team_requires_organization_check" CHECK ("content"."activities"."team_id" is null or "content"."activities"."organization_id" is not null),
	CONSTRAINT "activities_platform_origin_check" CHECK ("content"."activities"."created_by_scope" <> 'platform' or "content"."activities"."provisioned_by_platform"),
	CONSTRAINT "activities_global_has_no_team_check" CHECK ("content"."activities"."city_id" is not null or "content"."activities"."team_id" is null)
);
--> statement-breakpoint
CREATE TABLE "content"."activity_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"activity_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"role" varchar(50) NOT NULL,
	"language_code" varchar(35),
	"display_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "activity_assets_activity_asset_role_uq" UNIQUE("activity_id","asset_id","role")
);
--> statement-breakpoint
CREATE TABLE "content"."activity_audience_translations" (
	"activity_id" uuid NOT NULL,
	"language_code" varchar(35) NOT NULL,
	"eligibility_details" text NOT NULL,
	"state" "core"."translation_state" DEFAULT 'draft' NOT NULL,
	CONSTRAINT "activity_audience_translations_activity_id_language_code_pk" PRIMARY KEY("activity_id","language_code")
);
--> statement-breakpoint
CREATE TABLE "content"."activity_claim_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"activity_id" uuid NOT NULL,
	"destination_organization_id" uuid NOT NULL,
	"destination_team_id" uuid,
	"previous_organization_id" uuid,
	"previous_team_id" uuid,
	"representative_member_id" uuid,
	"token_hash" varchar(64) NOT NULL,
	"state" "content"."activity_claim_state" DEFAULT 'pending' NOT NULL,
	"requested_by_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"decided_by_id" uuid,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "activity_claim_requests_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "activity_claim_requests_token_hash_check" CHECK ("content"."activity_claim_requests"."token_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "activity_claim_requests_expiry_check" CHECK ("content"."activity_claim_requests"."expires_at" > "content"."activity_claim_requests"."created_at"),
	CONSTRAINT "activity_claim_requests_decision_check" CHECK (("content"."activity_claim_requests"."state" in ('accepted', 'declined') and "content"."activity_claim_requests"."decided_at" is not null and "content"."activity_claim_requests"."decided_by_id" is not null) or ("content"."activity_claim_requests"."state" in ('pending', 'expired', 'cancelled')))
);
--> statement-breakpoint
CREATE TABLE "content"."activity_contacts" (
	"activity_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "activity_contacts_activity_id_contact_id_pk" PRIMARY KEY("activity_id","contact_id")
);
--> statement-breakpoint
CREATE TABLE "content"."activity_creator_organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"activity_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"state" "content"."activity_relationship_state" DEFAULT 'proposed' NOT NULL,
	"proposed_by_id" uuid,
	"confirmed_by_id" uuid,
	"confirmed_at" timestamp with time zone,
	"retired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "activity_creator_organizations_activity_org_uq" UNIQUE("activity_id","organization_id"),
	CONSTRAINT "activity_creator_organizations_state_time_check" CHECK (("content"."activity_creator_organizations"."state" = 'confirmed' and "content"."activity_creator_organizations"."confirmed_at" is not null) or ("content"."activity_creator_organizations"."state" = 'retired' and "content"."activity_creator_organizations"."retired_at" is not null) or "content"."activity_creator_organizations"."state" in ('proposed', 'rejected'))
);
--> statement-breakpoint
CREATE TABLE "content"."activity_custody_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"activity_id" uuid NOT NULL,
	"claim_request_id" uuid,
	"action" varchar(80) NOT NULL,
	"actor_user_id" uuid,
	"actor_scope" "content"."activity_actor_scope" NOT NULL,
	"previous_organization_id" uuid,
	"new_organization_id" uuid,
	"previous_team_id" uuid,
	"new_team_id" uuid,
	"asset_disposition" varchar(50),
	"assignment_disposition" varchar(50),
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "activity_custody_events_actor_check" CHECK ("content"."activity_custody_events"."actor_scope" = 'system' or "content"."activity_custody_events"."actor_user_id" is not null)
);
--> statement-breakpoint
CREATE TABLE "content"."activity_member_assignments" (
	"activity_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"expertise" varchar(160) NOT NULL,
	"visibility" "content"."contact_visibility" DEFAULT 'workspace' NOT NULL,
	"public_display_name" varchar(160),
	"public_expertise" varchar(160),
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "activity_member_assignments_activity_id_member_id_pk" PRIMARY KEY("activity_id","member_id"),
	CONSTRAINT "activity_member_assignments_public_projection_check" CHECK ("content"."activity_member_assignments"."visibility" <> 'public' or ("content"."activity_member_assignments"."public_display_name" is not null and "content"."activity_member_assignments"."public_expertise" is not null))
);
--> statement-breakpoint
CREATE TABLE "content"."activity_occurrence_confirmations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"activity_id" uuid NOT NULL,
	"organization_id" uuid,
	"date" date NOT NULL,
	"confirmed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_by_id" uuid,
	"actor_scope" "content"."activity_actor_scope" NOT NULL,
	CONSTRAINT "activity_occurrence_confirmations_organization_scope_check" CHECK ("content"."activity_occurrence_confirmations"."actor_scope" <> 'organization' or "content"."activity_occurrence_confirmations"."organization_id" is not null),
	CONSTRAINT "activity_occurrence_confirmations_actor_check" CHECK ("content"."activity_occurrence_confirmations"."actor_scope" = 'system' or "content"."activity_occurrence_confirmations"."confirmed_by_id" is not null)
);
--> statement-breakpoint
CREATE TABLE "content"."activity_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"activity_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"state" "content"."activity_relationship_state" DEFAULT 'proposed' NOT NULL,
	"provider_role" varchar(80) DEFAULT 'provider' NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"proposed_by_id" uuid,
	"confirmed_by_id" uuid,
	"confirmed_at" timestamp with time zone,
	"effective_from" date,
	"effective_to" date,
	"retired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "activity_providers_activity_org_uq" UNIQUE("activity_id","organization_id"),
	CONSTRAINT "activity_providers_state_time_check" CHECK (("content"."activity_providers"."state" = 'confirmed' and "content"."activity_providers"."confirmed_at" is not null) or ("content"."activity_providers"."state" = 'retired' and "content"."activity_providers"."retired_at" is not null) or "content"."activity_providers"."state" in ('proposed', 'rejected')),
	CONSTRAINT "activity_providers_effective_dates_check" CHECK ("content"."activity_providers"."effective_to" is null or "content"."activity_providers"."effective_from" is null or "content"."activity_providers"."effective_to" >= "content"."activity_providers"."effective_from")
);
--> statement-breakpoint
CREATE TABLE "content"."activity_publications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"activity_id" uuid NOT NULL,
	"language_code" varchar(35) NOT NULL,
	"source_version_id" uuid NOT NULL,
	"translation_content_hash" varchar(64) NOT NULL,
	"published_by_id" uuid NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"scheduled_for" timestamp with time zone,
	"unpublished_by_id" uuid,
	"unpublished_at" timestamp with time zone,
	CONSTRAINT "activity_publications_content_hash_check" CHECK ("content"."activity_publications"."translation_content_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "activity_publications_schedule_check" CHECK ("content"."activity_publications"."scheduled_for" is null or "content"."activity_publications"."scheduled_for" > "content"."activity_publications"."published_at"),
	CONSTRAINT "activity_publications_unpublish_check" CHECK (("content"."activity_publications"."unpublished_at" is null and "content"."activity_publications"."unpublished_by_id" is null) or ("content"."activity_publications"."unpublished_at" >= "content"."activity_publications"."published_at" and "content"."activity_publications"."unpublished_by_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "content"."activity_services" (
	"activity_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "activity_services_activity_id_service_id_pk" PRIMARY KEY("activity_id","service_id")
);
--> statement-breakpoint
CREATE TABLE "content"."activity_tags" (
	"activity_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "activity_tags_activity_id_tag_id_pk" PRIMARY KEY("activity_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "content"."activity_transit_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"activity_id" uuid NOT NULL,
	"mode" "core"."transit_mode" NOT NULL,
	"line" varchar(40),
	"stop_name" varchar(120),
	"walk_minutes" smallint,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "activity_transit_links_detail_check" CHECK ("content"."activity_transit_links"."line" is not null or "content"."activity_transit_links"."stop_name" is not null),
	CONSTRAINT "activity_transit_links_walk_check" CHECK ("content"."activity_transit_links"."walk_minutes" is null or ("content"."activity_transit_links"."walk_minutes" >= 0 and "content"."activity_transit_links"."walk_minutes" <= 240))
);
--> statement-breakpoint
CREATE TABLE "content"."activity_translations" (
	"activity_id" uuid NOT NULL,
	"language_code" varchar(35) NOT NULL,
	"name" varchar(150) NOT NULL,
	"description_html" text,
	"description_text" text,
	"short_description" text,
	"instructions" text,
	"cancellation_note" text,
	"state" "core"."translation_state" DEFAULT 'draft' NOT NULL,
	"method" "content"."translation_method" DEFAULT 'human' NOT NULL,
	"source_version_id" uuid,
	"content_hash" varchar(64),
	"provider_code" varchar(100),
	"provider_job_reference" varchar(255),
	"carried_forward_from_source_version_id" uuid,
	"review_stage" "content"."translation_review_stage" DEFAULT 'none' NOT NULL,
	"review_requested_by_id" uuid,
	"review_requested_at" timestamp with time zone,
	"team_validated_by_id" uuid,
	"team_validated_at" timestamp with time zone,
	"review_note" text,
	"verified_by_id" uuid,
	"verified_at" timestamp with time zone,
	CONSTRAINT "activity_translations_activity_id_language_code_pk" PRIMARY KEY("activity_id","language_code")
);
--> statement-breakpoint
CREATE TABLE "content"."activity_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"activity_id" uuid NOT NULL,
	"organization_id" uuid,
	"verified_by_id" uuid,
	"verified_by_member_id" uuid,
	"actor_scope" "content"."activity_actor_scope" NOT NULL,
	"method" varchar(80) NOT NULL,
	"source_version_id" uuid,
	"scope_hash" varchar(64),
	"verified_at" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_until" timestamp with time zone,
	CONSTRAINT "activity_verifications_organization_scope_check" CHECK ("content"."activity_verifications"."actor_scope" <> 'organization' or "content"."activity_verifications"."organization_id" is not null),
	CONSTRAINT "activity_verifications_actor_check" CHECK ("content"."activity_verifications"."actor_scope" = 'system' or "content"."activity_verifications"."verified_by_id" is not null),
	CONSTRAINT "activity_verifications_hash_check" CHECK ("content"."activity_verifications"."scope_hash" is null or "content"."activity_verifications"."scope_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "activity_verifications_validity_check" CHECK ("content"."activity_verifications"."valid_until" is null or "content"."activity_verifications"."valid_until" >= "content"."activity_verifications"."verified_at")
);
--> statement-breakpoint
CREATE TABLE "core"."city_team_members" (
	"team_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"is_lead" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "city_team_members_team_id_member_id_pk" PRIMARY KEY("team_id","member_id")
);
--> statement-breakpoint
CREATE TABLE "core"."city_teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"city_id" uuid NOT NULL,
	"name" varchar(150) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "city_teams_org_city_uq" UNIQUE("organization_id","city_id"),
	CONSTRAINT "city_teams_org_scope_uq" UNIQUE("id","organization_id")
);
--> statement-breakpoint
CREATE TABLE "content"."schedule_exception_translations" (
	"exception_id" uuid NOT NULL,
	"language_code" varchar(35) NOT NULL,
	"public_reason" text NOT NULL,
	"state" "core"."translation_state" DEFAULT 'draft' NOT NULL,
	CONSTRAINT "schedule_exception_translations_exception_id_language_code_pk" PRIMARY KEY("exception_id","language_code")
);
--> statement-breakpoint
CREATE TABLE "content"."schedule_exceptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"activity_id" uuid NOT NULL,
	"date" date NOT NULL,
	"kind" "content"."schedule_exception_kind" NOT NULL,
	"start_time" time,
	"end_time" time,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schedule_exceptions_time_pair_check" CHECK (("content"."schedule_exceptions"."start_time" is null and "content"."schedule_exceptions"."end_time" is null) or ("content"."schedule_exceptions"."start_time" is not null and "content"."schedule_exceptions"."end_time" is not null and "content"."schedule_exceptions"."start_time" < "content"."schedule_exceptions"."end_time"))
);
--> statement-breakpoint
CREATE TABLE "content"."schedule_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"activity_id" uuid NOT NULL,
	"weekday" smallint NOT NULL,
	"timing_mode" varchar(20) DEFAULT 'fixed' NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"ends_next_day" boolean DEFAULT false NOT NULL,
	"valid_from" date,
	"valid_to" date,
	"holiday_behavior" "content"."holiday_behavior" DEFAULT 'closed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schedule_rules_weekday_range" CHECK ("content"."schedule_rules"."weekday" between 1 and 7),
	CONSTRAINT "schedule_rules_timing_mode_check" CHECK ("content"."schedule_rules"."timing_mode" in ('fixed', 'flexible')),
	CONSTRAINT "schedule_rules_time_order" CHECK ("content"."schedule_rules"."ends_next_day" or "content"."schedule_rules"."start_time" < "content"."schedule_rules"."end_time")
);
--> statement-breakpoint
CREATE TABLE "content"."service_translations" (
	"service_id" uuid NOT NULL,
	"scope_key" text DEFAULT 'platform' NOT NULL,
	"language_code" varchar(35) NOT NULL,
	"name" varchar(150) NOT NULL,
	"description" text,
	"state" "core"."translation_state" DEFAULT 'draft' NOT NULL,
	"method" "content"."translation_method" DEFAULT 'human' NOT NULL,
	CONSTRAINT "service_translations_service_id_language_code_pk" PRIMARY KEY("service_id","language_code")
);
--> statement-breakpoint
CREATE TABLE "content"."services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"scope_key" text GENERATED ALWAYS AS (coalesce(organization_id::text, 'platform')) STORED,
	"code" varchar(100),
	"icon" varchar(50) DEFAULT 'help' NOT NULL,
	"category_id" uuid NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"source_note" text,
	"steward_name" varchar(120),
	"steward_phone" varchar(40),
	"steward_email" varchar(255),
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "services_id_scope_key_uq" UNIQUE("id","scope_key")
);
--> statement-breakpoint
CREATE TABLE "core"."translator_languages" (
	"translator_id" uuid NOT NULL,
	"language_code" varchar(35) NOT NULL,
	"can_translate_into" boolean DEFAULT true NOT NULL,
	"can_translate_from" boolean DEFAULT false NOT NULL,
	"note" varchar(200),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "translator_languages_translator_id_language_code_pk" PRIMARY KEY("translator_id","language_code"),
	CONSTRAINT "translator_languages_direction_check" CHECK ("core"."translator_languages"."can_translate_into" or "core"."translator_languages"."can_translate_from")
);
--> statement-breakpoint
CREATE TABLE "core"."translators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"owner_organization_id" uuid,
	"display_name" varchar(200) NOT NULL,
	"contact_email" varchar(255) NOT NULL,
	"headline" varchar(160),
	"bio" text,
	"timezone" varchar(50) DEFAULT 'Europe/Paris' NOT NULL,
	"status" "core"."translator_status" DEFAULT 'invited' NOT NULL,
	"directory_scope" "core"."translator_directory_scope" DEFAULT 'organization' NOT NULL,
	"activated_at" timestamp with time zone,
	"deactivated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "translators_contact_email_normalized_ck" CHECK ("core"."translators"."contact_email" = lower(btrim("core"."translators"."contact_email"))),
	CONSTRAINT "translators_activation_check" CHECK (("core"."translators"."activated_at" is null) = ("core"."translators"."user_id" is null))
);
--> statement-breakpoint
CREATE TABLE "core"."invitation_roles" (
	"invitation_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	CONSTRAINT "invitation_roles_invitation_id_role_id_pk" PRIMARY KEY("invitation_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "core"."invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"email" varchar(255) NOT NULL,
	"kind" "core"."invitation_kind" DEFAULT 'association_publisher' NOT NULL,
	"token_hash" varchar(255) NOT NULL,
	"invited_by_id" uuid,
	"invited_by_member_id" uuid,
	"translator_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"accepted_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invitations_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "invitations_target_check" CHECK (case
        when "core"."invitations"."kind" = 'translator' then "core"."invitations"."translator_id" is not null
        when "core"."invitations"."kind" = 'platform_admin' then "core"."invitations"."translator_id" is null and "core"."invitations"."organization_id" is null
        else "core"."invitations"."translator_id" is null and "core"."invitations"."organization_id" is not null
      end)
);
--> statement-breakpoint
CREATE TABLE "core"."legal_acceptances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid,
	"legal_document_id" uuid NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."legal_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" varchar(100) NOT NULL,
	"version" varchar(50) NOT NULL,
	"language_code" varchar(35) NOT NULL,
	"body" text NOT NULL,
	"effective_from" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."member_languages" (
	"member_id" uuid NOT NULL,
	"language_code" varchar(35) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "member_languages_member_id_language_code_pk" PRIMARY KEY("member_id","language_code")
);
--> statement-breakpoint
CREATE TABLE "core"."member_roles" (
	"member_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"granted_by_id" uuid,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "member_roles_member_id_role_id_pk" PRIMARY KEY("member_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "core"."organization_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid,
	"first_name" varchar(120) NOT NULL,
	"last_name" varchar(120) NOT NULL,
	"contact_email" varchar(255) NOT NULL,
	"phone" varchar(40) NOT NULL,
	"title" varchar(160) NOT NULL,
	"status" "core"."member_status" DEFAULT 'invited' NOT NULL,
	"offboarded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "org_members_scope_uq" UNIQUE("id","organization_id"),
	CONSTRAINT "org_members_org_email_uq" UNIQUE("organization_id","contact_email")
);
--> statement-breakpoint
CREATE TABLE "core"."organization_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"reviewed_by_id" uuid,
	"method" varchar(100),
	"status" "core"."verification_status" DEFAULT 'pending' NOT NULL,
	"notes" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."permission_review_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"decision" "core"."permission_review_decision" DEFAULT 'pending' NOT NULL,
	"note" text,
	"decided_by_id" uuid,
	"decided_at" timestamp with time zone,
	"applied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "permission_review_items_decision_check" CHECK (("core"."permission_review_items"."decision" = 'pending' and "core"."permission_review_items"."decided_at" is null) or ("core"."permission_review_items"."decision" <> 'pending' and "core"."permission_review_items"."decided_at" is not null and "core"."permission_review_items"."decided_by_id" is not null)),
	CONSTRAINT "permission_review_items_applied_check" CHECK ("core"."permission_review_items"."applied_at" is null or "core"."permission_review_items"."decision" = 'revoke')
);
--> statement-breakpoint
CREATE TABLE "core"."permission_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"state" "core"."permission_review_state" DEFAULT 'open' NOT NULL,
	"due_on" date,
	"assigned_to_member_id" uuid,
	"started_at" timestamp with time zone,
	"completed_by_id" uuid,
	"completed_at" timestamp with time zone,
	"summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "permission_reviews_scope_uq" UNIQUE("id","organization_id"),
	CONSTRAINT "permission_reviews_completion_check" CHECK (("core"."permission_reviews"."state" = 'completed' and "core"."permission_reviews"."completed_at" is not null) or "core"."permission_reviews"."state" <> 'completed')
);
--> statement-breakpoint
CREATE TABLE "core"."permissions" (
	"code" varchar(100) PRIMARY KEY NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."role_permissions" (
	"role_id" uuid NOT NULL,
	"permission_code" varchar(100) NOT NULL,
	CONSTRAINT "role_permissions_role_id_permission_code_pk" PRIMARY KEY("role_id","permission_code")
);
--> statement-breakpoint
CREATE TABLE "core"."roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"code" varchar(100) NOT NULL,
	"description" text,
	"requires_second_factor" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."user_platform_roles" (
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"granted_by_id" uuid,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_platform_roles_user_id_role_id_pk" PRIMARY KEY("user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "content"."asset_text_tracks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"language_code" varchar(35) NOT NULL,
	"kind" "content"."asset_text_track_kind" NOT NULL,
	"body" text,
	"storage_key" text,
	"state" "core"."translation_state" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content"."asset_translations" (
	"asset_id" uuid NOT NULL,
	"language_code" varchar(35) NOT NULL,
	"title" varchar(200),
	"description" text,
	"alt_text" text,
	"decorative" boolean DEFAULT false NOT NULL,
	"state" "core"."translation_state" DEFAULT 'draft' NOT NULL,
	CONSTRAINT "asset_translations_asset_id_language_code_pk" PRIMARY KEY("asset_id","language_code")
);
--> statement-breakpoint
CREATE TABLE "content"."asset_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"kind" "content"."asset_variant_kind" NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"byte_size" bigint NOT NULL,
	"width" integer,
	"height" integer,
	"duration_seconds" integer,
	"sha256" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content"."assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"uploader_id" uuid,
	"organization_id" uuid,
	"language_code" varchar(35),
	"storage_key" text NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"byte_size" bigint NOT NULL,
	"duration_seconds" integer,
	"sha256" varchar(64),
	"kind" "content"."media_kind" NOT NULL,
	"visibility" "content"."asset_visibility" DEFAULT 'workspace' NOT NULL,
	"scan_state" "content"."malware_scan_state" DEFAULT 'pending' NOT NULL,
	"rights_confirmed" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assets_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "content"."download_translations" (
	"download_id" uuid NOT NULL,
	"language_code" varchar(35) NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"state" "core"."translation_state" DEFAULT 'draft' NOT NULL,
	CONSTRAINT "download_translations_download_id_language_code_pk" PRIMARY KEY("download_id","language_code")
);
--> statement-breakpoint
CREATE TABLE "content"."downloads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"last_verified_at" timestamp with time zone,
	"review_due_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operations"."training_courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"slug" varchar(100) NOT NULL,
	"title" varchar(200) NOT NULL,
	"title_en" varchar(200),
	"title_ar" varchar(200),
	"description" text,
	"visibility" "operations"."course_visibility" DEFAULT 'organization' NOT NULL,
	"provider" varchar(200),
	"url" text,
	"source_language_code" varchar(35) DEFAULT 'fr' NOT NULL,
	"verification_required" boolean DEFAULT false NOT NULL,
	"validity_months" integer,
	"active" boolean DEFAULT true NOT NULL,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "training_courses_global_reach_check" CHECK ("operations"."training_courses"."organization_id" is not null or "operations"."training_courses"."visibility" = 'all_organizations_and_translators'),
	CONSTRAINT "training_courses_validity_months_check" CHECK ("operations"."training_courses"."validity_months" is null or "operations"."training_courses"."validity_months" between 1 and 600)
);
--> statement-breakpoint
CREATE TABLE "operations"."training_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"member_id" uuid,
	"translator_id" uuid,
	"state" "operations"."training_record_state" DEFAULT 'self_declared' NOT NULL,
	"completed_on" date,
	"expires_on" date,
	"verified_by_id" uuid,
	"verified_at" timestamp with time zone,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "training_records_learner_check" CHECK (("operations"."training_records"."member_id" is not null) <> ("operations"."training_records"."translator_id" is not null)),
	CONSTRAINT "training_records_validity_check" CHECK ("operations"."training_records"."expires_on" is null or "operations"."training_records"."completed_on" is null or "operations"."training_records"."expires_on" >= "operations"."training_records"."completed_on"),
	CONSTRAINT "training_records_verifier_check" CHECK (("operations"."training_records"."verified_at" is null) = ("operations"."training_records"."verified_by_id" is null))
);
--> statement-breakpoint
CREATE TABLE "operations"."requirement_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"set_id" uuid NOT NULL,
	"skill_id" uuid,
	"course_id" uuid,
	"language_code" varchar(35),
	"necessity" "operations"."requirement_necessity" DEFAULT 'required' NOT NULL,
	"must_be_verified" boolean DEFAULT false NOT NULL,
	"must_be_current" boolean DEFAULT true NOT NULL,
	"minimum_count" integer,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "requirement_items_target_check" CHECK (("operations"."requirement_items"."skill_id" is not null)::int + ("operations"."requirement_items"."course_id" is not null)::int + ("operations"."requirement_items"."language_code" is not null)::int = 1),
	CONSTRAINT "requirement_items_minimum_count_check" CHECK ("operations"."requirement_items"."minimum_count" is null or "operations"."requirement_items"."minimum_count" between 1 and 100)
);
--> statement-breakpoint
CREATE TABLE "operations"."requirement_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" varchar(100) NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"source_language_code" varchar(35) DEFAULT 'fr' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operations"."skill_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"skill_id" uuid NOT NULL,
	"member_id" uuid,
	"translator_id" uuid,
	"state" "operations"."training_record_state" DEFAULT 'self_declared' NOT NULL,
	"obtained_on" date,
	"expires_on" date,
	"verified_by_id" uuid,
	"verified_at" timestamp with time zone,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "skill_records_holder_check" CHECK (("operations"."skill_records"."member_id" is not null) <> ("operations"."skill_records"."translator_id" is not null)),
	CONSTRAINT "skill_records_validity_check" CHECK ("operations"."skill_records"."expires_on" is null or "operations"."skill_records"."obtained_on" is null or "operations"."skill_records"."expires_on" >= "operations"."skill_records"."obtained_on"),
	CONSTRAINT "skill_records_verifier_check" CHECK (("operations"."skill_records"."verified_at" is null) = ("operations"."skill_records"."verified_by_id" is null))
);
--> statement-breakpoint
CREATE TABLE "operations"."skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"kind" "operations"."skill_kind" DEFAULT 'skill' NOT NULL,
	"code" varchar(100) NOT NULL,
	"name_fr" varchar(160) NOT NULL,
	"name_en" varchar(160),
	"name_ar" varchar(160),
	"description_fr" text,
	"visibility" "operations"."course_visibility" DEFAULT 'organization' NOT NULL,
	"verification_required" boolean DEFAULT false NOT NULL,
	"validity_months" integer,
	"reference_url" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "skills_global_reach_check" CHECK ("operations"."skills"."organization_id" is not null or "operations"."skills"."visibility" = 'all_organizations_and_translators'),
	CONSTRAINT "skills_validity_months_check" CHECK ("operations"."skills"."validity_months" is null or "operations"."skills"."validity_months" between 1 and 600)
);
--> statement-breakpoint
CREATE TABLE "content"."article_details" (
	"entry_id" uuid PRIMARY KEY NOT NULL,
	"article_date" date,
	"featured" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content"."basic_information_details" (
	"entry_id" uuid PRIMARY KEY NOT NULL,
	"icon" varchar(50) NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"emergency" boolean DEFAULT false NOT NULL,
	"category_id" uuid
);
--> statement-breakpoint
CREATE TABLE "content"."editorial_custodianships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"custodian_kind" "content"."custodian_kind" NOT NULL,
	"organization_id" uuid,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"actor_user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "content"."editorial_custody_transfer_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"transfer_request_id" uuid,
	"action" varchar(80) NOT NULL,
	"actor_user_id" uuid,
	"previous_organization_id" uuid,
	"new_organization_id" uuid,
	"note" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content"."editorial_custody_transfer_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"destination_kind" "content"."custodian_kind" NOT NULL,
	"destination_organization_id" uuid,
	"previous_organization_id" uuid,
	"token_hash" varchar(64) NOT NULL,
	"state" "content"."custody_transfer_state" DEFAULT 'pending' NOT NULL,
	"reason" text,
	"requested_by_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"decided_by_id" uuid,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "editorial_custody_transfer_requests_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "editorial_custody_transfer_requests_token_hash_check" CHECK ("content"."editorial_custody_transfer_requests"."token_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "editorial_custody_transfer_requests_expiry_check" CHECK ("content"."editorial_custody_transfer_requests"."expires_at" > "content"."editorial_custody_transfer_requests"."created_at"),
	CONSTRAINT "editorial_custody_transfer_requests_destination_check" CHECK (("content"."editorial_custody_transfer_requests"."destination_kind" = 'organization' and "content"."editorial_custody_transfer_requests"."destination_organization_id" is not null) or ("content"."editorial_custody_transfer_requests"."destination_kind" = 'platform' and "content"."editorial_custody_transfer_requests"."destination_organization_id" is null)),
	CONSTRAINT "editorial_custody_transfer_requests_movement_check" CHECK ("content"."editorial_custody_transfer_requests"."destination_organization_id" is null or "content"."editorial_custody_transfer_requests"."previous_organization_id" is null or "content"."editorial_custody_transfer_requests"."destination_organization_id" <> "content"."editorial_custody_transfer_requests"."previous_organization_id"),
	CONSTRAINT "editorial_custody_transfer_requests_decision_check" CHECK (("content"."editorial_custody_transfer_requests"."state" in ('accepted', 'declined') and "content"."editorial_custody_transfer_requests"."decided_at" is not null and "content"."editorial_custody_transfer_requests"."decided_by_id" is not null) or ("content"."editorial_custody_transfer_requests"."state" in ('pending', 'expired', 'cancelled')))
);
--> statement-breakpoint
CREATE TABLE "content"."editorial_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "content"."editorial_kind" NOT NULL,
	"slug" varchar(150) NOT NULL,
	"workflow_state" "content"."editorial_workflow_state" DEFAULT 'draft' NOT NULL,
	"city_id" uuid,
	"steward_name" varchar(120),
	"steward_phone" varchar(40),
	"steward_email" varchar(255),
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "editorial_entries_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "content"."editorial_entry_assets" (
	"entry_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"role" varchar(20) NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "editorial_entry_assets_entry_id_asset_id_pk" PRIMARY KEY("entry_id","asset_id")
);
--> statement-breakpoint
CREATE TABLE "content"."editorial_entry_routes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"language_code" varchar(35) NOT NULL,
	"slug" varchar(150) NOT NULL,
	"retired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content"."editorial_entry_tags" (
	"entry_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "editorial_entry_tags_entry_id_tag_id_pk" PRIMARY KEY("entry_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "content"."editorial_publications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"language_code" varchar(35) NOT NULL,
	"revision_id" uuid NOT NULL,
	"source_version_id" uuid NOT NULL,
	"translation_content_hash" varchar(64) NOT NULL,
	"published_by_id" uuid NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"scheduled_for" timestamp with time zone,
	"unpublished_by_id" uuid,
	"unpublished_at" timestamp with time zone,
	CONSTRAINT "editorial_publications_content_hash_check" CHECK ("content"."editorial_publications"."translation_content_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "editorial_publications_schedule_check" CHECK ("content"."editorial_publications"."scheduled_for" is null or "content"."editorial_publications"."scheduled_for" > "content"."editorial_publications"."published_at"),
	CONSTRAINT "editorial_publications_unpublish_check" CHECK (("content"."editorial_publications"."unpublished_at" is null and "content"."editorial_publications"."unpublished_by_id" is null) or ("content"."editorial_publications"."unpublished_at" >= "content"."editorial_publications"."published_at" and "content"."editorial_publications"."unpublished_by_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "content"."editorial_related_contacts" (
	"entry_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	CONSTRAINT "editorial_related_contacts_entry_id_contact_id_pk" PRIMARY KEY("entry_id","contact_id")
);
--> statement-breakpoint
CREATE TABLE "content"."editorial_related_entries" (
	"entry_id" uuid NOT NULL,
	"related_entry_id" uuid NOT NULL,
	"relation_kind" varchar(50),
	CONSTRAINT "editorial_related_entries_entry_id_related_entry_id_pk" PRIMARY KEY("entry_id","related_entry_id")
);
--> statement-breakpoint
CREATE TABLE "content"."editorial_related_organizations" (
	"entry_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	CONSTRAINT "editorial_related_organizations_entry_id_organization_id_pk" PRIMARY KEY("entry_id","organization_id")
);
--> statement-breakpoint
CREATE TABLE "content"."editorial_related_services" (
	"entry_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "editorial_related_services_entry_id_service_id_pk" PRIMARY KEY("entry_id","service_id")
);
--> statement-breakpoint
CREATE TABLE "content"."editorial_revision_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"revision_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"role" varchar(50) NOT NULL,
	"language_code" varchar(35),
	"display_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content"."editorial_revision_organizations" (
	"revision_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"role" "content"."attribution_role" DEFAULT 'factual_owner' NOT NULL,
	"approved_by_name" varchar(200),
	"approved_via" varchar(100),
	"approved_at" timestamp with time zone,
	"evidence_note" text,
	CONSTRAINT "editorial_revision_organizations_revision_id_organization_id_pk" PRIMARY KEY("revision_id","organization_id")
);
--> statement-breakpoint
CREATE TABLE "content"."editorial_revision_sources" (
	"revision_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"role" varchar(50),
	"display_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "editorial_revision_sources_revision_id_source_id_pk" PRIMARY KEY("revision_id","source_id")
);
--> statement-breakpoint
CREATE TABLE "content"."editorial_revision_translations" (
	"revision_id" uuid NOT NULL,
	"language_code" varchar(35) NOT NULL,
	"title" varchar(200) NOT NULL,
	"summary" text,
	"body_json" jsonb,
	"plain_text" text,
	"state" "core"."translation_state" DEFAULT 'draft' NOT NULL,
	"method" "content"."translation_method" DEFAULT 'human' NOT NULL,
	"source_version_id" uuid,
	"content_hash" varchar(64),
	"provider_code" varchar(100),
	"provider_job_reference" varchar(255),
	"carried_forward_from_revision_id" uuid,
	"review_stage" "content"."translation_review_stage" DEFAULT 'none' NOT NULL,
	"review_requested_by_id" uuid,
	"review_requested_at" timestamp with time zone,
	"team_validated_by_id" uuid,
	"team_validated_at" timestamp with time zone,
	"review_note" text,
	"verified_by_id" uuid,
	"verified_at" timestamp with time zone,
	CONSTRAINT "editorial_revision_translations_revision_id_language_code_pk" PRIMARY KEY("revision_id","language_code")
);
--> statement-breakpoint
CREATE TABLE "content"."editorial_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"revision_number" integer NOT NULL,
	"author_id" uuid,
	"source_language_code" varchar(35) DEFAULT 'fr' NOT NULL,
	"can_become_outdated" boolean DEFAULT false NOT NULL,
	"unreliable_from" date,
	"source_summary" text,
	"last_reviewed_at" timestamp with time zone,
	"review_due_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content"."fixed_information_details" (
	"entry_id" uuid PRIMARY KEY NOT NULL,
	"topic_code" varchar(50) NOT NULL,
	"review_interval_days" integer
);
--> statement-breakpoint
CREATE TABLE "content"."review_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_kind" varchar(50) NOT NULL,
	"entity_id" uuid NOT NULL,
	"assignee_id" uuid,
	"due_at" timestamp with time zone,
	"status" "content"."review_task_status" DEFAULT 'open' NOT NULL,
	"resolution_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content"."sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"publisher" varchar(255),
	"url" text,
	"source_date" date,
	"retrieved_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content"."translation_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"source_version_id" uuid NOT NULL,
	"entity_kind" "content"."translation_assignment_entity" NOT NULL,
	"entity_id" uuid NOT NULL,
	"target_language_code" varchar(35) NOT NULL,
	"method" "content"."translation_method" DEFAULT 'ai' NOT NULL,
	"provider_code" varchar(100),
	"provider_model" varchar(150),
	"provider_job_reference" varchar(255),
	"state" "content"."translation_job_state" DEFAULT 'queued' NOT NULL,
	"output_content_json" jsonb,
	"output_content_hash" varchar(64),
	"requested_by_id" uuid,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"error_code" varchar(100),
	CONSTRAINT "translation_jobs_ai_method_check" CHECK ("content"."translation_jobs"."method" <> 'human'),
	CONSTRAINT "translation_jobs_output_hash_check" CHECK ("content"."translation_jobs"."output_content_hash" is null or "content"."translation_jobs"."output_content_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "content"."translation_source_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"entity_kind" "content"."translation_assignment_entity" NOT NULL,
	"entity_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"previous_version_id" uuid,
	"source_revision_id" uuid,
	"source_language_code" varchar(35) NOT NULL,
	"source_content_json" jsonb NOT NULL,
	"source_content_hash" varchar(64) NOT NULL,
	"impact" "content"."translation_impact" NOT NULL,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "translation_source_versions_positive_version_check" CHECK ("content"."translation_source_versions"."version" > 0),
	CONSTRAINT "translation_source_versions_hash_check" CHECK ("content"."translation_source_versions"."source_content_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "translation_source_versions_initial_predecessor_check" CHECK (("content"."translation_source_versions"."impact" = 'initial' and "content"."translation_source_versions"."version" = 1 and "content"."translation_source_versions"."previous_version_id" is null) or ("content"."translation_source_versions"."impact" <> 'initial' and "content"."translation_source_versions"."version" > 1 and "content"."translation_source_versions"."previous_version_id" is not null)),
	CONSTRAINT "translation_source_versions_editorial_revision_check" CHECK (("content"."translation_source_versions"."entity_kind" = 'editorial_entry' and "content"."translation_source_versions"."source_revision_id" is not null) or ("content"."translation_source_versions"."entity_kind" <> 'editorial_entry' and "content"."translation_source_versions"."source_revision_id" is null))
);
--> statement-breakpoint
CREATE TABLE "content"."translation_assignment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_id" uuid NOT NULL,
	"from_state" "content"."translation_assignment_state",
	"to_state" "content"."translation_assignment_state" NOT NULL,
	"actor_user_id" uuid,
	"by_translator" boolean DEFAULT false NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "translation_assignment_events_actor_check" CHECK (("content"."translation_assignment_events"."by_translator" and "content"."translation_assignment_events"."actor_user_id" is null) or (not "content"."translation_assignment_events"."by_translator" and "content"."translation_assignment_events"."actor_user_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "content"."translation_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"entity_kind" "content"."translation_assignment_entity" NOT NULL,
	"entity_id" uuid NOT NULL,
	"source_version_id" uuid NOT NULL,
	"target_language_code" varchar(35) NOT NULL,
	"translator_id" uuid,
	"translator_email" varchar(255) NOT NULL,
	"translator_name" varchar(200),
	"assigned_by_id" uuid,
	"token_hash" varchar(255) NOT NULL,
	"token_consumed_at" timestamp with time zone,
	"state" "content"."translation_assignment_state" DEFAULT 'requested' NOT NULL,
	"submitted_content_json" jsonb,
	"submitted_content_hash" varchar(64),
	"instructions" text,
	"review_note" text,
	"reviewed_by_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"submitted_at" timestamp with time zone,
	"reviewed_at" timestamp with time zone,
	"decided_at" timestamp with time zone,
	"promoted_by_id" uuid,
	"promoted_at" timestamp with time zone,
	"published_by_id" uuid,
	"published_at" timestamp with time zone,
	"expired_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "translation_assignments_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "translation_assignments_expiry_check" CHECK ("content"."translation_assignments"."expires_at" > "content"."translation_assignments"."created_at"),
	CONSTRAINT "translation_assignments_token_consumed_check" CHECK ("content"."translation_assignments"."token_consumed_at" is null or "content"."translation_assignments"."token_consumed_at" <= "content"."translation_assignments"."expires_at"),
	CONSTRAINT "translation_assignments_submission_hash_check" CHECK (("content"."translation_assignments"."submitted_content_json" is null and "content"."translation_assignments"."submitted_content_hash" is null) or ("content"."translation_assignments"."submitted_content_json" is not null and "content"."translation_assignments"."submitted_content_hash" ~ '^[0-9a-f]{64}$')),
	CONSTRAINT "translation_assignments_promotion_actor_check" CHECK (("content"."translation_assignments"."promoted_at" is null and "content"."translation_assignments"."promoted_by_id" is null) or ("content"."translation_assignments"."promoted_at" is not null and "content"."translation_assignments"."promoted_by_id" is not null)),
	CONSTRAINT "translation_assignments_publication_actor_check" CHECK (("content"."translation_assignments"."published_at" is null and "content"."translation_assignments"."published_by_id" is null) or ("content"."translation_assignments"."published_at" is not null and "content"."translation_assignments"."published_by_id" is not null and "content"."translation_assignments"."promoted_at" is not null)),
	CONSTRAINT "translation_assignments_expired_at_check" CHECK ("content"."translation_assignments"."expired_at" is null or "content"."translation_assignments"."expired_at" >= "content"."translation_assignments"."expires_at")
);
--> statement-breakpoint
CREATE TABLE "content"."public_event_audience_translations" (
	"event_id" uuid NOT NULL,
	"language_code" varchar(35) NOT NULL,
	"eligibility_details" text NOT NULL,
	"state" "core"."translation_state" DEFAULT 'draft' NOT NULL,
	CONSTRAINT "public_event_audience_translations_event_id_language_code_pk" PRIMARY KEY("event_id","language_code")
);
--> statement-breakpoint
CREATE TABLE "content"."public_event_occurrence_translations" (
	"occurrence_id" uuid NOT NULL,
	"language_code" varchar(35) NOT NULL,
	"public_reason" text NOT NULL,
	"state" "core"."translation_state" DEFAULT 'draft' NOT NULL,
	CONSTRAINT "public_event_occurrence_translations_pk" PRIMARY KEY("occurrence_id","language_code")
);
--> statement-breakpoint
CREATE TABLE "content"."public_event_occurrences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"series_id" uuid,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"state" "content"."occurrence_state" DEFAULT 'scheduled' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content"."public_event_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content"."public_event_publications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"language_code" varchar(35) NOT NULL,
	"source_version_id" uuid NOT NULL,
	"translation_content_hash" varchar(64) NOT NULL,
	"published_by_id" uuid NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"unpublished_by_id" uuid,
	"unpublished_at" timestamp with time zone,
	CONSTRAINT "public_event_publications_content_hash_check" CHECK ("content"."public_event_publications"."translation_content_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "public_event_publications_unpublish_check" CHECK (("content"."public_event_publications"."unpublished_at" is null and "content"."public_event_publications"."unpublished_by_id" is null) or ("content"."public_event_publications"."unpublished_at" >= "content"."public_event_publications"."published_at" and "content"."public_event_publications"."unpublished_by_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "content"."public_event_series" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"timezone" varchar(50) DEFAULT 'Europe/Paris' NOT NULL,
	"rrule" text,
	"local_start_time" time NOT NULL,
	"duration_minutes" integer NOT NULL,
	"starts_on" timestamp with time zone NOT NULL,
	"ends_on" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content"."public_event_services" (
	"event_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	CONSTRAINT "public_event_services_event_id_service_id_pk" PRIMARY KEY("event_id","service_id")
);
--> statement-breakpoint
CREATE TABLE "content"."public_event_translations" (
	"event_id" uuid NOT NULL,
	"language_code" varchar(35) NOT NULL,
	"name" varchar(150) NOT NULL,
	"description" text,
	"instructions" text,
	"cancellation_note" text,
	"state" "core"."translation_state" DEFAULT 'draft' NOT NULL,
	"method" "content"."translation_method" DEFAULT 'human' NOT NULL,
	"source_version_id" uuid,
	"content_hash" varchar(64),
	"provider_code" varchar(100),
	"provider_job_reference" varchar(255),
	"carried_forward_from_source_version_id" uuid,
	"verified_by_id" uuid,
	"verified_at" timestamp with time zone,
	CONSTRAINT "public_event_translations_event_id_language_code_pk" PRIMARY KEY("event_id","language_code")
);
--> statement-breakpoint
CREATE TABLE "content"."public_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"place_id" uuid,
	"city_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"audience_category_id" uuid NOT NULL,
	"source_language_code" varchar(35) DEFAULT 'fr' NOT NULL,
	"min_age" smallint,
	"max_age" smallint,
	"manual_status" "content"."service_manual_status" DEFAULT 'normal' NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"verified_by_id" uuid,
	"source_note" text,
	"last_verified_at" timestamp with time zone,
	"review_due_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operations"."coordination_event_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"role" varchar(50) NOT NULL,
	"language_code" varchar(35),
	"display_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coordination_event_assets_event_asset_role_uq" UNIQUE("event_id","asset_id","role")
);
--> statement-breakpoint
CREATE TABLE "operations"."coordination_event_occurrence_translations" (
	"occurrence_id" uuid NOT NULL,
	"language_code" varchar(35) NOT NULL,
	"cancellation_reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coordination_event_occurrence_translations_pk" PRIMARY KEY("occurrence_id","language_code")
);
--> statement-breakpoint
CREATE TABLE "operations"."coordination_event_occurrences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"series_id" uuid,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"state" "operations"."coordination_event_status" DEFAULT 'scheduled' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coordination_event_occurrences_range_check" CHECK ("operations"."coordination_event_occurrences"."ends_at" >= "operations"."coordination_event_occurrences"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "operations"."coordination_event_participation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"occurrence_id" uuid,
	"organization_id" uuid NOT NULL,
	"member_id" uuid,
	"state" "operations"."coordination_participation_state" NOT NULL,
	"expected_attendees" smallint,
	"note" text,
	"responded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coordination_event_participation_attendees_check" CHECK ("operations"."coordination_event_participation"."expected_attendees" is null or ("operations"."coordination_event_participation"."expected_attendees" >= 0 and "operations"."coordination_event_participation"."expected_attendees" <= 500))
);
--> statement-breakpoint
CREATE TABLE "operations"."coordination_event_series" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"timezone" varchar(50) DEFAULT 'Europe/Paris' NOT NULL,
	"rrule" text,
	"local_start_time" time NOT NULL,
	"duration_minutes" integer NOT NULL,
	"starts_on" timestamp with time zone NOT NULL,
	"ends_on" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coordination_event_series_event_uq" UNIQUE("event_id"),
	CONSTRAINT "coordination_event_series_duration_check" CHECK ("operations"."coordination_event_series"."duration_minutes" > 0 and "operations"."coordination_event_series"."duration_minutes" <= 1440),
	CONSTRAINT "coordination_event_series_window_check" CHECK ("operations"."coordination_event_series"."ends_on" is null or "operations"."coordination_event_series"."ends_on" >= "operations"."coordination_event_series"."starts_on")
);
--> statement-breakpoint
CREATE TABLE "operations"."coordination_event_transit_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"mode" "core"."transit_mode" NOT NULL,
	"line" varchar(40),
	"stop_name" varchar(120),
	"walk_minutes" smallint,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coordination_event_transit_links_detail_check" CHECK ("operations"."coordination_event_transit_links"."line" is not null or "operations"."coordination_event_transit_links"."stop_name" is not null),
	CONSTRAINT "coordination_event_transit_links_walk_check" CHECK ("operations"."coordination_event_transit_links"."walk_minutes" is null or ("operations"."coordination_event_transit_links"."walk_minutes" >= 0 and "operations"."coordination_event_transit_links"."walk_minutes" <= 240))
);
--> statement-breakpoint
CREATE TABLE "operations"."coordination_event_translations" (
	"event_id" uuid NOT NULL,
	"language_code" varchar(35) NOT NULL,
	"title" varchar(180) NOT NULL,
	"description" text,
	"cancellation_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coordination_event_translations_event_id_language_code_pk" PRIMARY KEY("event_id","language_code")
);
--> statement-breakpoint
CREATE TABLE "operations"."coordination_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"host_organization_id" uuid,
	"city_id" uuid NOT NULL,
	"visibility" "operations"."coordination_event_visibility" DEFAULT 'organization' NOT NULL,
	"status" "operations"."coordination_event_status" DEFAULT 'scheduled' NOT NULL,
	"place_id" uuid,
	"location_label" varchar(200),
	"contact_label" varchar(120),
	"contact_value" varchar(200),
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"all_day" boolean DEFAULT false NOT NULL,
	"source_language_code" varchar(35) DEFAULT 'fr' NOT NULL,
	"created_by_id" uuid,
	"steward_name" varchar(120),
	"steward_phone" varchar(40),
	"steward_email" varchar(255),
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coordination_events_range_check" CHECK ("operations"."coordination_events"."ends_at" >= "operations"."coordination_events"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "content"."search_concept_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"concept_id" uuid NOT NULL,
	"language_code" varchar(35) NOT NULL,
	"alias" varchar(100) NOT NULL,
	"normalized_alias" varchar(100) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content"."search_concept_translations" (
	"concept_id" uuid NOT NULL,
	"language_code" varchar(35) NOT NULL,
	"label" varchar(100) NOT NULL,
	CONSTRAINT "search_concept_translations_concept_id_language_code_pk" PRIMARY KEY("concept_id","language_code")
);
--> statement-breakpoint
CREATE TABLE "content"."search_concepts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"category_id" uuid,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "search_concepts_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "content"."service_search_concepts" (
	"service_id" uuid NOT NULL,
	"concept_id" uuid NOT NULL,
	"verified_by_id" uuid,
	"verified_at" timestamp with time zone,
	CONSTRAINT "service_search_concepts_service_id_concept_id_pk" PRIMARY KEY("service_id","concept_id")
);
--> statement-breakpoint
CREATE TABLE "simulator"."edges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version_id" uuid NOT NULL,
	"from_node_id" uuid NOT NULL,
	"option_id" uuid,
	"to_node_id" uuid NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "simulator"."flow_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"flow_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"entry_node_key" varchar(50),
	"source_language_code" varchar(35) NOT NULL,
	"status" "simulator"."flow_version_status" DEFAULT 'draft' NOT NULL,
	"source_summary" text,
	"last_reviewed_at" timestamp with time zone,
	"review_due_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "simulator"."flows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(150) NOT NULL,
	"internal_name" varchar(180) NOT NULL,
	"owner_organization_id" uuid,
	"city_id" uuid,
	"created_by_id" uuid,
	"steward_name" varchar(120),
	"steward_phone" varchar(40),
	"steward_email" varchar(255),
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "flows_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "simulator"."node_sources" (
	"node_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	CONSTRAINT "node_sources_node_id_source_id_pk" PRIMARY KEY("node_id","source_id")
);
--> statement-breakpoint
CREATE TABLE "simulator"."node_translations" (
	"node_id" uuid NOT NULL,
	"language_code" varchar(35) NOT NULL,
	"prompt" text,
	"explanation" text,
	"result_body" text,
	"disclaimer" text,
	"state" "core"."translation_state" DEFAULT 'draft' NOT NULL,
	CONSTRAINT "node_translations_node_id_language_code_pk" PRIMARY KEY("node_id","language_code")
);
--> statement-breakpoint
CREATE TABLE "simulator"."nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version_id" uuid NOT NULL,
	"node_key" varchar(50) NOT NULL,
	"kind" "simulator"."node_kind" NOT NULL,
	"optional" boolean DEFAULT true NOT NULL,
	"position_x" double precision DEFAULT 0 NOT NULL,
	"position_y" double precision DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "simulator"."option_translations" (
	"option_id" uuid NOT NULL,
	"language_code" varchar(35) NOT NULL,
	"label" varchar(200) NOT NULL,
	"help" text,
	"state" "core"."translation_state" DEFAULT 'draft' NOT NULL,
	CONSTRAINT "option_translations_option_id_language_code_pk" PRIMARY KEY("option_id","language_code")
);
--> statement-breakpoint
CREATE TABLE "simulator"."options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"node_id" uuid NOT NULL,
	"option_key" varchar(50) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"prefer_not_to_say" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "simulator"."result_contacts" (
	"node_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	CONSTRAINT "result_contacts_node_id_contact_id_pk" PRIMARY KEY("node_id","contact_id")
);
--> statement-breakpoint
CREATE TABLE "simulator"."result_editorial_entries" (
	"node_id" uuid NOT NULL,
	"entry_id" uuid NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "result_editorial_entries_node_id_entry_id_pk" PRIMARY KEY("node_id","entry_id")
);
--> statement-breakpoint
CREATE TABLE "simulator"."result_organizations" (
	"node_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	CONSTRAINT "result_organizations_node_id_organization_id_pk" PRIMARY KEY("node_id","organization_id")
);
--> statement-breakpoint
CREATE TABLE "simulator"."result_services" (
	"node_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "result_services_node_id_service_id_pk" PRIMARY KEY("node_id","service_id")
);
--> statement-breakpoint
CREATE TABLE "simulator"."version_publications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"flow_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"published_by_id" uuid,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"unpublished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "core"."moderation_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" varchar(40) NOT NULL,
	"kind" "core"."moderation_case_kind" NOT NULL,
	"status" "core"."moderation_case_status" DEFAULT 'open' NOT NULL,
	"organization_id" uuid,
	"related_organization_id" uuid,
	"entity_type" varchar(100),
	"entity_id" varchar(255),
	"entity_label" varchar(255),
	"summary" text NOT NULL,
	"reported_by_id" uuid,
	"reported_by_organization_id" uuid,
	"assigned_to_id" uuid,
	"resolution" varchar(80),
	"resolution_note" text,
	"resolved_by_id" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "moderation_cases_reference_unique" UNIQUE("reference"),
	CONSTRAINT "moderation_cases_subject_check" CHECK ("core"."moderation_cases"."organization_id" is not null or ("core"."moderation_cases"."entity_type" is not null and "core"."moderation_cases"."entity_id" is not null)),
	CONSTRAINT "moderation_cases_related_check" CHECK (("core"."moderation_cases"."kind" in ('duplicate', 'impersonation') and "core"."moderation_cases"."related_organization_id" is not null) or "core"."moderation_cases"."kind" not in ('duplicate', 'impersonation')),
	CONSTRAINT "moderation_cases_distinct_check" CHECK ("core"."moderation_cases"."related_organization_id" is null or "core"."moderation_cases"."organization_id" is null or "core"."moderation_cases"."related_organization_id" <> "core"."moderation_cases"."organization_id"),
	CONSTRAINT "moderation_cases_resolution_check" CHECK (("core"."moderation_cases"."status" in ('resolved', 'dismissed') and "core"."moderation_cases"."resolved_at" is not null and "core"."moderation_cases"."resolved_by_id" is not null and "core"."moderation_cases"."resolution" is not null) or "core"."moderation_cases"."status" in ('open', 'in_review'))
);
--> statement-breakpoint
CREATE TABLE "core"."moderation_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"action" varchar(80) NOT NULL,
	"actor_user_id" uuid,
	"new_status" "core"."moderation_case_status",
	"note" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit"."events" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"actor_user_id" uuid,
	"actor_member_id" uuid,
	"actor_label" varchar(255),
	"actor_type" "audit"."actor_type" DEFAULT 'user' NOT NULL,
	"action" varchar(150) NOT NULL,
	"subject_type" varchar(100),
	"subject_id" varchar(255),
	"subject_label" varchar(255),
	"outcome" "audit"."audit_outcome" DEFAULT 'success' NOT NULL,
	"severity" "audit"."audit_severity" DEFAULT 'info' NOT NULL,
	"reason" text,
	"metadata" jsonb,
	"changes" jsonb,
	"route" varchar(255),
	"method" varchar(10),
	"ip_address" varchar(45),
	"user_agent" varchar(400),
	"error_code" varchar(120),
	"duration_ms" integer,
	"request_id" varchar(100),
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_events_pk" PRIMARY KEY("id","occurred_at")
-- Hand-edited, once, before this file was ever applied: drizzle-kit does not
-- model declarative partitioning, so `PARTITION BY` cannot come from the schema
-- and no future `db:generate` will revert it. The partitions themselves, and the
-- DEFAULT catch-all a partitioned table needs before it will accept any insert
-- at all, are 0001. See src/server/db/schema/audit-log.ts for why the key is
-- (id, occurred_at) and docs/DATABASE-SCHEMA.md §17 for the retention this buys.
) PARTITION BY RANGE ("occurred_at");
--> statement-breakpoint
CREATE TABLE "notifications"."delivery_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel" "notifications"."delivery_channel" NOT NULL,
	"status" "notifications"."delivery_status" DEFAULT 'queued' NOT NULL,
	"template" varchar(120) NOT NULL,
	"recipient_redacted" varchar(160) NOT NULL,
	"recipient_hash" varchar(64) NOT NULL,
	"user_id" uuid,
	"organization_id" uuid,
	"locale" varchar(35),
	"provider" varchar(40),
	"provider_message_id" varchar(255),
	"error_code" varchar(120),
	"error_message" varchar(400),
	"attempt" integer DEFAULT 1 NOT NULL,
	"duration_ms" integer,
	"audit_event_id" uuid,
	"audit_event_occurred_at" timestamp with time zone,
	"request_id" varchar(100),
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications"."notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid,
	"kind" "notifications"."notification_kind" NOT NULL,
	"title_key" varchar(160) NOT NULL,
	"body_key" varchar(160),
	"params" jsonb,
	"link_path" varchar(255),
	"entity_type" varchar(100),
	"entity_id" varchar(255),
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_link_check" CHECK ("notifications"."notifications"."link_path" is null or "notifications"."notifications"."link_path" like '/%')
);
--> statement-breakpoint
CREATE TABLE "notifications"."endpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"channel" "notifications"."notification_endpoint_channel" NOT NULL,
	"address_ciphertext" text NOT NULL,
	"address_hash" varchar(64) NOT NULL,
	"address_redacted" varchar(160) NOT NULL,
	"key_version" integer DEFAULT 1 NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"verified_at" timestamp with time zone,
	"disabled_reason" varchar(80),
	"disabled_at" timestamp with time zone,
	"last_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_endpoints_address_hash_check" CHECK ("notifications"."endpoints"."address_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "notification_endpoints_disabled_check" CHECK (("notifications"."endpoints"."disabled_at" is null and "notifications"."endpoints"."disabled_reason" is null) or ("notifications"."endpoints"."disabled_at" is not null and "notifications"."endpoints"."disabled_reason" is not null))
);
--> statement-breakpoint
ALTER TABLE "auth"."accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."device_grants" ADD CONSTRAINT "device_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."password_sign_in_attempts" ADD CONSTRAINT "password_sign_in_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."second_factor_challenges" ADD CONSTRAINT "second_factor_challenges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."second_factor_challenges" ADD CONSTRAINT "second_factor_challenges_session_token_fk" FOREIGN KEY ("session_token") REFERENCES "auth"."sessions"("session_token") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."user_second_factors" ADD CONSTRAINT "user_second_factors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."city_area_translations" ADD CONSTRAINT "city_area_translations_city_area_id_city_areas_id_fk" FOREIGN KEY ("city_area_id") REFERENCES "core"."city_areas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."city_area_translations" ADD CONSTRAINT "city_area_translations_language_code_languages_code_fk" FOREIGN KEY ("language_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."city_areas" ADD CONSTRAINT "city_areas_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "core"."cities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."city_translations" ADD CONSTRAINT "city_translations_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "core"."cities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."city_translations" ADD CONSTRAINT "city_translations_language_code_languages_code_fk" FOREIGN KEY ("language_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."languages" ADD CONSTRAINT "languages_fallback_code_languages_code_fk" FOREIGN KEY ("fallback_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications"."preferences" ADD CONSTRAINT "preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications"."preferences" ADD CONSTRAINT "preferences_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."user_settings" ADD CONSTRAINT "user_settings_preferred_language_code_languages_code_fk" FOREIGN KEY ("preferred_language_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."user_settings" ADD CONSTRAINT "user_settings_default_organization_id_organizations_id_fk" FOREIGN KEY ("default_organization_id") REFERENCES "core"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."user_settings" ADD CONSTRAINT "user_settings_default_city_id_cities_id_fk" FOREIGN KEY ("default_city_id") REFERENCES "core"."cities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."audience_category_translations" ADD CONSTRAINT "audience_category_translations_language_code_languages_code_fk" FOREIGN KEY ("language_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."audience_category_translations" ADD CONSTRAINT "audience_category_translations_audience_category_id_fk" FOREIGN KEY ("audience_category_id") REFERENCES "content"."audience_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."service_category_translations" ADD CONSTRAINT "service_category_translations_language_code_languages_code_fk" FOREIGN KEY ("language_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."service_category_translations" ADD CONSTRAINT "service_category_translations_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "content"."service_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."speciality_translations" ADD CONSTRAINT "speciality_translations_speciality_id_specialities_id_fk" FOREIGN KEY ("speciality_id") REFERENCES "content"."specialities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."speciality_translations" ADD CONSTRAINT "speciality_translations_language_code_languages_code_fk" FOREIGN KEY ("language_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."tag_translations" ADD CONSTRAINT "tag_translations_language_code_languages_code_fk" FOREIGN KEY ("language_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."tag_translations" ADD CONSTRAINT "tag_translations_tag_scope_fk" FOREIGN KEY ("tag_id","scope_key") REFERENCES "core"."tags"("id","scope_key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."tags" ADD CONSTRAINT "tags_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."contact_translations" ADD CONSTRAINT "contact_translations_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "content"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."contact_translations" ADD CONSTRAINT "contact_translations_language_code_languages_code_fk" FOREIGN KEY ("language_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."contacts" ADD CONSTRAINT "contacts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."organization_languages" ADD CONSTRAINT "organization_languages_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."organization_languages" ADD CONSTRAINT "organization_languages_language_code_languages_code_fk" FOREIGN KEY ("language_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."organization_profile_translations" ADD CONSTRAINT "organization_profile_translations_verified_by_id_users_id_fk" FOREIGN KEY ("verified_by_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."organization_profile_translations" ADD CONSTRAINT "organization_profile_translations_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "content"."organization_profiles"("organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."organization_profile_translations" ADD CONSTRAINT "organization_profile_translations_language_code_fk" FOREIGN KEY ("language_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."organization_profile_translations" ADD CONSTRAINT "organization_profile_translations_source_scope_fk" FOREIGN KEY ("source_version_id") REFERENCES "content"."translation_source_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."organization_profile_translations" ADD CONSTRAINT "organization_profile_translations_carried_source_scope_fk" FOREIGN KEY ("carried_forward_from_source_version_id") REFERENCES "content"."translation_source_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."organization_profiles" ADD CONSTRAINT "organization_profiles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."organization_profiles" ADD CONSTRAINT "organization_profiles_narrative_source_language_fk" FOREIGN KEY ("narrative_source_language") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."organization_specialities" ADD CONSTRAINT "organization_specialities_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."organization_specialities" ADD CONSTRAINT "organization_specialities_speciality_id_specialities_id_fk" FOREIGN KEY ("speciality_id") REFERENCES "content"."specialities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."speciality_change_items" ADD CONSTRAINT "speciality_change_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."speciality_change_items" ADD CONSTRAINT "speciality_change_items_speciality_id_specialities_id_fk" FOREIGN KEY ("speciality_id") REFERENCES "content"."specialities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."speciality_change_items" ADD CONSTRAINT "speciality_change_items_request_scope_fk" FOREIGN KEY ("request_id","organization_id") REFERENCES "content"."speciality_change_requests"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."speciality_change_requests" ADD CONSTRAINT "speciality_change_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."speciality_change_requests" ADD CONSTRAINT "speciality_change_requests_submitted_by_id_users_id_fk" FOREIGN KEY ("submitted_by_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."speciality_change_requests" ADD CONSTRAINT "speciality_change_requests_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."place_translations" ADD CONSTRAINT "place_translations_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "content"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."place_translations" ADD CONSTRAINT "place_translations_language_code_languages_code_fk" FOREIGN KEY ("language_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."places" ADD CONSTRAINT "places_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."places" ADD CONSTRAINT "places_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "core"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."places" ADD CONSTRAINT "places_city_area_id_city_areas_id_fk" FOREIGN KEY ("city_area_id") REFERENCES "core"."city_areas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."activities" ADD CONSTRAINT "activities_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."activities" ADD CONSTRAINT "activities_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "core"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."activities" ADD CONSTRAINT "activities_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "content"."places"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."activities" ADD CONSTRAINT "activities_category_id_service_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "content"."service_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."activities" ADD CONSTRAINT "activities_audience_category_id_audience_categories_id_fk" FOREIGN KEY ("audience_category_id") REFERENCES "content"."audience_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."activities" ADD CONSTRAINT "activities_source_language_code_languages_code_fk" FOREIGN KEY ("source_language_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."activities" ADD CONSTRAINT "activities_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."activities" ADD CONSTRAINT "activities_verified_by_id_users_id_fk" FOREIGN KEY ("verified_by_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."activities" ADD CONSTRAINT "activities_team_scope_fk" FOREIGN KEY ("team_id","organization_id") REFERENCES "core"."city_teams"("id","organization_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."activity_assets" ADD CONSTRAINT "activity_assets_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "content"."activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."activity_assets" ADD CONSTRAINT "activity_assets_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "content"."assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."activity_assets" ADD CONSTRAINT "activity_assets_language_code_languages_code_fk" FOREIGN KEY ("language_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."activity_audience_translations" ADD CONSTRAINT "activity_audience_translations_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "content"."activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."activity_audience_translations" ADD CONSTRAINT "activity_audience_translations_language_code_languages_code_fk" FOREIGN KEY ("language_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."activity_claim_requests" ADD CONSTRAINT "activity_claim_requests_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "content"."activities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."activity_claim_requests" ADD CONSTRAINT "activity_claim_requests_requested_by_id_users_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."activity_claim_requests" ADD CONSTRAINT "activity_claim_requests_decided_by_id_users_id_fk" FOREIGN KEY ("decided_by_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."activity_claim_requests" ADD CONSTRAINT "activity_claim_requests_destination_organization_id_fk" FOREIGN KEY ("destination_organization_id") REFERENCES "core"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."activity_claim_requests" ADD CONSTRAINT "activity_claim_requests_previous_organization_id_fk" FOREIGN KEY ("previous_organization_id") REFERENCES "core"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."activity_claim_requests" ADD CONSTRAINT "activity_claim_requests_destination_team_scope_fk" FOREIGN KEY ("destination_team_id","destination_organization_id") REFERENCES "core"."city_teams"("id","organization_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."activity_claim_requests" ADD CONSTRAINT "activity_claim_requests_previous_team_scope_fk" FOREIGN KEY ("previous_team_id","previous_organization_id") REFERENCES "core"."city_teams"("id","organization_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."activity_claim_requests" ADD CONSTRAINT "activity_claim_requests_representative_scope_fk" FOREIGN KEY ("representative_member_id","destination_organization_id") REFERENCES "core"."organization_members"("id","organization_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."activity_contacts" ADD CONSTRAINT "activity_contacts_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "content"."activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."activity_contacts" ADD CONSTRAINT "activity_contacts_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "content"."contacts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."activity_creator_organizations" ADD CONSTRAINT "activity_creator_organizations_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "content"."activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."activity_creator_organizations" ADD CONSTRAINT "activity_creator_organizations_proposed_by_id_users_id_fk" FOREIGN KEY ("proposed_by_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."activity_creator_organizations" ADD CONSTRAINT "activity_creator_organizations_confirmed_by_id_users_id_fk" FOREIGN KEY ("confirmed_by_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."activity_creator_organizations" ADD CONSTRAINT "activity_creator_organizations_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."activity_custody_events" ADD CONSTRAINT "activity_custody_events_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "content"."activities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."activity_custody_events" ADD CONSTRAINT "activity_custody_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."activity_custody_events" ADD CONSTRAINT "activity_custody_events_new_organization_id_organizations_id_fk" FOREIGN KEY ("new_organization_id") REFERENCES "core"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."activity_custody_events" ADD CONSTRAINT "activity_custody_events_claim_request_id_fk" FOREIGN KEY ("claim_request_id") REFERENCES "content"."activity_claim_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."activity_custody_events" ADD CONSTRAINT "activity_custody_events_previous_organization_id_fk" FOREIGN KEY ("previous_organization_id") REFERENCES "core"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."activity_custody_events" ADD CONSTRAINT "activity_custody_events_previous_team_scope_fk" FOREIGN KEY ("previous_team_id","previous_organization_id") REFERENCES "core"."city_teams"("id","organization_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."activity_custody_events" ADD CONSTRAINT "activity_custody_events_new_team_scope_fk" FOREIGN KEY ("new_team_id","new_organization_id") REFERENCES "core"."city_teams"("id","organization_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."activity_member_assignments" ADD CONSTRAINT "activity_member_assignments_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "content"."activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."activity_member_assignments" ADD CONSTRAINT "activity_member_assignments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."activity_member_assignments" ADD CONSTRAINT "activity_member_assignments_member_scope_fk" FOREIGN KEY ("member_id","organization_id") REFERENCES "core"."organization_members"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."activity_occurrence_confirmations" ADD CONSTRAINT "activity_occurrence_confirmations_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "content"."activities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."activity_occurrence_confirmations" ADD CONSTRAINT "activity_occurrence_confirmations_confirmed_by_id_users_id_fk" FOREIGN KEY ("confirmed_by_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."activity_occurrence_confirmations" ADD CONSTRAINT "activity_occurrence_confirmations_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."activity_occurrence_confirmations" ADD CONSTRAINT "activity_occurrence_confirmations_provider_scope_fk" FOREIGN KEY ("activity_id","organization_id") REFERENCES "content"."activity_providers"("activity_id","organization_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."activity_providers" ADD CONSTRAINT "activity_providers_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "content"."activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."activity_providers" ADD CONSTRAINT "activity_providers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."activity_providers" ADD CONSTRAINT "activity_providers_proposed_by_id_users_id_fk" FOREIGN KEY ("proposed_by_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."activity_providers" ADD CONSTRAINT "activity_providers_confirmed_by_id_users_id_fk" FOREIGN KEY ("confirmed_by_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."activity_publications" ADD CONSTRAINT "activity_publications_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "content"."activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."activity_publications" ADD CONSTRAINT "activity_publications_language_code_languages_code_fk" FOREIGN KEY ("language_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."activity_publications" ADD CONSTRAINT "activity_publications_published_by_id_users_id_fk" FOREIGN KEY ("published_by_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."activity_publications" ADD CONSTRAINT "activity_publications_unpublished_by_id_users_id_fk" FOREIGN KEY ("unpublished_by_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."activity_publications" ADD CONSTRAINT "activity_publications_source_scope_fk" FOREIGN KEY ("source_version_id") REFERENCES "content"."translation_source_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."activity_services" ADD CONSTRAINT "activity_services_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "content"."activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."activity_services" ADD CONSTRAINT "activity_services_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "content"."services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."activity_tags" ADD CONSTRAINT "activity_tags_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "content"."activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."activity_tags" ADD CONSTRAINT "activity_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "core"."tags"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."activity_transit_links" ADD CONSTRAINT "activity_transit_links_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "content"."activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."activity_translations" ADD CONSTRAINT "activity_translations_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "content"."activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."activity_translations" ADD CONSTRAINT "activity_translations_language_code_languages_code_fk" FOREIGN KEY ("language_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."activity_translations" ADD CONSTRAINT "activity_translations_review_requested_by_id_users_id_fk" FOREIGN KEY ("review_requested_by_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."activity_translations" ADD CONSTRAINT "activity_translations_team_validated_by_id_users_id_fk" FOREIGN KEY ("team_validated_by_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."activity_translations" ADD CONSTRAINT "activity_translations_verified_by_id_users_id_fk" FOREIGN KEY ("verified_by_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."activity_translations" ADD CONSTRAINT "activity_translations_source_scope_fk" FOREIGN KEY ("source_version_id") REFERENCES "content"."translation_source_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."activity_translations" ADD CONSTRAINT "activity_translations_carried_source_scope_fk" FOREIGN KEY ("carried_forward_from_source_version_id") REFERENCES "content"."translation_source_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."activity_verifications" ADD CONSTRAINT "activity_verifications_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "content"."activities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."activity_verifications" ADD CONSTRAINT "activity_verifications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."activity_verifications" ADD CONSTRAINT "activity_verifications_verified_by_id_users_id_fk" FOREIGN KEY ("verified_by_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."activity_verifications" ADD CONSTRAINT "activity_verifications_provider_scope_fk" FOREIGN KEY ("activity_id","organization_id") REFERENCES "content"."activity_providers"("activity_id","organization_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."activity_verifications" ADD CONSTRAINT "activity_verifications_member_scope_fk" FOREIGN KEY ("verified_by_member_id","organization_id") REFERENCES "core"."organization_members"("id","organization_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."activity_verifications" ADD CONSTRAINT "activity_verifications_source_scope_fk" FOREIGN KEY ("source_version_id") REFERENCES "content"."translation_source_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."city_team_members" ADD CONSTRAINT "city_team_members_team_id_city_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "core"."city_teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."city_team_members" ADD CONSTRAINT "city_team_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."city_team_members" ADD CONSTRAINT "city_team_members_team_scope_fk" FOREIGN KEY ("team_id","organization_id") REFERENCES "core"."city_teams"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."city_team_members" ADD CONSTRAINT "city_team_members_member_scope_fk" FOREIGN KEY ("member_id","organization_id") REFERENCES "core"."organization_members"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."city_teams" ADD CONSTRAINT "city_teams_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."city_teams" ADD CONSTRAINT "city_teams_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "core"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."schedule_exception_translations" ADD CONSTRAINT "schedule_exception_translations_language_code_languages_code_fk" FOREIGN KEY ("language_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."schedule_exception_translations" ADD CONSTRAINT "schedule_exception_translations_exception_id_fk" FOREIGN KEY ("exception_id") REFERENCES "content"."schedule_exceptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."schedule_exceptions" ADD CONSTRAINT "schedule_exceptions_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "content"."activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."schedule_exceptions" ADD CONSTRAINT "schedule_exceptions_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."schedule_rules" ADD CONSTRAINT "schedule_rules_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "content"."activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."service_translations" ADD CONSTRAINT "service_translations_language_code_languages_code_fk" FOREIGN KEY ("language_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."service_translations" ADD CONSTRAINT "service_translations_service_scope_fk" FOREIGN KEY ("service_id","scope_key") REFERENCES "content"."services"("id","scope_key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."services" ADD CONSTRAINT "services_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."services" ADD CONSTRAINT "services_category_id_service_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "content"."service_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."translator_languages" ADD CONSTRAINT "translator_languages_translator_id_translators_id_fk" FOREIGN KEY ("translator_id") REFERENCES "core"."translators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."translator_languages" ADD CONSTRAINT "translator_languages_language_code_languages_code_fk" FOREIGN KEY ("language_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."translators" ADD CONSTRAINT "translators_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."translators" ADD CONSTRAINT "translators_owner_organization_id_organizations_id_fk" FOREIGN KEY ("owner_organization_id") REFERENCES "core"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."invitation_roles" ADD CONSTRAINT "invitation_roles_invitation_id_invitations_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "core"."invitations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."invitation_roles" ADD CONSTRAINT "invitation_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "core"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."invitations" ADD CONSTRAINT "invitations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."invitations" ADD CONSTRAINT "invitations_invited_by_id_users_id_fk" FOREIGN KEY ("invited_by_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."invitations" ADD CONSTRAINT "invitations_invited_by_member_id_organization_members_id_fk" FOREIGN KEY ("invited_by_member_id") REFERENCES "core"."organization_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."invitations" ADD CONSTRAINT "invitations_translator_id_translators_id_fk" FOREIGN KEY ("translator_id") REFERENCES "core"."translators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."invitations" ADD CONSTRAINT "invitations_accepted_member_id_organization_members_id_fk" FOREIGN KEY ("accepted_member_id") REFERENCES "core"."organization_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."legal_acceptances" ADD CONSTRAINT "legal_acceptances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."legal_acceptances" ADD CONSTRAINT "legal_acceptances_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."legal_acceptances" ADD CONSTRAINT "legal_acceptances_legal_document_id_legal_documents_id_fk" FOREIGN KEY ("legal_document_id") REFERENCES "core"."legal_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."legal_documents" ADD CONSTRAINT "legal_documents_language_code_languages_code_fk" FOREIGN KEY ("language_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."member_languages" ADD CONSTRAINT "member_languages_member_id_organization_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "core"."organization_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."member_languages" ADD CONSTRAINT "member_languages_language_code_languages_code_fk" FOREIGN KEY ("language_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."member_roles" ADD CONSTRAINT "member_roles_member_id_organization_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "core"."organization_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."member_roles" ADD CONSTRAINT "member_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "core"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."member_roles" ADD CONSTRAINT "member_roles_granted_by_id_users_id_fk" FOREIGN KEY ("granted_by_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."organization_members" ADD CONSTRAINT "organization_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."organization_members" ADD CONSTRAINT "organization_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."organization_verifications" ADD CONSTRAINT "organization_verifications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."organization_verifications" ADD CONSTRAINT "organization_verifications_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."permission_review_items" ADD CONSTRAINT "permission_review_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."permission_review_items" ADD CONSTRAINT "permission_review_items_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "core"."roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."permission_review_items" ADD CONSTRAINT "permission_review_items_decided_by_id_users_id_fk" FOREIGN KEY ("decided_by_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."permission_review_items" ADD CONSTRAINT "permission_review_items_review_scope_fk" FOREIGN KEY ("review_id","organization_id") REFERENCES "core"."permission_reviews"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."permission_review_items" ADD CONSTRAINT "permission_review_items_member_scope_fk" FOREIGN KEY ("member_id","organization_id") REFERENCES "core"."organization_members"("id","organization_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."permission_reviews" ADD CONSTRAINT "permission_reviews_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."permission_reviews" ADD CONSTRAINT "permission_reviews_completed_by_id_users_id_fk" FOREIGN KEY ("completed_by_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."permission_reviews" ADD CONSTRAINT "permission_reviews_assignee_scope_fk" FOREIGN KEY ("assigned_to_member_id","organization_id") REFERENCES "core"."organization_members"("id","organization_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "core"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."role_permissions" ADD CONSTRAINT "role_permissions_permission_code_permissions_code_fk" FOREIGN KEY ("permission_code") REFERENCES "core"."permissions"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."roles" ADD CONSTRAINT "roles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."user_platform_roles" ADD CONSTRAINT "user_platform_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."user_platform_roles" ADD CONSTRAINT "user_platform_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "core"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."user_platform_roles" ADD CONSTRAINT "user_platform_roles_granted_by_id_users_id_fk" FOREIGN KEY ("granted_by_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."asset_text_tracks" ADD CONSTRAINT "asset_text_tracks_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "content"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."asset_text_tracks" ADD CONSTRAINT "asset_text_tracks_language_code_languages_code_fk" FOREIGN KEY ("language_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."asset_translations" ADD CONSTRAINT "asset_translations_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "content"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."asset_translations" ADD CONSTRAINT "asset_translations_language_code_languages_code_fk" FOREIGN KEY ("language_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."asset_variants" ADD CONSTRAINT "asset_variants_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "content"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."assets" ADD CONSTRAINT "assets_uploader_id_users_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."assets" ADD CONSTRAINT "assets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."assets" ADD CONSTRAINT "assets_language_code_languages_code_fk" FOREIGN KEY ("language_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."download_translations" ADD CONSTRAINT "download_translations_download_id_downloads_id_fk" FOREIGN KEY ("download_id") REFERENCES "content"."downloads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."download_translations" ADD CONSTRAINT "download_translations_language_code_languages_code_fk" FOREIGN KEY ("language_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."downloads" ADD CONSTRAINT "downloads_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "content"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."downloads" ADD CONSTRAINT "downloads_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations"."training_courses" ADD CONSTRAINT "training_courses_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations"."training_courses" ADD CONSTRAINT "training_courses_source_language_code_languages_code_fk" FOREIGN KEY ("source_language_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations"."training_courses" ADD CONSTRAINT "training_courses_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations"."training_records" ADD CONSTRAINT "training_records_course_id_training_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "operations"."training_courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations"."training_records" ADD CONSTRAINT "training_records_member_id_organization_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "core"."organization_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations"."training_records" ADD CONSTRAINT "training_records_translator_id_translators_id_fk" FOREIGN KEY ("translator_id") REFERENCES "core"."translators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations"."training_records" ADD CONSTRAINT "training_records_verified_by_id_users_id_fk" FOREIGN KEY ("verified_by_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations"."requirement_items" ADD CONSTRAINT "requirement_items_set_id_requirement_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "operations"."requirement_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations"."requirement_items" ADD CONSTRAINT "requirement_items_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "operations"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations"."requirement_items" ADD CONSTRAINT "requirement_items_course_id_training_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "operations"."training_courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations"."requirement_items" ADD CONSTRAINT "requirement_items_language_code_languages_code_fk" FOREIGN KEY ("language_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations"."requirement_sets" ADD CONSTRAINT "requirement_sets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations"."requirement_sets" ADD CONSTRAINT "requirement_sets_source_language_code_languages_code_fk" FOREIGN KEY ("source_language_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations"."requirement_sets" ADD CONSTRAINT "requirement_sets_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations"."skill_records" ADD CONSTRAINT "skill_records_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "operations"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations"."skill_records" ADD CONSTRAINT "skill_records_member_id_organization_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "core"."organization_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations"."skill_records" ADD CONSTRAINT "skill_records_translator_id_translators_id_fk" FOREIGN KEY ("translator_id") REFERENCES "core"."translators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations"."skill_records" ADD CONSTRAINT "skill_records_verified_by_id_users_id_fk" FOREIGN KEY ("verified_by_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations"."skills" ADD CONSTRAINT "skills_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations"."skills" ADD CONSTRAINT "skills_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."article_details" ADD CONSTRAINT "article_details_entry_id_editorial_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "content"."editorial_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."basic_information_details" ADD CONSTRAINT "basic_information_details_entry_id_editorial_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "content"."editorial_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."basic_information_details" ADD CONSTRAINT "basic_information_details_category_id_service_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "content"."service_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_custodianships" ADD CONSTRAINT "editorial_custodianships_entry_id_editorial_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "content"."editorial_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_custodianships" ADD CONSTRAINT "editorial_custodianships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_custodianships" ADD CONSTRAINT "editorial_custodianships_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_custody_transfer_events" ADD CONSTRAINT "editorial_custody_transfer_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_custody_transfer_events" ADD CONSTRAINT "editorial_custody_transfer_events_entry_fk" FOREIGN KEY ("entry_id") REFERENCES "content"."editorial_entries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_custody_transfer_events" ADD CONSTRAINT "editorial_custody_transfer_events_request_fk" FOREIGN KEY ("transfer_request_id") REFERENCES "content"."editorial_custody_transfer_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_custody_transfer_events" ADD CONSTRAINT "editorial_custody_transfer_events_prev_org_fk" FOREIGN KEY ("previous_organization_id") REFERENCES "core"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_custody_transfer_events" ADD CONSTRAINT "editorial_custody_transfer_events_new_org_fk" FOREIGN KEY ("new_organization_id") REFERENCES "core"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_custody_transfer_requests" ADD CONSTRAINT "editorial_custody_transfer_requests_requested_by_id_users_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_custody_transfer_requests" ADD CONSTRAINT "editorial_custody_transfer_requests_decided_by_id_users_id_fk" FOREIGN KEY ("decided_by_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_custody_transfer_requests" ADD CONSTRAINT "editorial_custody_transfer_requests_entry_fk" FOREIGN KEY ("entry_id") REFERENCES "content"."editorial_entries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_custody_transfer_requests" ADD CONSTRAINT "editorial_custody_transfer_requests_dest_org_fk" FOREIGN KEY ("destination_organization_id") REFERENCES "core"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_custody_transfer_requests" ADD CONSTRAINT "editorial_custody_transfer_requests_prev_org_fk" FOREIGN KEY ("previous_organization_id") REFERENCES "core"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_entries" ADD CONSTRAINT "editorial_entries_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "core"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_entry_assets" ADD CONSTRAINT "editorial_entry_assets_entry_id_editorial_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "content"."editorial_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_entry_assets" ADD CONSTRAINT "editorial_entry_assets_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "content"."assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_entry_routes" ADD CONSTRAINT "editorial_entry_routes_entry_id_editorial_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "content"."editorial_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_entry_routes" ADD CONSTRAINT "editorial_entry_routes_language_code_languages_code_fk" FOREIGN KEY ("language_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_entry_tags" ADD CONSTRAINT "editorial_entry_tags_entry_id_editorial_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "content"."editorial_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_entry_tags" ADD CONSTRAINT "editorial_entry_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "core"."tags"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_publications" ADD CONSTRAINT "editorial_publications_entry_id_editorial_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "content"."editorial_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_publications" ADD CONSTRAINT "editorial_publications_language_code_languages_code_fk" FOREIGN KEY ("language_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_publications" ADD CONSTRAINT "editorial_publications_revision_id_editorial_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "content"."editorial_revisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_publications" ADD CONSTRAINT "editorial_publications_published_by_id_users_id_fk" FOREIGN KEY ("published_by_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_publications" ADD CONSTRAINT "editorial_publications_unpublished_by_id_users_id_fk" FOREIGN KEY ("unpublished_by_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_publications" ADD CONSTRAINT "editorial_publications_source_scope_fk" FOREIGN KEY ("source_version_id") REFERENCES "content"."translation_source_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_related_contacts" ADD CONSTRAINT "editorial_related_contacts_entry_id_editorial_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "content"."editorial_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_related_contacts" ADD CONSTRAINT "editorial_related_contacts_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "content"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_related_entries" ADD CONSTRAINT "editorial_related_entries_entry_id_editorial_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "content"."editorial_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_related_entries" ADD CONSTRAINT "editorial_related_entries_related_entry_id_fk" FOREIGN KEY ("related_entry_id") REFERENCES "content"."editorial_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_related_organizations" ADD CONSTRAINT "editorial_related_organizations_entry_id_fk" FOREIGN KEY ("entry_id") REFERENCES "content"."editorial_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_related_organizations" ADD CONSTRAINT "editorial_related_organizations_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_related_services" ADD CONSTRAINT "editorial_related_services_entry_id_editorial_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "content"."editorial_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_related_services" ADD CONSTRAINT "editorial_related_services_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "content"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_revision_assets" ADD CONSTRAINT "editorial_revision_assets_revision_id_editorial_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "content"."editorial_revisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_revision_assets" ADD CONSTRAINT "editorial_revision_assets_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "content"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_revision_assets" ADD CONSTRAINT "editorial_revision_assets_language_code_languages_code_fk" FOREIGN KEY ("language_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_revision_organizations" ADD CONSTRAINT "editorial_revision_organizations_revision_id_fk" FOREIGN KEY ("revision_id") REFERENCES "content"."editorial_revisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_revision_organizations" ADD CONSTRAINT "editorial_revision_organizations_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_revision_sources" ADD CONSTRAINT "editorial_revision_sources_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "content"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_revision_sources" ADD CONSTRAINT "editorial_revision_sources_revision_id_fk" FOREIGN KEY ("revision_id") REFERENCES "content"."editorial_revisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_revision_translations" ADD CONSTRAINT "editorial_revision_translations_language_code_languages_code_fk" FOREIGN KEY ("language_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_revision_translations" ADD CONSTRAINT "editorial_revision_translations_verified_by_id_users_id_fk" FOREIGN KEY ("verified_by_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_revision_translations" ADD CONSTRAINT "editorial_revision_translations_revision_id_fk" FOREIGN KEY ("revision_id") REFERENCES "content"."editorial_revisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_revision_translations" ADD CONSTRAINT "editorial_revision_translations_source_version_id_fk" FOREIGN KEY ("source_version_id") REFERENCES "content"."translation_source_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_revision_translations" ADD CONSTRAINT "editorial_revision_translations_carried_forward_fk" FOREIGN KEY ("carried_forward_from_revision_id") REFERENCES "content"."editorial_revisions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_revision_translations" ADD CONSTRAINT "editorial_revision_translations_review_requested_by_id_fk" FOREIGN KEY ("review_requested_by_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_revision_translations" ADD CONSTRAINT "editorial_revision_translations_team_validated_by_id_fk" FOREIGN KEY ("team_validated_by_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_revisions" ADD CONSTRAINT "editorial_revisions_entry_id_editorial_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "content"."editorial_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_revisions" ADD CONSTRAINT "editorial_revisions_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_revisions" ADD CONSTRAINT "editorial_revisions_source_language_code_languages_code_fk" FOREIGN KEY ("source_language_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."fixed_information_details" ADD CONSTRAINT "fixed_information_details_entry_id_editorial_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "content"."editorial_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."review_tasks" ADD CONSTRAINT "review_tasks_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."translation_jobs" ADD CONSTRAINT "translation_jobs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."translation_jobs" ADD CONSTRAINT "translation_jobs_target_language_code_languages_code_fk" FOREIGN KEY ("target_language_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."translation_jobs" ADD CONSTRAINT "translation_jobs_requested_by_id_users_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."translation_jobs" ADD CONSTRAINT "translation_jobs_source_scope_fk" FOREIGN KEY ("source_version_id") REFERENCES "content"."translation_source_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."translation_source_versions" ADD CONSTRAINT "translation_source_versions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."translation_source_versions" ADD CONSTRAINT "translation_source_versions_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."translation_source_versions" ADD CONSTRAINT "translation_source_versions_previous_version_id_fk" FOREIGN KEY ("previous_version_id") REFERENCES "content"."translation_source_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."translation_source_versions" ADD CONSTRAINT "translation_source_versions_source_language_code_fk" FOREIGN KEY ("source_language_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."translation_assignment_events" ADD CONSTRAINT "translation_assignment_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."translation_assignment_events" ADD CONSTRAINT "translation_assignment_events_assignment_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "content"."translation_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."translation_assignments" ADD CONSTRAINT "translation_assignments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."translation_assignments" ADD CONSTRAINT "translation_assignments_target_language_code_languages_code_fk" FOREIGN KEY ("target_language_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."translation_assignments" ADD CONSTRAINT "translation_assignments_translator_id_translators_id_fk" FOREIGN KEY ("translator_id") REFERENCES "core"."translators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."translation_assignments" ADD CONSTRAINT "translation_assignments_assigned_by_id_users_id_fk" FOREIGN KEY ("assigned_by_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."translation_assignments" ADD CONSTRAINT "translation_assignments_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."translation_assignments" ADD CONSTRAINT "translation_assignments_promoted_by_id_users_id_fk" FOREIGN KEY ("promoted_by_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."translation_assignments" ADD CONSTRAINT "translation_assignments_published_by_id_users_id_fk" FOREIGN KEY ("published_by_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."translation_assignments" ADD CONSTRAINT "translation_assignments_source_scope_fk" FOREIGN KEY ("source_version_id") REFERENCES "content"."translation_source_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."public_event_audience_translations" ADD CONSTRAINT "public_event_audience_translations_event_id_public_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "content"."public_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."public_event_audience_translations" ADD CONSTRAINT "public_event_audience_translations_language_code_fk" FOREIGN KEY ("language_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."public_event_occurrence_translations" ADD CONSTRAINT "public_event_occurrence_translations_occurrence_id_fk" FOREIGN KEY ("occurrence_id") REFERENCES "content"."public_event_occurrences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."public_event_occurrence_translations" ADD CONSTRAINT "public_event_occurrence_translations_language_code_fk" FOREIGN KEY ("language_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."public_event_occurrences" ADD CONSTRAINT "public_event_occurrences_event_id_public_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "content"."public_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."public_event_occurrences" ADD CONSTRAINT "public_event_occurrences_series_id_public_event_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "content"."public_event_series"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."public_event_providers" ADD CONSTRAINT "public_event_providers_event_id_public_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "content"."public_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."public_event_providers" ADD CONSTRAINT "public_event_providers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."public_event_publications" ADD CONSTRAINT "public_event_publications_event_id_public_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "content"."public_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."public_event_publications" ADD CONSTRAINT "public_event_publications_language_code_languages_code_fk" FOREIGN KEY ("language_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."public_event_publications" ADD CONSTRAINT "public_event_publications_published_by_id_users_id_fk" FOREIGN KEY ("published_by_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."public_event_publications" ADD CONSTRAINT "public_event_publications_unpublished_by_id_users_id_fk" FOREIGN KEY ("unpublished_by_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."public_event_publications" ADD CONSTRAINT "public_event_publications_source_scope_fk" FOREIGN KEY ("source_version_id") REFERENCES "content"."translation_source_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."public_event_series" ADD CONSTRAINT "public_event_series_event_id_public_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "content"."public_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."public_event_services" ADD CONSTRAINT "public_event_services_event_id_public_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "content"."public_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."public_event_services" ADD CONSTRAINT "public_event_services_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "content"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."public_event_translations" ADD CONSTRAINT "public_event_translations_event_id_public_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "content"."public_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."public_event_translations" ADD CONSTRAINT "public_event_translations_language_code_languages_code_fk" FOREIGN KEY ("language_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."public_event_translations" ADD CONSTRAINT "public_event_translations_verified_by_id_users_id_fk" FOREIGN KEY ("verified_by_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."public_event_translations" ADD CONSTRAINT "public_event_translations_source_scope_fk" FOREIGN KEY ("source_version_id") REFERENCES "content"."translation_source_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."public_event_translations" ADD CONSTRAINT "public_event_translations_carried_source_scope_fk" FOREIGN KEY ("carried_forward_from_source_version_id") REFERENCES "content"."translation_source_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."public_events" ADD CONSTRAINT "public_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."public_events" ADD CONSTRAINT "public_events_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "content"."places"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."public_events" ADD CONSTRAINT "public_events_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "core"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."public_events" ADD CONSTRAINT "public_events_category_id_service_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "content"."service_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."public_events" ADD CONSTRAINT "public_events_audience_category_id_audience_categories_id_fk" FOREIGN KEY ("audience_category_id") REFERENCES "content"."audience_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."public_events" ADD CONSTRAINT "public_events_source_language_code_languages_code_fk" FOREIGN KEY ("source_language_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."public_events" ADD CONSTRAINT "public_events_verified_by_id_users_id_fk" FOREIGN KEY ("verified_by_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations"."coordination_event_assets" ADD CONSTRAINT "coordination_event_assets_event_id_coordination_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "operations"."coordination_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations"."coordination_event_assets" ADD CONSTRAINT "coordination_event_assets_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "content"."assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations"."coordination_event_assets" ADD CONSTRAINT "coordination_event_assets_language_code_languages_code_fk" FOREIGN KEY ("language_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations"."coordination_event_occurrence_translations" ADD CONSTRAINT "coordination_event_occurrence_translations_occ_fk" FOREIGN KEY ("occurrence_id") REFERENCES "operations"."coordination_event_occurrences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations"."coordination_event_occurrence_translations" ADD CONSTRAINT "coordination_event_occurrence_translations_lang_fk" FOREIGN KEY ("language_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations"."coordination_event_occurrences" ADD CONSTRAINT "coordination_event_occurrences_event_fk" FOREIGN KEY ("event_id") REFERENCES "operations"."coordination_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations"."coordination_event_occurrences" ADD CONSTRAINT "coordination_event_occurrences_series_fk" FOREIGN KEY ("series_id") REFERENCES "operations"."coordination_event_series"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations"."coordination_event_participation" ADD CONSTRAINT "coordination_event_participation_event_fk" FOREIGN KEY ("event_id") REFERENCES "operations"."coordination_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations"."coordination_event_participation" ADD CONSTRAINT "coordination_event_participation_org_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations"."coordination_event_participation" ADD CONSTRAINT "coordination_event_participation_occurrence_fk" FOREIGN KEY ("occurrence_id") REFERENCES "operations"."coordination_event_occurrences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations"."coordination_event_participation" ADD CONSTRAINT "coordination_event_participation_member_scope_fk" FOREIGN KEY ("member_id","organization_id") REFERENCES "core"."organization_members"("id","organization_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations"."coordination_event_series" ADD CONSTRAINT "coordination_event_series_event_id_coordination_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "operations"."coordination_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations"."coordination_event_transit_links" ADD CONSTRAINT "coordination_event_transit_links_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "operations"."coordination_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations"."coordination_event_translations" ADD CONSTRAINT "coordination_event_translations_language_code_languages_code_fk" FOREIGN KEY ("language_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations"."coordination_event_translations" ADD CONSTRAINT "coordination_event_translations_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "operations"."coordination_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations"."coordination_events" ADD CONSTRAINT "coordination_events_host_organization_id_organizations_id_fk" FOREIGN KEY ("host_organization_id") REFERENCES "core"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations"."coordination_events" ADD CONSTRAINT "coordination_events_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "core"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations"."coordination_events" ADD CONSTRAINT "coordination_events_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "content"."places"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations"."coordination_events" ADD CONSTRAINT "coordination_events_source_language_code_languages_code_fk" FOREIGN KEY ("source_language_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations"."coordination_events" ADD CONSTRAINT "coordination_events_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."search_concept_aliases" ADD CONSTRAINT "search_concept_aliases_concept_id_search_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "content"."search_concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."search_concept_aliases" ADD CONSTRAINT "search_concept_aliases_language_code_languages_code_fk" FOREIGN KEY ("language_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."search_concept_translations" ADD CONSTRAINT "search_concept_translations_concept_id_search_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "content"."search_concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."search_concept_translations" ADD CONSTRAINT "search_concept_translations_language_code_languages_code_fk" FOREIGN KEY ("language_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."search_concepts" ADD CONSTRAINT "search_concepts_category_id_service_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "content"."service_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."service_search_concepts" ADD CONSTRAINT "service_search_concepts_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "content"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."service_search_concepts" ADD CONSTRAINT "service_search_concepts_concept_id_search_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "content"."search_concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."service_search_concepts" ADD CONSTRAINT "service_search_concepts_verified_by_id_users_id_fk" FOREIGN KEY ("verified_by_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulator"."edges" ADD CONSTRAINT "edges_version_id_flow_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "simulator"."flow_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulator"."edges" ADD CONSTRAINT "edges_from_node_id_nodes_id_fk" FOREIGN KEY ("from_node_id") REFERENCES "simulator"."nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulator"."edges" ADD CONSTRAINT "edges_option_id_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "simulator"."options"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulator"."edges" ADD CONSTRAINT "edges_to_node_id_nodes_id_fk" FOREIGN KEY ("to_node_id") REFERENCES "simulator"."nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulator"."flow_versions" ADD CONSTRAINT "flow_versions_flow_id_flows_id_fk" FOREIGN KEY ("flow_id") REFERENCES "simulator"."flows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulator"."flow_versions" ADD CONSTRAINT "flow_versions_source_language_code_languages_code_fk" FOREIGN KEY ("source_language_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulator"."flows" ADD CONSTRAINT "flows_owner_organization_id_organizations_id_fk" FOREIGN KEY ("owner_organization_id") REFERENCES "core"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulator"."flows" ADD CONSTRAINT "flows_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "core"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulator"."flows" ADD CONSTRAINT "flows_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulator"."node_sources" ADD CONSTRAINT "node_sources_node_id_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "simulator"."nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulator"."node_sources" ADD CONSTRAINT "node_sources_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "content"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulator"."node_translations" ADD CONSTRAINT "node_translations_node_id_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "simulator"."nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulator"."node_translations" ADD CONSTRAINT "node_translations_language_code_languages_code_fk" FOREIGN KEY ("language_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulator"."nodes" ADD CONSTRAINT "nodes_version_id_flow_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "simulator"."flow_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulator"."option_translations" ADD CONSTRAINT "option_translations_option_id_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "simulator"."options"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulator"."option_translations" ADD CONSTRAINT "option_translations_language_code_languages_code_fk" FOREIGN KEY ("language_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulator"."options" ADD CONSTRAINT "options_node_id_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "simulator"."nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulator"."result_contacts" ADD CONSTRAINT "result_contacts_node_id_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "simulator"."nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulator"."result_contacts" ADD CONSTRAINT "result_contacts_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "content"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulator"."result_editorial_entries" ADD CONSTRAINT "result_editorial_entries_node_id_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "simulator"."nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulator"."result_editorial_entries" ADD CONSTRAINT "result_editorial_entries_entry_id_editorial_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "content"."editorial_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulator"."result_organizations" ADD CONSTRAINT "result_organizations_node_id_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "simulator"."nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulator"."result_organizations" ADD CONSTRAINT "result_organizations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulator"."result_services" ADD CONSTRAINT "result_services_node_id_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "simulator"."nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulator"."result_services" ADD CONSTRAINT "result_services_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "content"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulator"."version_publications" ADD CONSTRAINT "version_publications_flow_id_flows_id_fk" FOREIGN KEY ("flow_id") REFERENCES "simulator"."flows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulator"."version_publications" ADD CONSTRAINT "version_publications_version_id_flow_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "simulator"."flow_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulator"."version_publications" ADD CONSTRAINT "version_publications_published_by_id_users_id_fk" FOREIGN KEY ("published_by_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."moderation_cases" ADD CONSTRAINT "moderation_cases_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."moderation_cases" ADD CONSTRAINT "moderation_cases_related_organization_id_organizations_id_fk" FOREIGN KEY ("related_organization_id") REFERENCES "core"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."moderation_cases" ADD CONSTRAINT "moderation_cases_reported_by_id_users_id_fk" FOREIGN KEY ("reported_by_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."moderation_cases" ADD CONSTRAINT "moderation_cases_assigned_to_id_users_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."moderation_cases" ADD CONSTRAINT "moderation_cases_resolved_by_id_users_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."moderation_cases" ADD CONSTRAINT "moderation_cases_reporter_org_fk" FOREIGN KEY ("reported_by_organization_id") REFERENCES "core"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."moderation_events" ADD CONSTRAINT "moderation_events_case_id_moderation_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "core"."moderation_cases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."moderation_events" ADD CONSTRAINT "moderation_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit"."events" ADD CONSTRAINT "events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit"."events" ADD CONSTRAINT "events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit"."events" ADD CONSTRAINT "events_actor_member_id_organization_members_id_fk" FOREIGN KEY ("actor_member_id") REFERENCES "core"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications"."delivery_attempts" ADD CONSTRAINT "delivery_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications"."delivery_attempts" ADD CONSTRAINT "delivery_attempts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications"."delivery_attempts" ADD CONSTRAINT "delivery_attempts_audit_event_fk" FOREIGN KEY ("audit_event_id","audit_event_occurred_at") REFERENCES "audit"."events"("id","occurred_at") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications"."notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications"."notifications" ADD CONSTRAINT "notifications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications"."endpoints" ADD CONSTRAINT "endpoints_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_user_id_idx" ON "auth"."accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "device_grants_user_created_idx" ON "auth"."device_grants" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "password_reset_tokens_user_created_idx" ON "auth"."password_reset_tokens" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "password_attempts_identifier_time_idx" ON "auth"."password_sign_in_attempts" USING btree ("identifier_hash","attempted_at");--> statement-breakpoint
CREATE INDEX "second_factor_challenges_user_created_idx" ON "auth"."second_factor_challenges" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "second_factor_challenges_session_idx" ON "auth"."second_factor_challenges" USING btree ("session_token");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "auth"."sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_normalized_email_uq" ON "auth"."users" USING btree (lower(btrim("email")));--> statement-breakpoint
CREATE UNIQUE INDEX "city_areas_city_code_uq" ON "core"."city_areas" USING btree ("city_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_preferences_account_kind_uq" ON "notifications"."preferences" USING btree ("user_id","kind") WHERE "notifications"."preferences"."organization_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_preferences_org_kind_uq" ON "notifications"."preferences" USING btree ("user_id","organization_id","kind") WHERE "notifications"."preferences"."organization_id" is not null;--> statement-breakpoint
CREATE INDEX "notification_preferences_user_idx" ON "notifications"."preferences" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "service_category_translations_language_label_uq" ON "content"."service_category_translations" USING btree ("language_code",lower(regexp_replace(btrim("label"), '[[:space:]]+', ' ', 'g')));--> statement-breakpoint
CREATE UNIQUE INDEX "tag_translations_scope_language_label_uq" ON "core"."tag_translations" USING btree ("scope_key","language_code",lower(regexp_replace(btrim("label"), '[[:space:]]+', ' ', 'g')));--> statement-breakpoint
CREATE UNIQUE INDEX "tags_scope_namespace_code_uq" ON "core"."tags" USING btree (coalesce("organization_id"::text, ''),"namespace","code");--> statement-breakpoint
CREATE UNIQUE INDEX "org_specialities_org_spec_uq" ON "content"."organization_specialities" USING btree ("organization_id","speciality_id");--> statement-breakpoint
CREATE UNIQUE INDEX "org_specialities_one_primary_uq" ON "content"."organization_specialities" USING btree ("organization_id") WHERE "content"."organization_specialities"."is_primary" = true and "content"."organization_specialities"."retired_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "speciality_change_items_request_spec_uq" ON "content"."speciality_change_items" USING btree ("request_id","speciality_id");--> statement-breakpoint
CREATE UNIQUE INDEX "speciality_change_requests_open_uq" ON "content"."speciality_change_requests" USING btree ("organization_id") WHERE "content"."speciality_change_requests"."state" in ('submitted', 'under_review');--> statement-breakpoint
CREATE INDEX "speciality_change_requests_state_time_idx" ON "content"."speciality_change_requests" USING btree ("state","submitted_at");--> statement-breakpoint
CREATE INDEX "speciality_change_requests_org_time_idx" ON "content"."speciality_change_requests" USING btree ("organization_id","submitted_at");--> statement-breakpoint
CREATE INDEX "places_city_idx" ON "content"."places" USING btree ("city_id");--> statement-breakpoint
CREATE INDEX "activities_org_city_idx" ON "content"."activities" USING btree ("organization_id","city_id");--> statement-breakpoint
CREATE INDEX "activities_team_idx" ON "content"."activities" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "activities_place_idx" ON "content"."activities" USING btree ("place_id");--> statement-breakpoint
CREATE INDEX "activities_category_idx" ON "content"."activities" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "activities_published_idx" ON "content"."activities" USING btree ("published");--> statement-breakpoint
CREATE UNIQUE INDEX "activity_claim_requests_active_uq" ON "content"."activity_claim_requests" USING btree ("activity_id","destination_organization_id") WHERE "content"."activity_claim_requests"."state" = 'pending';--> statement-breakpoint
CREATE INDEX "activity_claim_requests_expiry_idx" ON "content"."activity_claim_requests" USING btree ("state","expires_at");--> statement-breakpoint
CREATE INDEX "activity_custody_events_activity_time_idx" ON "content"."activity_custody_events" USING btree ("activity_id","occurred_at");--> statement-breakpoint
CREATE INDEX "activity_member_assignments_member_idx" ON "content"."activity_member_assignments" USING btree ("member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "activity_occurrence_confirmations_org_date_uq" ON "content"."activity_occurrence_confirmations" USING btree ("activity_id","date","organization_id") WHERE "content"."activity_occurrence_confirmations"."organization_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "activity_occurrence_confirmations_platform_date_uq" ON "content"."activity_occurrence_confirmations" USING btree ("activity_id","date") WHERE "content"."activity_occurrence_confirmations"."organization_id" is null;--> statement-breakpoint
CREATE INDEX "activity_occurrence_confirmations_date_idx" ON "content"."activity_occurrence_confirmations" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "activity_publications_active_uq" ON "content"."activity_publications" USING btree ("activity_id","language_code") WHERE "content"."activity_publications"."unpublished_at" is null;--> statement-breakpoint
CREATE INDEX "activity_services_service_idx" ON "content"."activity_services" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX "activity_transit_links_activity_order_idx" ON "content"."activity_transit_links" USING btree ("activity_id","display_order");--> statement-breakpoint
CREATE INDEX "activity_verifications_activity_time_idx" ON "content"."activity_verifications" USING btree ("activity_id","verified_at");--> statement-breakpoint
CREATE INDEX "activity_verifications_org_time_idx" ON "content"."activity_verifications" USING btree ("organization_id","verified_at");--> statement-breakpoint
CREATE UNIQUE INDEX "city_team_members_lead_uq" ON "core"."city_team_members" USING btree ("team_id") WHERE "core"."city_team_members"."is_lead" and "core"."city_team_members"."active";--> statement-breakpoint
CREATE INDEX "city_team_members_member_idx" ON "core"."city_team_members" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "schedule_exceptions_activity_date_idx" ON "content"."schedule_exceptions" USING btree ("activity_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "schedule_exceptions_full_day_uq" ON "content"."schedule_exceptions" USING btree ("activity_id","date","kind") WHERE "content"."schedule_exceptions"."start_time" is null and "content"."schedule_exceptions"."end_time" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "schedule_exceptions_partial_window_uq" ON "content"."schedule_exceptions" USING btree ("activity_id","date","kind","start_time","end_time") WHERE "content"."schedule_exceptions"."start_time" is not null and "content"."schedule_exceptions"."end_time" is not null;--> statement-breakpoint
CREATE INDEX "schedule_rules_activity_idx" ON "content"."schedule_rules" USING btree ("activity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "service_translations_scope_language_name_uq" ON "content"."service_translations" USING btree ("scope_key","language_code",lower(regexp_replace(btrim("name"), '[[:space:]]+', ' ', 'g')));--> statement-breakpoint
CREATE UNIQUE INDEX "services_scope_code_uq" ON "content"."services" USING btree (coalesce("organization_id"::text, ''),"code") WHERE "content"."services"."code" is not null;--> statement-breakpoint
CREATE INDEX "translator_languages_language_idx" ON "core"."translator_languages" USING btree ("language_code","can_translate_into");--> statement-breakpoint
CREATE UNIQUE INDEX "translators_contact_email_uq" ON "core"."translators" USING btree (lower(btrim("contact_email")));--> statement-breakpoint
CREATE UNIQUE INDEX "translators_user_uq" ON "core"."translators" USING btree ("user_id") WHERE "core"."translators"."user_id" is not null;--> statement-breakpoint
CREATE INDEX "translators_scope_status_idx" ON "core"."translators" USING btree ("directory_scope","status");--> statement-breakpoint
CREATE INDEX "translators_owner_idx" ON "core"."translators" USING btree ("owner_organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "legal_acceptances_user_doc_uq" ON "core"."legal_acceptances" USING btree ("user_id","legal_document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "legal_documents_kind_version_lang_uq" ON "core"."legal_documents" USING btree ("kind","version","language_code");--> statement-breakpoint
CREATE UNIQUE INDEX "org_members_org_user_uq" ON "core"."organization_members" USING btree ("organization_id","user_id") WHERE "core"."organization_members"."user_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "permission_review_items_review_grant_uq" ON "core"."permission_review_items" USING btree ("review_id","member_id","role_id");--> statement-breakpoint
CREATE INDEX "permission_review_items_review_decision_idx" ON "core"."permission_review_items" USING btree ("review_id","decision");--> statement-breakpoint
CREATE UNIQUE INDEX "permission_reviews_open_uq" ON "core"."permission_reviews" USING btree ("organization_id") WHERE "core"."permission_reviews"."state" in ('open', 'in_progress');--> statement-breakpoint
CREATE INDEX "permission_reviews_state_due_idx" ON "core"."permission_reviews" USING btree ("state","due_on");--> statement-breakpoint
CREATE UNIQUE INDEX "roles_platform_code_uq" ON "core"."roles" USING btree ("code") WHERE "core"."roles"."organization_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "roles_org_code_uq" ON "core"."roles" USING btree ("organization_id","code") WHERE "core"."roles"."organization_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "asset_text_tracks_asset_lang_kind_uq" ON "content"."asset_text_tracks" USING btree ("asset_id","language_code","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "asset_variants_asset_kind_uq" ON "content"."asset_variants" USING btree ("asset_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "training_courses_scope_slug_uq" ON "operations"."training_courses" USING btree (coalesce("organization_id"::text, ''),"slug");--> statement-breakpoint
CREATE INDEX "training_courses_org_active_idx" ON "operations"."training_courses" USING btree ("organization_id","active");--> statement-breakpoint
CREATE INDEX "training_courses_visibility_active_idx" ON "operations"."training_courses" USING btree ("visibility","active");--> statement-breakpoint
CREATE UNIQUE INDEX "training_records_course_member_uq" ON "operations"."training_records" USING btree ("course_id","member_id") WHERE "operations"."training_records"."member_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "training_records_course_translator_uq" ON "operations"."training_records" USING btree ("course_id","translator_id") WHERE "operations"."training_records"."translator_id" is not null;--> statement-breakpoint
CREATE INDEX "training_records_member_idx" ON "operations"."training_records" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "training_records_translator_idx" ON "operations"."training_records" USING btree ("translator_id");--> statement-breakpoint
CREATE INDEX "training_records_course_state_idx" ON "operations"."training_records" USING btree ("course_id","state");--> statement-breakpoint
CREATE INDEX "training_records_expires_idx" ON "operations"."training_records" USING btree ("expires_on");--> statement-breakpoint
CREATE UNIQUE INDEX "requirement_items_set_skill_uq" ON "operations"."requirement_items" USING btree ("set_id","skill_id") WHERE "operations"."requirement_items"."skill_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "requirement_items_set_course_uq" ON "operations"."requirement_items" USING btree ("set_id","course_id") WHERE "operations"."requirement_items"."course_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "requirement_items_set_language_uq" ON "operations"."requirement_items" USING btree ("set_id","language_code") WHERE "operations"."requirement_items"."language_code" is not null;--> statement-breakpoint
CREATE INDEX "requirement_items_set_idx" ON "operations"."requirement_items" USING btree ("set_id");--> statement-breakpoint
CREATE UNIQUE INDEX "requirement_sets_org_code_uq" ON "operations"."requirement_sets" USING btree ("organization_id","code");--> statement-breakpoint
CREATE INDEX "requirement_sets_org_active_idx" ON "operations"."requirement_sets" USING btree ("organization_id","active");--> statement-breakpoint
CREATE UNIQUE INDEX "skill_records_skill_member_uq" ON "operations"."skill_records" USING btree ("skill_id","member_id") WHERE "operations"."skill_records"."member_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "skill_records_skill_translator_uq" ON "operations"."skill_records" USING btree ("skill_id","translator_id") WHERE "operations"."skill_records"."translator_id" is not null;--> statement-breakpoint
CREATE INDEX "skill_records_member_idx" ON "operations"."skill_records" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "skill_records_translator_idx" ON "operations"."skill_records" USING btree ("translator_id");--> statement-breakpoint
CREATE INDEX "skill_records_skill_state_idx" ON "operations"."skill_records" USING btree ("skill_id","state");--> statement-breakpoint
CREATE INDEX "skill_records_expires_idx" ON "operations"."skill_records" USING btree ("expires_on");--> statement-breakpoint
CREATE UNIQUE INDEX "skills_scope_kind_code_uq" ON "operations"."skills" USING btree (coalesce("organization_id"::text, ''),"kind","code");--> statement-breakpoint
CREATE UNIQUE INDEX "skills_scope_name_fr_uq" ON "operations"."skills" USING btree (coalesce("organization_id"::text, ''),lower(regexp_replace(btrim("name_fr"), '[[:space:]]+', ' ', 'g')));--> statement-breakpoint
CREATE INDEX "skills_org_active_idx" ON "operations"."skills" USING btree ("organization_id","active");--> statement-breakpoint
CREATE INDEX "skills_visibility_active_idx" ON "operations"."skills" USING btree ("visibility","active");--> statement-breakpoint
CREATE INDEX "skills_kind_active_idx" ON "operations"."skills" USING btree ("kind","active");--> statement-breakpoint
CREATE UNIQUE INDEX "editorial_custodianships_active_uq" ON "content"."editorial_custodianships" USING btree ("entry_id") WHERE "content"."editorial_custodianships"."ended_at" is null;--> statement-breakpoint
CREATE INDEX "editorial_custody_transfer_events_entry_time_idx" ON "content"."editorial_custody_transfer_events" USING btree ("entry_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "editorial_custody_transfer_requests_active_uq" ON "content"."editorial_custody_transfer_requests" USING btree ("entry_id") WHERE "content"."editorial_custody_transfer_requests"."state" = 'pending';--> statement-breakpoint
CREATE INDEX "editorial_custody_transfer_requests_expiry_idx" ON "content"."editorial_custody_transfer_requests" USING btree ("state","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "editorial_entry_assets_cover_uq" ON "content"."editorial_entry_assets" USING btree ("entry_id") WHERE "content"."editorial_entry_assets"."role" = 'cover';--> statement-breakpoint
CREATE UNIQUE INDEX "editorial_entry_routes_language_slug_uq" ON "content"."editorial_entry_routes" USING btree ("language_code","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "editorial_entry_routes_active_entry_language_uq" ON "content"."editorial_entry_routes" USING btree ("entry_id","language_code") WHERE "content"."editorial_entry_routes"."retired_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "editorial_publications_active_uq" ON "content"."editorial_publications" USING btree ("entry_id","language_code") WHERE "content"."editorial_publications"."unpublished_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "editorial_revision_assets_uq" ON "content"."editorial_revision_assets" USING btree ("revision_id","asset_id","role");--> statement-breakpoint
CREATE UNIQUE INDEX "editorial_revisions_entry_number_uq" ON "content"."editorial_revisions" USING btree ("entry_id","revision_number");--> statement-breakpoint
CREATE UNIQUE INDEX "translation_jobs_source_target_uq" ON "content"."translation_jobs" USING btree ("source_version_id","target_language_code");--> statement-breakpoint
CREATE UNIQUE INDEX "translation_jobs_provider_reference_uq" ON "content"."translation_jobs" USING btree ("provider_code","provider_job_reference") WHERE "content"."translation_jobs"."provider_job_reference" is not null;--> statement-breakpoint
CREATE INDEX "translation_jobs_state_idx" ON "content"."translation_jobs" USING btree ("state","requested_at");--> statement-breakpoint
CREATE INDEX "translation_jobs_org_idx" ON "content"."translation_jobs" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "translation_source_versions_entity_version_uq" ON "content"."translation_source_versions" USING btree ("entity_kind","entity_id","version");--> statement-breakpoint
CREATE INDEX "translation_source_versions_entity_hash_idx" ON "content"."translation_source_versions" USING btree ("entity_kind","entity_id","source_content_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "translation_source_versions_editorial_revision_uq" ON "content"."translation_source_versions" USING btree ("source_revision_id") WHERE "content"."translation_source_versions"."source_revision_id" is not null;--> statement-breakpoint
CREATE INDEX "translation_source_versions_org_idx" ON "content"."translation_source_versions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "translation_source_versions_entity_idx" ON "content"."translation_source_versions" USING btree ("entity_kind","entity_id");--> statement-breakpoint
CREATE INDEX "translation_assignment_events_assignment_idx" ON "content"."translation_assignment_events" USING btree ("assignment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "translation_assignments_active_uq" ON "content"."translation_assignments" USING btree ("entity_kind","entity_id","target_language_code") WHERE "content"."translation_assignments"."revoked_at" is null and "content"."translation_assignments"."expired_at" is null and "content"."translation_assignments"."state" not in ('rejected', 'published');--> statement-breakpoint
CREATE INDEX "translation_assignments_org_idx" ON "content"."translation_assignments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "translation_assignments_entity_idx" ON "content"."translation_assignments" USING btree ("entity_kind","entity_id");--> statement-breakpoint
CREATE INDEX "translation_assignments_translator_idx" ON "content"."translation_assignments" USING btree ("translator_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "public_event_occurrences_event_start_uq" ON "content"."public_event_occurrences" USING btree ("event_id","starts_at");--> statement-breakpoint
CREATE INDEX "public_event_occurrences_starts_idx" ON "content"."public_event_occurrences" USING btree ("starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "public_event_providers_event_org_uq" ON "content"."public_event_providers" USING btree ("event_id","organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "public_event_publications_active_uq" ON "content"."public_event_publications" USING btree ("event_id","language_code") WHERE "content"."public_event_publications"."unpublished_at" is null;--> statement-breakpoint
CREATE INDEX "public_events_city_idx" ON "content"."public_events" USING btree ("city_id");--> statement-breakpoint
CREATE INDEX "coordination_event_assets_event_role_idx" ON "operations"."coordination_event_assets" USING btree ("event_id","role");--> statement-breakpoint
CREATE UNIQUE INDEX "coordination_event_occurrences_event_start_uq" ON "operations"."coordination_event_occurrences" USING btree ("event_id","starts_at");--> statement-breakpoint
CREATE INDEX "coordination_event_occurrences_starts_idx" ON "operations"."coordination_event_occurrences" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "coordination_event_occurrences_state_starts_idx" ON "operations"."coordination_event_occurrences" USING btree ("state","starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "coordination_event_participation_event_uq" ON "operations"."coordination_event_participation" USING btree ("event_id","organization_id") WHERE "operations"."coordination_event_participation"."occurrence_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "coordination_event_participation_occurrence_uq" ON "operations"."coordination_event_participation" USING btree ("occurrence_id","organization_id") WHERE "operations"."coordination_event_participation"."occurrence_id" is not null;--> statement-breakpoint
CREATE INDEX "coordination_event_participation_event_state_idx" ON "operations"."coordination_event_participation" USING btree ("event_id","state");--> statement-breakpoint
CREATE INDEX "coordination_event_participation_org_idx" ON "operations"."coordination_event_participation" USING btree ("organization_id","responded_at");--> statement-breakpoint
CREATE INDEX "coordination_event_transit_links_event_order_idx" ON "operations"."coordination_event_transit_links" USING btree ("event_id","display_order");--> statement-breakpoint
CREATE INDEX "coordination_events_city_starts_idx" ON "operations"."coordination_events" USING btree ("city_id","starts_at");--> statement-breakpoint
CREATE INDEX "coordination_events_host_starts_idx" ON "operations"."coordination_events" USING btree ("host_organization_id","starts_at");--> statement-breakpoint
CREATE INDEX "coordination_events_visibility_starts_idx" ON "operations"."coordination_events" USING btree ("visibility","starts_at");--> statement-breakpoint
CREATE INDEX "search_concept_aliases_normalized_idx" ON "content"."search_concept_aliases" USING btree ("language_code","normalized_alias");--> statement-breakpoint
CREATE UNIQUE INDEX "edges_from_option_uq" ON "simulator"."edges" USING btree ("from_node_id","option_id") WHERE "simulator"."edges"."option_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "flow_versions_flow_number_uq" ON "simulator"."flow_versions" USING btree ("flow_id","version_number");--> statement-breakpoint
CREATE UNIQUE INDEX "nodes_version_key_uq" ON "simulator"."nodes" USING btree ("version_id","node_key");--> statement-breakpoint
CREATE UNIQUE INDEX "options_node_key_uq" ON "simulator"."options" USING btree ("node_id","option_key");--> statement-breakpoint
CREATE UNIQUE INDEX "version_publications_active_uq" ON "simulator"."version_publications" USING btree ("flow_id") WHERE "simulator"."version_publications"."unpublished_at" is null;--> statement-breakpoint
CREATE INDEX "moderation_cases_status_time_idx" ON "core"."moderation_cases" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "moderation_cases_org_time_idx" ON "core"."moderation_cases" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "moderation_cases_related_idx" ON "core"."moderation_cases" USING btree ("related_organization_id");--> statement-breakpoint
CREATE INDEX "moderation_cases_entity_idx" ON "core"."moderation_cases" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "moderation_cases_assignee_idx" ON "core"."moderation_cases" USING btree ("assigned_to_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "moderation_cases_open_pair_uq" ON "core"."moderation_cases" USING btree ("kind","organization_id","related_organization_id") WHERE "core"."moderation_cases"."status" in ('open', 'in_review') and "core"."moderation_cases"."kind" in ('duplicate', 'impersonation') and "core"."moderation_cases"."organization_id" is not null and "core"."moderation_cases"."related_organization_id" is not null;--> statement-breakpoint
CREATE INDEX "moderation_events_case_time_idx" ON "core"."moderation_events" USING btree ("case_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_events_org_time_idx" ON "audit"."events" USING btree ("organization_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_events_subject_idx" ON "audit"."events" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "audit_events_time_idx" ON "audit"."events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "audit_events_actor_time_idx" ON "audit"."events" USING btree ("actor_user_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_events_action_time_idx" ON "audit"."events" USING btree ("action","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_events_attention_time_idx" ON "audit"."events" USING btree ("occurred_at") WHERE "audit"."events"."outcome" <> 'success';--> statement-breakpoint
CREATE INDEX "delivery_attempts_time_idx" ON "notifications"."delivery_attempts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "delivery_attempts_status_time_idx" ON "notifications"."delivery_attempts" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "delivery_attempts_channel_time_idx" ON "notifications"."delivery_attempts" USING btree ("channel","created_at");--> statement-breakpoint
CREATE INDEX "delivery_attempts_recipient_idx" ON "notifications"."delivery_attempts" USING btree ("recipient_hash");--> statement-breakpoint
CREATE INDEX "notifications_user_unread_idx" ON "notifications"."notifications" USING btree ("user_id","created_at") WHERE "notifications"."notifications"."read_at" is null;--> statement-breakpoint
CREATE INDEX "notifications_user_time_idx" ON "notifications"."notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_entity_idx" ON "notifications"."notifications" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_endpoints_user_channel_address_uq" ON "notifications"."endpoints" USING btree ("user_id","channel","address_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_endpoints_primary_uq" ON "notifications"."endpoints" USING btree ("user_id","channel") WHERE "notifications"."endpoints"."is_primary" and "notifications"."endpoints"."disabled_at" is null;--> statement-breakpoint
CREATE INDEX "notification_endpoints_user_channel_idx" ON "notifications"."endpoints" USING btree ("user_id","channel");--> statement-breakpoint
CREATE INDEX "notification_endpoints_address_idx" ON "notifications"."endpoints" USING btree ("address_hash");