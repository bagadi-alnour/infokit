"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, desc, eq, isNull, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import { type Locale } from "@infokit/shared/i18n";

import { localizedPath } from "~/i18n/routing";
import { editorialLanguageCodes } from "~/lib/editorial-languages";
import { optionalText, personName, phoneNumber } from "~/lib/form-fields";
import { recordAudit } from "~/server/audit";
import {
  hasActualPlatformPermission,
  superadminPermission,
} from "~/server/auth/authorization";
import { claimOrganizationIfSteward } from "~/server/auth/link-memberships";
import { assertOrganizationWritable } from "~/server/auth/org-access";
import { protectedPermissionAction } from "~/server/auth/require";
import { hashContent } from "~/server/content/editorial";
import { db } from "~/server/db";
import { insertMember } from "~/server/members";
import {
  contacts,
  contactTranslations,
  invitationRoles,
  invitations,
  memberRoles,
  organizationLanguages,
  organizationMembers,
  organizationProfiles,
  organizationProfileTranslations,
  organizations,
  organizationSpecialities,
  roles,
  translationSourceVersions,
  users,
} from "~/server/db/schema";
import {
  INVITABLE_ROLE_CODES,
  invitationKindForRole,
  sendRepresentativeInvitation,
} from "~/server/invitations";

const orgIdSchema = z.string().uuid();
const optionalFoundedYear = z.preprocess(
  (value) => (value === "" || value === null ? null : value),
  z.coerce.number().int().min(1800).max(new Date().getFullYear()).nullable(),
);

function refresh(locale: Locale, organizationId?: string) {
  revalidatePath(localizedPath("/dashboard/organizations", locale));
  if (organizationId) {
    revalidatePath(
      localizedPath(`/dashboard/organizations/${organizationId}`, locale),
    );
  }
  revalidatePath(localizedPath("/dashboard", locale));
}

function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

/* ------------------------------ create ------------------------------- */

const createOrganizationSchema = z.object({
  displayName: z.string().trim().min(2),
  legalName: optionalText,
  foundedYear: optionalFoundedYear,
  status: z.enum(["draft", "verified"]),
});

export const createOrganization = protectedPermissionAction(
  "organization.verify",
  async (formData, locale) => {
    const parsed = createOrganizationSchema.parse({
      displayName: formData.get("displayName"),
      legalName: formData.get("legalName") ?? "",
      foundedYear: formData.get("foundedYear"),
      status: formData.get("status"),
    });

    const base = slugify(parsed.displayName) || "organisation";
    let slug = base;
    let suffix = 2;
    while (
      (
        await db
          .select({ id: organizations.id })
          .from(organizations)
          .where(eq(organizations.slug, slug))
      ).length > 0
    ) {
      slug = `${base}-${String(suffix)}`;
      suffix += 1;
    }

    const [organization] = await db
      .insert(organizations)
      .values({
        displayName: parsed.displayName,
        legalName: parsed.legalName,
        foundedYear: parsed.foundedYear,
        slug,
        status: parsed.status,
      })
      .returning({ id: organizations.id });
    if (!organization) throw new Error("Organisation insert returned no row");
    await db
      .insert(organizationProfiles)
      .values({ organizationId: organization.id })
      .onConflictDoNothing();
    await recordAudit({
      action: "organization.created",
      subjectType: "organization",
      subjectId: organization.id,
      organizationId: organization.id,
    });
    refresh(locale, organization.id);
    redirect(
      localizedPath(`/dashboard/organizations/${organization.id}`, locale),
    );
  },
);

/* ------------------------------- update ------------------------------ */

const updateOrganizationSchema = z.object({
  organizationId: orgIdSchema,
  displayName: z.string().trim().min(2),
  legalName: optionalText,
  foundedYear: optionalFoundedYear,
  /** `archived` is never offered in the form; it round-trips so an actor who
   * cannot change status (an org member) does not silently restore a record. */
  status: z.enum(["draft", "verified", "suspended", "archived"]),
  website: optionalText,
  sourceUrl: optionalText,
  sourceCheckedOn: optionalText,
  published: z.literal("on").nullable(),
});

