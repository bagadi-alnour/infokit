CREATE SCHEMA "audit";
--> statement-breakpoint
CREATE SCHEMA "simulator";
--> statement-breakpoint
CREATE TYPE "content"."asset_variant_kind" AS ENUM('thumbnail', 'optimized_image', 'poster', 'low_bandwidth_video', 'low_bandwidth_audio', 'printable_pdf', 'other');--> statement-breakpoint
CREATE TYPE "content"."asset_visibility" AS ENUM('public', 'workspace');--> statement-breakpoint
CREATE TYPE "content"."attribution_role" AS ENUM('factual_owner', 'publisher', 'mentioned');--> statement-breakpoint
CREATE TYPE "audit"."actor_type" AS ENUM('user', 'system', 'provider', 'support');--> statement-breakpoint
CREATE TYPE "content"."custodian_kind" AS ENUM('organization', 'platform');--> statement-breakpoint
CREATE TYPE "content"."editorial_kind" AS ENUM('article', 'fixed_information', 'basic_information');--> statement-breakpoint
CREATE TYPE "content"."editorial_workflow_state" AS ENUM('draft', 'in_review', 'published', 'unpublished', 'archived');--> statement-breakpoint
CREATE TYPE "simulator"."flow_version_status" AS ENUM('draft', 'published', 'retired');--> statement-breakpoint
CREATE TYPE "core"."invitation_kind" AS ENUM('association_publisher', 'organization_admin', 'member');--> statement-breakpoint
CREATE TYPE "content"."malware_scan_state" AS ENUM('pending', 'clean', 'flagged');--> statement-breakpoint
CREATE TYPE "content"."media_kind" AS ENUM('image', 'video', 'audio', 'document', 'other');--> statement-breakpoint
CREATE TYPE "core"."member_status" AS ENUM('invited', 'active', 'inactive', 'offboarded');--> statement-breakpoint
CREATE TYPE "content"."occurrence_state" AS ENUM('scheduled', 'cancelled', 'uncertain');--> statement-breakpoint
CREATE TYPE "content"."review_task_status" AS ENUM('open', 'done', 'dismissed');--> statement-breakpoint
CREATE TYPE "simulator"."node_kind" AS ENUM('question', 'information', 'result');--> statement-breakpoint
CREATE TYPE "content"."text_track_kind" AS ENUM('transcript', 'captions', 'subtitles', 'description');--> statement-breakpoint
CREATE TYPE "core"."verification_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "core"."invitation_roles" (
	"invitation_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	CONSTRAINT "invitation_roles_invitation_id_role_id_pk" PRIMARY KEY("invitation_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "core"."invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"kind" "core"."invitation_kind" DEFAULT 'association_publisher' NOT NULL,
	"token_hash" varchar(255) NOT NULL,
	"invited_by_id" varchar(255),
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"accepted_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invitations_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "core"."legal_acceptances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
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
CREATE TABLE "core"."member_roles" (
	"member_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"granted_by_id" varchar(255),
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "member_roles_member_id_role_id_pk" PRIMARY KEY("member_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "core"."organization_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" varchar(255),
	"display_name" varchar(200) NOT NULL,
	"contact_email" varchar(255),
	"status" "core"."member_status" DEFAULT 'invited' NOT NULL,
	"offboarded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."organization_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"reviewed_by_id" varchar(255),
	"method" varchar(100),
	"status" "core"."verification_status" DEFAULT 'pending' NOT NULL,
	"notes" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
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
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content"."asset_text_tracks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"language_code" varchar(35) NOT NULL,
	"kind" text_track_kind NOT NULL,
	"body" text,
	"storage_key" text,
	"state" "content"."translation_state" DEFAULT 'draft' NOT NULL,
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
	"state" "content"."translation_state" DEFAULT 'draft' NOT NULL,
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
	"uploader_id" varchar(255),
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
	"state" "content"."translation_state" DEFAULT 'draft' NOT NULL,
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
	"actor_user_id" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "content"."editorial_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "content"."editorial_kind" NOT NULL,
	"slug" varchar(150) NOT NULL,
	"workflow_state" "content"."editorial_workflow_state" DEFAULT 'draft' NOT NULL,
	"city_id" uuid,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "editorial_entries_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "content"."editorial_publications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"language_code" varchar(35) NOT NULL,
	"revision_id" uuid NOT NULL,
	"published_by_id" varchar(255),
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"unpublished_at" timestamp with time zone
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
	"state" "content"."translation_state" DEFAULT 'draft' NOT NULL,
	"method" "content"."translation_method" DEFAULT 'human' NOT NULL,
	"verified_by_id" varchar(255),
	"verified_at" timestamp with time zone,
	CONSTRAINT "editorial_revision_translations_revision_id_language_code_pk" PRIMARY KEY("revision_id","language_code")
);
--> statement-breakpoint
CREATE TABLE "content"."editorial_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"revision_number" integer NOT NULL,
	"author_id" varchar(255),
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
	"assignee_id" varchar(255),
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
CREATE TABLE "content"."public_event_audience_translations" (
	"event_id" uuid NOT NULL,
	"language_code" varchar(35) NOT NULL,
	"eligibility_details" text NOT NULL,
	"state" "content"."translation_state" DEFAULT 'draft' NOT NULL,
	CONSTRAINT "public_event_audience_translations_event_id_language_code_pk" PRIMARY KEY("event_id","language_code")
);
--> statement-breakpoint
CREATE TABLE "content"."public_event_occurrence_translations" (
	"occurrence_id" uuid NOT NULL,
	"language_code" varchar(35) NOT NULL,
	"public_reason" text NOT NULL,
	"state" "content"."translation_state" DEFAULT 'draft' NOT NULL,
	CONSTRAINT "public_event_occurrence_translations_occurrence_id_language_code_pk" PRIMARY KEY("occurrence_id","language_code")
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
	"state" "content"."translation_state" DEFAULT 'draft' NOT NULL,
	"method" "content"."translation_method" DEFAULT 'human' NOT NULL,
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
	"min_age" smallint,
	"max_age" smallint,
	"manual_status" "content"."service_manual_status" DEFAULT 'normal' NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"verified_by_id" varchar(255),
	"source_note" text,
	"last_verified_at" timestamp with time zone,
	"review_due_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
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
	"verified_by_id" varchar(255),
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
	"owner_organization_id" uuid,
	"city_id" uuid,
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
	"state" "content"."translation_state" DEFAULT 'draft' NOT NULL,
	CONSTRAINT "node_translations_node_id_language_code_pk" PRIMARY KEY("node_id","language_code")
);
--> statement-breakpoint
CREATE TABLE "simulator"."nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version_id" uuid NOT NULL,
	"node_key" varchar(50) NOT NULL,
	"kind" "simulator"."node_kind" NOT NULL,
	"optional" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "simulator"."option_translations" (
	"option_id" uuid NOT NULL,
	"language_code" varchar(35) NOT NULL,
	"label" varchar(200) NOT NULL,
	"help" text,
	"state" "content"."translation_state" DEFAULT 'draft' NOT NULL,
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
	"published_by_id" varchar(255),
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"unpublished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "audit"."events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"actor_user_id" varchar(255),
	"actor_type" "audit"."actor_type" DEFAULT 'user' NOT NULL,
	"action" varchar(150) NOT NULL,
	"subject_type" varchar(100),
	"subject_id" varchar(255),
	"reason" text,
	"metadata" jsonb,
	"request_id" varchar(100),
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core"."invitation_roles" ADD CONSTRAINT "invitation_roles_invitation_id_invitations_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "core"."invitations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."invitation_roles" ADD CONSTRAINT "invitation_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "core"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."invitations" ADD CONSTRAINT "invitations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."invitations" ADD CONSTRAINT "invitations_invited_by_id_users_id_fk" FOREIGN KEY ("invited_by_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."invitations" ADD CONSTRAINT "invitations_accepted_member_id_organization_members_id_fk" FOREIGN KEY ("accepted_member_id") REFERENCES "core"."organization_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."legal_acceptances" ADD CONSTRAINT "legal_acceptances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."legal_acceptances" ADD CONSTRAINT "legal_acceptances_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."legal_acceptances" ADD CONSTRAINT "legal_acceptances_legal_document_id_legal_documents_id_fk" FOREIGN KEY ("legal_document_id") REFERENCES "core"."legal_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."legal_documents" ADD CONSTRAINT "legal_documents_language_code_languages_code_fk" FOREIGN KEY ("language_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."member_roles" ADD CONSTRAINT "member_roles_member_id_organization_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "core"."organization_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."member_roles" ADD CONSTRAINT "member_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "core"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."member_roles" ADD CONSTRAINT "member_roles_granted_by_id_users_id_fk" FOREIGN KEY ("granted_by_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."organization_members" ADD CONSTRAINT "organization_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."organization_members" ADD CONSTRAINT "organization_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."organization_verifications" ADD CONSTRAINT "organization_verifications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."organization_verifications" ADD CONSTRAINT "organization_verifications_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "core"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."role_permissions" ADD CONSTRAINT "role_permissions_permission_code_permissions_code_fk" FOREIGN KEY ("permission_code") REFERENCES "core"."permissions"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."roles" ADD CONSTRAINT "roles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
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
ALTER TABLE "content"."article_details" ADD CONSTRAINT "article_details_entry_id_editorial_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "content"."editorial_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."basic_information_details" ADD CONSTRAINT "basic_information_details_entry_id_editorial_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "content"."editorial_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."basic_information_details" ADD CONSTRAINT "basic_information_details_category_id_service_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "content"."service_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_custodianships" ADD CONSTRAINT "editorial_custodianships_entry_id_editorial_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "content"."editorial_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_custodianships" ADD CONSTRAINT "editorial_custodianships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_custodianships" ADD CONSTRAINT "editorial_custodianships_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_entries" ADD CONSTRAINT "editorial_entries_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "core"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_publications" ADD CONSTRAINT "editorial_publications_entry_id_editorial_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "content"."editorial_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_publications" ADD CONSTRAINT "editorial_publications_language_code_languages_code_fk" FOREIGN KEY ("language_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_publications" ADD CONSTRAINT "editorial_publications_revision_id_editorial_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "content"."editorial_revisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_publications" ADD CONSTRAINT "editorial_publications_published_by_id_users_id_fk" FOREIGN KEY ("published_by_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_related_contacts" ADD CONSTRAINT "editorial_related_contacts_entry_id_editorial_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "content"."editorial_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_related_contacts" ADD CONSTRAINT "editorial_related_contacts_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "content"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_related_entries" ADD CONSTRAINT "editorial_related_entries_entry_id_editorial_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "content"."editorial_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_related_entries" ADD CONSTRAINT "editorial_related_entries_related_entry_id_editorial_entries_id_fk" FOREIGN KEY ("related_entry_id") REFERENCES "content"."editorial_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_related_organizations" ADD CONSTRAINT "editorial_related_organizations_entry_id_editorial_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "content"."editorial_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_related_organizations" ADD CONSTRAINT "editorial_related_organizations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_related_services" ADD CONSTRAINT "editorial_related_services_entry_id_editorial_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "content"."editorial_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_related_services" ADD CONSTRAINT "editorial_related_services_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "content"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_revision_assets" ADD CONSTRAINT "editorial_revision_assets_revision_id_editorial_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "content"."editorial_revisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_revision_assets" ADD CONSTRAINT "editorial_revision_assets_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "content"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_revision_assets" ADD CONSTRAINT "editorial_revision_assets_language_code_languages_code_fk" FOREIGN KEY ("language_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_revision_organizations" ADD CONSTRAINT "editorial_revision_organizations_revision_id_editorial_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "content"."editorial_revisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_revision_organizations" ADD CONSTRAINT "editorial_revision_organizations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_revision_sources" ADD CONSTRAINT "editorial_revision_sources_revision_id_editorial_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "content"."editorial_revisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_revision_sources" ADD CONSTRAINT "editorial_revision_sources_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "content"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_revision_translations" ADD CONSTRAINT "editorial_revision_translations_revision_id_editorial_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "content"."editorial_revisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_revision_translations" ADD CONSTRAINT "editorial_revision_translations_language_code_languages_code_fk" FOREIGN KEY ("language_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_revision_translations" ADD CONSTRAINT "editorial_revision_translations_verified_by_id_users_id_fk" FOREIGN KEY ("verified_by_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_revisions" ADD CONSTRAINT "editorial_revisions_entry_id_editorial_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "content"."editorial_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."editorial_revisions" ADD CONSTRAINT "editorial_revisions_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."fixed_information_details" ADD CONSTRAINT "fixed_information_details_entry_id_editorial_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "content"."editorial_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."review_tasks" ADD CONSTRAINT "review_tasks_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."public_event_audience_translations" ADD CONSTRAINT "public_event_audience_translations_event_id_public_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "content"."public_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."public_event_audience_translations" ADD CONSTRAINT "public_event_audience_translations_language_code_languages_code_fk" FOREIGN KEY ("language_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."public_event_occurrence_translations" ADD CONSTRAINT "public_event_occurrence_translations_occurrence_id_public_event_occurrences_id_fk" FOREIGN KEY ("occurrence_id") REFERENCES "content"."public_event_occurrences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."public_event_occurrence_translations" ADD CONSTRAINT "public_event_occurrence_translations_language_code_languages_code_fk" FOREIGN KEY ("language_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."public_event_occurrences" ADD CONSTRAINT "public_event_occurrences_event_id_public_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "content"."public_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."public_event_occurrences" ADD CONSTRAINT "public_event_occurrences_series_id_public_event_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "content"."public_event_series"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."public_event_providers" ADD CONSTRAINT "public_event_providers_event_id_public_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "content"."public_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."public_event_providers" ADD CONSTRAINT "public_event_providers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."public_event_series" ADD CONSTRAINT "public_event_series_event_id_public_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "content"."public_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."public_event_services" ADD CONSTRAINT "public_event_services_event_id_public_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "content"."public_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."public_event_services" ADD CONSTRAINT "public_event_services_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "content"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."public_event_translations" ADD CONSTRAINT "public_event_translations_event_id_public_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "content"."public_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."public_event_translations" ADD CONSTRAINT "public_event_translations_language_code_languages_code_fk" FOREIGN KEY ("language_code") REFERENCES "core"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."public_events" ADD CONSTRAINT "public_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."public_events" ADD CONSTRAINT "public_events_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "content"."places"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."public_events" ADD CONSTRAINT "public_events_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "core"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."public_events" ADD CONSTRAINT "public_events_category_id_service_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "content"."service_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."public_events" ADD CONSTRAINT "public_events_audience_category_id_audience_categories_id_fk" FOREIGN KEY ("audience_category_id") REFERENCES "content"."audience_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."public_events" ADD CONSTRAINT "public_events_verified_by_id_users_id_fk" FOREIGN KEY ("verified_by_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
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
ALTER TABLE "simulator"."flows" ADD CONSTRAINT "flows_owner_organization_id_organizations_id_fk" FOREIGN KEY ("owner_organization_id") REFERENCES "core"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulator"."flows" ADD CONSTRAINT "flows_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "core"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
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
ALTER TABLE "audit"."events" ADD CONSTRAINT "events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit"."events" ADD CONSTRAINT "events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "legal_acceptances_user_doc_uq" ON "core"."legal_acceptances" USING btree ("user_id","legal_document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "legal_documents_kind_version_lang_uq" ON "core"."legal_documents" USING btree ("kind","version","language_code");--> statement-breakpoint
CREATE UNIQUE INDEX "org_members_org_user_uq" ON "core"."organization_members" USING btree ("organization_id","user_id") WHERE "core"."organization_members"."user_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "roles_platform_code_uq" ON "core"."roles" USING btree ("code") WHERE "core"."roles"."organization_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "roles_org_code_uq" ON "core"."roles" USING btree ("organization_id","code") WHERE "core"."roles"."organization_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "asset_text_tracks_asset_lang_kind_uq" ON "content"."asset_text_tracks" USING btree ("asset_id","language_code","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "asset_variants_asset_kind_uq" ON "content"."asset_variants" USING btree ("asset_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "editorial_custodianships_active_uq" ON "content"."editorial_custodianships" USING btree ("entry_id") WHERE "content"."editorial_custodianships"."ended_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "editorial_publications_active_uq" ON "content"."editorial_publications" USING btree ("entry_id","language_code") WHERE "content"."editorial_publications"."unpublished_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "editorial_revision_assets_uq" ON "content"."editorial_revision_assets" USING btree ("revision_id","asset_id","role");--> statement-breakpoint
CREATE UNIQUE INDEX "editorial_revisions_entry_number_uq" ON "content"."editorial_revisions" USING btree ("entry_id","revision_number");--> statement-breakpoint
CREATE UNIQUE INDEX "public_event_occurrences_event_start_uq" ON "content"."public_event_occurrences" USING btree ("event_id","starts_at");--> statement-breakpoint
CREATE INDEX "public_event_occurrences_starts_idx" ON "content"."public_event_occurrences" USING btree ("starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "public_event_providers_event_org_uq" ON "content"."public_event_providers" USING btree ("event_id","organization_id");--> statement-breakpoint
CREATE INDEX "public_events_city_idx" ON "content"."public_events" USING btree ("city_id");--> statement-breakpoint
CREATE INDEX "search_concept_aliases_normalized_idx" ON "content"."search_concept_aliases" USING btree ("language_code","normalized_alias");--> statement-breakpoint
CREATE UNIQUE INDEX "edges_from_option_uq" ON "simulator"."edges" USING btree ("from_node_id","option_id") WHERE "simulator"."edges"."option_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "flow_versions_flow_number_uq" ON "simulator"."flow_versions" USING btree ("flow_id","version_number");--> statement-breakpoint
CREATE UNIQUE INDEX "nodes_version_key_uq" ON "simulator"."nodes" USING btree ("version_id","node_key");--> statement-breakpoint
CREATE UNIQUE INDEX "options_node_key_uq" ON "simulator"."options" USING btree ("node_id","option_key");--> statement-breakpoint
CREATE UNIQUE INDEX "version_publications_active_uq" ON "simulator"."version_publications" USING btree ("flow_id") WHERE "simulator"."version_publications"."unpublished_at" is null;--> statement-breakpoint
CREATE INDEX "audit_events_org_time_idx" ON "audit"."events" USING btree ("organization_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_events_subject_idx" ON "audit"."events" USING btree ("subject_type","subject_id");