export const updateOrganization = protectedPermissionAction(
  "organization.profile.manage",
  async (formData, locale, user) => {
    const parsed = updateOrganizationSchema.parse({
      organizationId: formData.get("organizationId"),
      displayName: formData.get("displayName"),
      legalName: formData.get("legalName") ?? "",
      foundedYear: formData.get("foundedYear"),
      status: formData.get("status"),
      website: formData.get("website") ?? "",
      sourceUrl: formData.get("sourceUrl") ?? "",
      sourceCheckedOn: formData.get("sourceCheckedOn") ?? "",
      published: formData.get("published"),
    });
    await assertOrganizationWritable(user.id, parsed.organizationId);
    await db
      .update(organizations)
      .set({
        displayName: parsed.displayName,
        legalName: parsed.legalName,
        foundedYear: parsed.foundedYear,
        status: parsed.status,
      })
      .where(eq(organizations.id, parsed.organizationId));
    await db
      .insert(organizationProfiles)
      .values({
        organizationId: parsed.organizationId,
        website: parsed.website,
        sourceUrl: parsed.sourceUrl,
        sourceCheckedOn: parsed.sourceCheckedOn,
        published: parsed.published === "on",
      })
      .onConflictDoUpdate({
        target: organizationProfiles.organizationId,
        set: {
          website: parsed.website,
          sourceUrl: parsed.sourceUrl,
          sourceCheckedOn: parsed.sourceCheckedOn,
          published: parsed.published === "on",
        },
      });
    await recordAudit({
      action: "organization.updated",
      subjectType: "organization",
      subjectId: parsed.organizationId,
      organizationId: parsed.organizationId,
    });
    refresh(locale, parsed.organizationId);
  },
);

/* ---------------------------- narrative ------------------------------ */

/**
 * Seal the authored narrative so a translation request can be pinned to the
 * exact text the translator receives (docs/PHASE-1.3-COLLABORATION.md).
 *
 * Only the source language travels: editing a translated language must not
 * invalidate an assignment already in flight, and the translator has no
 * business reading the other targets. A save that changes nothing re-uses the
 * current version, so an unchanged form submit leaves live assignments alone.
 */
async function sealNarrativeSource(organizationId: string, actorId: string) {
  await db.transaction(async (tx) => {
    const [profile] = await tx
      .select({
        sourceLanguage: organizationProfiles.narrativeSourceLanguage,
      })
      .from(organizationProfiles)
      .where(eq(organizationProfiles.organizationId, organizationId))
      .limit(1);
    const sourceLanguage = profile?.sourceLanguage ?? "fr";
    const [narrative] = await tx
      .select({
        purpose: organizationProfileTranslations.purpose,
        goals: organizationProfileTranslations.goals,
        values: organizationProfileTranslations.values,
        method: organizationProfileTranslations.method,
      })
      .from(organizationProfileTranslations)
      .where(
        and(
          eq(organizationProfileTranslations.organizationId, organizationId),
          eq(organizationProfileTranslations.languageCode, sourceLanguage),
        ),
      )
      .limit(1);
    // Nothing authored in the source language yet: there is nothing to translate.
    if (!narrative?.purpose.trim()) return;

    const payload = {
      sourceLanguage,
      translations: {
        [sourceLanguage]: {
          purpose: narrative.purpose,
          goals: narrative.goals,
          values: narrative.values,
          method: narrative.method,
        },
      },
    };
    const hash = hashContent(payload);
    const [latest] = await tx
      .select({
        id: translationSourceVersions.id,
        version: translationSourceVersions.version,
        hash: translationSourceVersions.sourceContentHash,
      })
      .from(translationSourceVersions)
      .where(
        and(
          eq(translationSourceVersions.entityKind, "organization_profile"),
          eq(translationSourceVersions.entityId, organizationId),
        ),
      )
      .orderBy(desc(translationSourceVersions.version))
      .limit(1);
    if (latest?.hash === hash) return;

    await tx.insert(translationSourceVersions).values({
      organizationId,
      entityKind: "organization_profile",
      entityId: organizationId,
      version: latest ? latest.version + 1 : 1,
      previousVersionId: latest?.id ?? null,
      sourceLanguageCode: sourceLanguage,
      sourceContentJson: payload,
      sourceContentHash: hash,
      impact: latest ? "review_required" : "initial",
      createdById: actorId,
    });
  });
}

/**
 * Which language the narrative is written in. Changing it re-seals the source
 * version, so the request buttons immediately target the other languages.
 */
export const setOrganizationNarrativeLanguage = protectedPermissionAction(
  "organization.profile.manage",
  async (formData, locale, user) => {
    const organizationId = orgIdSchema.parse(formData.get("organizationId"));
    const sourceLanguage = z
      .enum(editorialLanguageCodes)
      .parse(formData.get("sourceLanguage"));
    await assertOrganizationWritable(user.id, organizationId);
    await db
      .insert(organizationProfiles)
      .values({ organizationId, narrativeSourceLanguage: sourceLanguage })
      .onConflictDoUpdate({
        target: organizationProfiles.organizationId,
        set: { narrativeSourceLanguage: sourceLanguage },
      });
    await sealNarrativeSource(organizationId, user.id);
    await recordAudit({
      action: "organization.updated",
      subjectType: "organization",
      subjectId: organizationId,
      organizationId,
      metadata: {
        field: "narrative_source_language",
        languageCode: sourceLanguage,
      },
    });
    refresh(locale, organizationId);
  },
);

const purposeSchema = z.object({
  organizationId: orgIdSchema,
  languageCode: z.enum(editorialLanguageCodes),
  purpose: z.string().trim().min(1),
  goals: optionalText,
  values: optionalText,
});

export const upsertOrganizationPurpose = protectedPermissionAction(
  "organization.profile.manage",
  async (formData, locale, user) => {
    const parsed = purposeSchema.parse({
      organizationId: formData.get("organizationId"),
      languageCode: formData.get("languageCode"),
      purpose: formData.get("purpose"),
      goals: formData.get("goals") ?? "",
      values: formData.get("values") ?? "",
    });
    await assertOrganizationWritable(user.id, parsed.organizationId);
    await db
      .insert(organizationProfiles)
      .values({ organizationId: parsed.organizationId })
      .onConflictDoNothing();
    await db
      .insert(organizationProfileTranslations)
      .values(parsed)
      .onConflictDoUpdate({
        target: [
          organizationProfileTranslations.organizationId,
          organizationProfileTranslations.languageCode,
        ],
        set: {
          purpose: parsed.purpose,
          goals: parsed.goals,
          values: parsed.values,
        },
      });
    await sealNarrativeSource(parsed.organizationId, user.id);
    await recordAudit({
      action: "organization.updated",
      subjectType: "organization",
      subjectId: parsed.organizationId,
      organizationId: parsed.organizationId,
      metadata: {
        field: "profile_narrative",
        languageCode: parsed.languageCode,
      },
    });
    refresh(locale, parsed.organizationId);
  },
);

/* ---------------------------- specialities --------------------------- */

export const addOrganizationSpeciality = protectedPermissionAction(
  "organization.profile.manage",
  async (formData, locale, user) => {
    const organizationId = orgIdSchema.parse(formData.get("organizationId"));
    await assertOrganizationWritable(user.id, organizationId);
    const specialityId = z.string().uuid().parse(formData.get("specialityId"));
    await db
      .insert(organizationSpecialities)
      .values({ organizationId, specialityId })
      .onConflictDoNothing();
    await recordAudit({
      action: "speciality.created",
      subjectType: "speciality",
      subjectId: specialityId,
      organizationId,
    });
    refresh(locale, organizationId);
  },
);

export const retireOrganizationSpeciality = protectedPermissionAction(
  "organization.profile.manage",
  async (formData, locale, user) => {
    const organizationId = orgIdSchema.parse(formData.get("organizationId"));
    await assertOrganizationWritable(user.id, organizationId);
    const assignmentId = z.string().uuid().parse(formData.get("assignmentId"));
    await db
      .update(organizationSpecialities)
      .set({ retiredAt: new Date(), isPrimary: false })
      .where(
        and(
          eq(organizationSpecialities.id, assignmentId),
          eq(organizationSpecialities.organizationId, organizationId),
        ),
      );
    await recordAudit({
      action: "speciality.archived",
      subjectType: "speciality",
      subjectId: assignmentId,
      organizationId,
    });
    refresh(locale, organizationId);
  },
);

/** Primary is optionalText (PRODUCT.md §14.3): empty value clears it (co-equal). */
export const setPrimarySpeciality = protectedPermissionAction(
  "organization.profile.manage",
  async (formData, locale, user) => {
    const organizationId = orgIdSchema.parse(formData.get("organizationId"));
    await assertOrganizationWritable(user.id, organizationId);
    const raw = z.string().parse(formData.get("assignmentId") ?? "");
    const assignmentId = raw === "" ? null : z.string().uuid().parse(raw);
    await db
      .update(organizationSpecialities)
      .set({ isPrimary: false })
      .where(
        and(
          eq(organizationSpecialities.organizationId, organizationId),
          eq(organizationSpecialities.isPrimary, true),
        ),
      );
    if (assignmentId) {
      await db
        .update(organizationSpecialities)
        .set({ isPrimary: true })
        .where(
          and(
            eq(organizationSpecialities.id, assignmentId),
            eq(organizationSpecialities.organizationId, organizationId),
            isNull(organizationSpecialities.retiredAt),
          ),
        );
    }
    await recordAudit({
      action: "organization.updated",
      subjectType: "organization",
      subjectId: organizationId,
      organizationId,
      metadata: { field: "primary_speciality" },
    });
    refresh(locale, organizationId);
  },
);

/* ------------------------------ languages ---------------------------- */

export const toggleOrganizationLanguage = protectedPermissionAction(
  "organization.profile.manage",
  async (formData, locale, user) => {
    const organizationId = orgIdSchema.parse(formData.get("organizationId"));
    await assertOrganizationWritable(user.id, organizationId);
    const languageCode = z.string().min(2).parse(formData.get("languageCode"));
    const enabled = formData.get("enabled") === "true";
    if (enabled) {
      await db
        .insert(organizationLanguages)
        .values({ organizationId, languageCode })
        .onConflictDoNothing();
    } else {
      await db
        .delete(organizationLanguages)
        .where(
          and(
            eq(organizationLanguages.organizationId, organizationId),
            eq(organizationLanguages.languageCode, languageCode),
          ),
        );
    }
    // Which languages an association publishes in decides what its readers can
    // see, so turning one off is worth a dated row rather than a silent absence.
    await recordAudit({
      action: enabled
        ? "organization.language_enabled"
        : "organization.language_disabled",
      subjectType: "organization",
      subjectId: organizationId,
      organizationId,
      metadata: { languageCode },
    });
    refresh(locale, organizationId);
  },
);

/* ------------------------------ contacts ----------------------------- */

const contactSchema = z.object({
  organizationId: orgIdSchema,
  kind: z.enum(["phone", "whatsapp", "email", "on_site", "url"]),
  value: optionalText,
  labelFr: optionalText,
});

export const addOrganizationContact = protectedPermissionAction(
  "organization.profile.manage",
  async (formData, locale, user) => {
    const parsed = contactSchema.parse({
      organizationId: formData.get("organizationId"),
      kind: formData.get("kind"),
      value: formData.get("value") ?? "",
      labelFr: formData.get("labelFr") ?? "",
    });
    await assertOrganizationWritable(user.id, parsed.organizationId);
    const [contact] = await db
      .insert(contacts)
      .values({
        organizationId: parsed.organizationId,
        kind: parsed.kind,
        value: parsed.value,
      })
      .returning({ id: contacts.id });
    if (contact && parsed.labelFr) {
      await db.insert(contactTranslations).values({
        contactId: contact.id,
        languageCode: "fr",
        label: parsed.labelFr,
      });
    }
    await recordAudit({
      action: "contact.created",
      subjectType: "contact",
      subjectId: contact?.id,
      organizationId: parsed.organizationId,
    });
    refresh(locale, parsed.organizationId);
  },
);

export const toggleOrganizationContact = protectedPermissionAction(
  "organization.profile.manage",
  async (formData, locale, user) => {
    const organizationId = orgIdSchema.parse(formData.get("organizationId"));
    await assertOrganizationWritable(user.id, organizationId);
    const contactId = z.string().uuid().parse(formData.get("contactId"));
    const active = formData.get("active") === "true";
    await db
      .update(contacts)
      .set({ active })
      .where(
        and(
          eq(contacts.id, contactId),
          eq(contacts.organizationId, organizationId),
        ),
      );
    await recordAudit({
      action: active ? "contact.restored" : "contact.archived",
      subjectType: "contact",
      subjectId: contactId,
      organizationId,
    });
    refresh(locale, organizationId);
  },
);

/* ------------------------------ lifecycle ---------------------------- */

/**
 * Archiving is how an organisation leaves the public directory — there is no
 * hard delete. Audit events reference the organisation and are append-only
 * (see server/db/schema/audit-log.ts), so a row that has ever been touched
 * cannot be removed without destroying its record.
 */
export const setOrganizationArchived = protectedPermissionAction(
  "organization.verify",
  async (formData, locale, user) => {
    const organizationId = orgIdSchema.parse(formData.get("organizationId"));
    await assertOrganizationWritable(user.id, organizationId);
    const archive = formData.get("archive") === "true";
    await db
      .update(organizations)
      .set({ status: archive ? "archived" : "draft" })
      .where(
        archive
          ? eq(organizations.id, organizationId)
          : and(
              eq(organizations.id, organizationId),
              ne(organizations.status, "verified"),
            ),
      );
    await recordAudit({
      action: archive ? "organization.archived" : "organization.restored",
      subjectType: "organization",
      subjectId: organizationId,
      organizationId,
    });
    refresh(locale, organizationId);
  },
);

/* --------------------------- representatives ------------------------- */

/**
 * The five fields `core.organization_members` requires of everybody, asked of the
 * operator too: an invited representative is a member from the moment the row is
 * reserved, and a roster row that reads `contact@` is a row nobody can act on.
 */
const inviteRepresentativeSchema = z.object({
  organizationId: orgIdSchema,
  email: z.string().trim().toLowerCase().email(),
  firstName: personName,
  lastName: personName,
  phone: phoneNumber,
  title: z.string().trim().min(2).max(160),
  roleCode: z.enum(INVITABLE_ROLE_CODES),
});

const invitationIdSchema = z.string().uuid();

/**
 * Fetch the organisation an invitation is about, failing loudly rather than
 * inviting someone into a record that no longer exists.
 */
async function requireOrganization(organizationId: string) {
  const [organization] = await db
    .select({ id: organizations.id, displayName: organizations.displayName })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  if (!organization) throw new Error("Unknown organisation");
  return organization;
}

/** The platform-defined (organisation-agnostic) template for a role code. */
async function requireRoleTemplate(code: string) {
  const [role] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(and(eq(roles.code, code), isNull(roles.organizationId)))
    .limit(1);
  if (!role) throw new Error(`Role ${code} is not seeded`);
  return role;
}

/**
 * Invite the organisation's own representative — the platform side of Phase 1.3
 * Flow 1 (docs/PHASE-1.3-COLLABORATION.md). There is no public organisation
 * signup: an operator names the address, and the invitation is what turns into
 * access.
 *
 * The membership is reserved immediately so the roster shows who is expected,
 * but the roles ride on the invitation until it is accepted — a revoked or
 * expired invitation must never have granted anything. When the address already
 * has an account there is nothing left to prove, so the roles are granted on the
 * spot and no email is sent.
 */
export const inviteOrganizationRepresentative = protectedPermissionAction(
  "organization.verify",
  async (formData, locale, user) => {
    const parsed = inviteRepresentativeSchema.parse({
      organizationId: formData.get("organizationId"),
      email: formData.get("email"),
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      phone: formData.get("phone"),
      title: formData.get("title"),
      roleCode: formData.get("roleCode"),
    });
    await assertOrganizationWritable(user.id, parsed.organizationId);

    const [organization, role] = await Promise.all([
      requireOrganization(parsed.organizationId),
      requireRoleTemplate(parsed.roleCode),
    ]);
    const [account] = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.email}) = ${parsed.email}`)
      .limit(1);

    const memberId = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({
          id: organizationMembers.id,
          userId: organizationMembers.userId,
        })
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.organizationId, parsed.organizationId),
            account
              ? or(
                  eq(organizationMembers.contactEmail, parsed.email),
                  eq(organizationMembers.userId, account.id),
                )
              : eq(organizationMembers.contactEmail, parsed.email),
          ),
        )
        .limit(1);

      const identity = {
        firstName: parsed.firstName,
        lastName: parsed.lastName,
        contactEmail: parsed.email,
        phone: parsed.phone,
        title: parsed.title,
      };
      if (!existing) {
        return insertMember(tx, {
          organizationId: parsed.organizationId,
          userId: account?.id ?? null,
          identity,
        });
      }

      /**
       * Re-inviting someone who left, or who has since created an account,
       * revives the same membership row: activity assignments and audit events
       * already point at it. The identity is rewritten from the form rather than
       * kept, because an operator inviting somebody again is stating who they are
       * now — a stale name and an unreachable number are what made the row worth
       * re-inviting.
       */
      const userId = account?.id ?? existing.userId;
      await tx
        .update(organizationMembers)
        .set({
          firstName: identity.firstName,
          lastName: identity.lastName,
          phone: identity.phone,
          title: identity.title,
          userId,
          status: userId ? "active" : "invited",
          offboardedAt: null,
        })
        .where(eq(organizationMembers.id, existing.id));
      return existing.id;
    });

    const linkedAccount = Boolean(account);
    if (linkedAccount) {
      await db
        .insert(memberRoles)
        .values({
          memberId,
          roleId: role.id,
          grantedById: user.id,
        })
        .onConflictDoNothing();
      await claimOrganizationIfSteward(memberId, parsed.organizationId);
      await recordAudit({
        action: "organization.representative_granted",
        subjectType: "member",
        subjectId: memberId,
        organizationId: parsed.organizationId,
        metadata: { role: parsed.roleCode },
      });
    } else {
      await sendRepresentativeInvitation({
        organizationId: parsed.organizationId,
        email: parsed.email,
        memberId,
        kind: invitationKindForRole(parsed.roleCode),
        roleIds: [role.id],
        invitedById: user.id,
        locale,
        organizationName: organization.displayName,
        inviterName: user.name ?? user.email ?? organization.displayName,
      });
    }
    refresh(locale, parsed.organizationId);
  },
);

/**
 * Send the invitation again with a fresh token and expiry. An invitation that
 * has already lapsed is replaced rather than extended, so the old link stays
 * dead.
 */
export const resendOrganizationInvitation = protectedPermissionAction(
  "organization.verify",
  async (formData, locale, user) => {
    const organizationId = orgIdSchema.parse(formData.get("organizationId"));
    await assertOrganizationWritable(user.id, organizationId);
    const invitationId = invitationIdSchema.parse(formData.get("invitationId"));

    const [invitation] = await db
      .select({
        id: invitations.id,
        email: invitations.email,
        kind: invitations.kind,
      })
      .from(invitations)
      .where(
        and(
          eq(invitations.id, invitationId),
          eq(invitations.organizationId, organizationId),
          isNull(invitations.acceptedAt),
          isNull(invitations.revokedAt),
        ),
      )
      .limit(1);
    if (!invitation) throw new Error("No pending invitation to resend");
    if (invitation.kind === "member") {
      throw new Error("Team invitations are resent from the team console");
    }
    /**
     * A translator invitation belongs to the translator directory and a
     * platform staff invitation to the platform console; neither reserves a
     * membership in this organisation, so neither can be resent from here.
     */
    if (
      invitation.kind !== "association_publisher" &&
      invitation.kind !== "organization_admin"
    ) {
      throw new Error(
        "Only organisation representative invitations are resent here",
      );
    }

    const [roleRows, memberRow, organization] = await Promise.all([
      db
        .select({ roleId: invitationRoles.roleId })
        .from(invitationRoles)
        .where(eq(invitationRoles.invitationId, invitation.id)),
      db
        .select({ id: organizationMembers.id })
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.organizationId, organizationId),
            sql`lower(${organizationMembers.contactEmail}) = ${invitation.email.toLowerCase()}`,
          ),
        )
        .limit(1),
      requireOrganization(organizationId),
    ]);
    const memberId = memberRow[0]?.id;
    if (!memberId) throw new Error("The invited membership no longer exists");

    await sendRepresentativeInvitation({
      organizationId,
      email: invitation.email,
      memberId,
      kind: invitation.kind,
      roleIds: roleRows.map((row) => row.roleId),
      invitedById: user.id,
      locale,
      organizationName: organization.displayName,
      inviterName: user.name ?? user.email ?? organization.displayName,
    });
    refresh(locale, organizationId);
  },
);

/**
 * Withdraw a pending invitation. The reserved membership goes with it: a
 * roster row promising access nobody can accept is worse than no row at all.
 * Anyone who already signed in keeps their membership — that invitation is
 * accepted, and this action does not touch it.
 */
export const revokeOrganizationInvitation = protectedPermissionAction(
  "organization.verify",
  async (formData, locale, user) => {
    const organizationId = orgIdSchema.parse(formData.get("organizationId"));
    await assertOrganizationWritable(user.id, organizationId);
    const invitationId = invitationIdSchema.parse(formData.get("invitationId"));

    const now = new Date();
    const [invitation] = await db
      .update(invitations)
      .set({ revokedAt: now })
      .where(
        and(
          eq(invitations.id, invitationId),
          eq(invitations.organizationId, organizationId),
          isNull(invitations.acceptedAt),
          isNull(invitations.revokedAt),
        ),
      )
      .returning({ id: invitations.id, email: invitations.email });
    if (!invitation) throw new Error("No pending invitation to revoke");

    await db
      .update(organizationMembers)
      .set({ status: "offboarded", offboardedAt: now })
      .where(
        and(
          eq(organizationMembers.organizationId, organizationId),
          sql`lower(${organizationMembers.contactEmail}) = ${invitation.email.toLowerCase()}`,
          isNull(organizationMembers.userId),
          eq(organizationMembers.status, "invited"),
        ),
      );
    await recordAudit({
      action: "organization.representative_invitation_revoked",
      subjectType: "organization",
      subjectId: organizationId,
      organizationId,
    });
    refresh(locale, organizationId);
  },
);

/**
 * Undo a claim. Support-only and always audited: it hands write access back to
 * the platform, so it exists for mistakes (a claim by the wrong person, a
 * membership created in error), not as a routine lifecycle step.
 */
export const releaseOrganizationClaim = protectedPermissionAction(
  superadminPermission,
  async (formData, locale, user) => {
    const organizationId = orgIdSchema.parse(formData.get("organizationId"));
    if (!(await hasActualPlatformPermission(user.id, superadminPermission))) {
      throw new Error("Support access required to release a claim");
    }
    const reason = z
      .string()
      .trim()
      .min(4)
      .parse(formData.get("reason") ?? "");
    await db
      .update(organizations)
      .set({ claimedAt: null })
      .where(eq(organizations.id, organizationId));
    await recordAudit({
      action: "organization.claim_released",
      subjectType: "organization",
      subjectId: organizationId,
      organizationId,
      reason,
    });
    refresh(locale, organizationId);
  },
);
