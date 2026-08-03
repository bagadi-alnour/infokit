"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, desc, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
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
import {
  protectedEditorAction,
  protectedPermissionAction,
  requirePermission,
} from "~/server/auth/require";
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
  rolePermissions,
  translationSourceVersions,
  users,
} from "~/server/db/schema";
import {
  ASSIGNABLE_ORGANIZATION_ROLE_CODES,
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
    revalidatePath(localizedPath("/dashboard/my-organization", locale));
    revalidatePath(localizedPath("/dashboard/my-organization/roles", locale));
  }
  revalidatePath(localizedPath("/dashboard", locale));
}

/**
 * Organisation-owned writes accept either a platform grant or the same grant
 * held through a role in the organisation named by the form. The record-level
 * permission check binds that role to this tenant before the action body reads
 * any other form value.
 */
function protectedOrganizationAction<Result>(
  permissionCode: string,
  action: Parameters<typeof protectedEditorAction<Result>>[0],
) {
  return protectedEditorAction<Result>(async (formData, locale, user) => {
    const organizationId = orgIdSchema.parse(formData.get("organizationId"));
    await requirePermission(permissionCode, locale, organizationId);
    return action(formData, locale, user);
  });
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

/**
 * The representative half of the creation form. Optional as a block and
 * required within it: an operator either names the person who will take the
 * record over or leaves the whole fieldset alone, because
 * `core.organization_members` takes no half-filled rows and a roster entry with
 * no phone number is one nobody can act on.
 *
 * Leaving it empty is a real choice, not an omission — a directory record
 * verified from public sources exists before anybody at the organisation has
 * agreed to maintain it (docs/PRODUCT.md §11.3).
 */
const createRepresentativeSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  firstName: personName,
  lastName: personName,
  phone: phoneNumber,
  title: z.string().trim().min(2).max(160),
  roleCode: z.enum(INVITABLE_ROLE_CODES),
});

export const createOrganization = protectedPermissionAction(
  "organization.verify",
  async (formData, locale, user) => {
    const parsed = createOrganizationSchema.parse({
      displayName: formData.get("displayName"),
      legalName: formData.get("legalName") ?? "",
      foundedYear: formData.get("foundedYear"),
      status: formData.get("status"),
    });

    /**
     * The fieldset is validated before the organisation exists, so a mistyped
     * address fails the form rather than leaving behind a record whose
     * representative step never ran.
     */
    const representativeEmail = formData.get("representativeEmail");
    const representative =
      typeof representativeEmail === "string" && representativeEmail.trim()
        ? createRepresentativeSchema.parse({
            email: representativeEmail,
            firstName: formData.get("representativeFirstName"),
            lastName: formData.get("representativeLastName"),
            phone: formData.get("representativePhone"),
            title: formData.get("representativeTitle"),
            roleCode: formData.get("representativeRoleCode"),
          })
        : null;
    /**
     * The wrapper above reads *effective* permissions, which include a
     * superadmin role-testing into an operator context. Inviting reads the
     * grant the account actually holds, the same test the invitation panel
     * applies — a role test may create a directory record, but handing an
     * organisation to somebody is not a thing to do in a simulated role.
     */
    if (
      representative &&
      !(await hasActualPlatformPermission(user.id, "organization.verify"))
    ) {
      throw new Error(
        "Inviting the representative needs the organisation verification grant",
      );
    }

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

    /**
     * Creating the record and naming who will maintain it are one errand for
     * the operator, so they are one submit. They stay two events in the ledger:
     * `organization.created` above, then the invitation's own event — which is
     * what the audit trail needs, because an organisation outliving the
     * representative who was first invited to it is the normal case.
     */
    let notice = "organization-created";
    if (representative) {
      const { invited } = await onboardRepresentative({
        organizationId: organization.id,
        organizationName: parsed.displayName,
        representative,
        locale,
        actor: user,
      });
      notice = invited
        ? "organization-created-invited"
        : "organization-created-granted";
    }

    refresh(locale, organization.id);
    redirect(
      `${localizedPath(`/dashboard/organizations/${organization.id}`, locale)}?notice=${notice}`,
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

export const updateOrganization = protectedOrganizationAction(
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
export const setOrganizationNarrativeLanguage = protectedOrganizationAction(
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

export const upsertOrganizationPurpose = protectedOrganizationAction(
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

export const addOrganizationSpeciality = protectedOrganizationAction(
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

export const retireOrganizationSpeciality = protectedOrganizationAction(
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
export const setPrimarySpeciality = protectedOrganizationAction(
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

export const toggleOrganizationLanguage = protectedOrganizationAction(
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

export const addOrganizationContact = protectedOrganizationAction(
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

export const toggleOrganizationContact = protectedOrganizationAction(
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
 * Platform operators onboard the first representative; after the organisation
 * is claimed, its own administrators invite members and assign their access.
 * Both routes land on the same audited invitation lifecycle.
 */
async function requireMemberAdministration(
  userId: string,
  organizationId: string,
  locale: Locale,
) {
  if (await hasActualPlatformPermission(userId, "organization.verify")) return;
  await requirePermission("members.manage", locale, organizationId);
  await requirePermission("roles.manage", locale, organizationId);
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
/**
 * Reserve the representative's membership and turn it into access — the part
 * that is identical whether the organisation was created a moment ago or has
 * been in the directory for a year. It performs no permission check of its
 * own: both callers gate on `requireMemberAdministration` first, and keeping
 * the gate at the entry point is what makes it visible there.
 *
 * Returns whether an email went out, which is the difference the operator
 * needs told: an address that already has an account is granted on the spot.
 */
async function onboardRepresentative({
  organizationId,
  organizationName,
  representative,
  locale,
  actor,
}: {
  organizationId: string;
  organizationName: string;
  representative: Omit<
    z.infer<typeof inviteRepresentativeSchema>,
    "organizationId"
  >;
  locale: Locale;
  actor: { id: string; name: string; email: string };
}): Promise<{ invited: boolean }> {
  const { email, roleCode } = representative;
  const role = await requireRoleTemplate(roleCode);
  const [account] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`)
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
          eq(organizationMembers.organizationId, organizationId),
          account
            ? or(
                eq(organizationMembers.contactEmail, email),
                eq(organizationMembers.userId, account.id),
              )
            : eq(organizationMembers.contactEmail, email),
        ),
      )
      .limit(1);

    const identity = {
      firstName: representative.firstName,
      lastName: representative.lastName,
      contactEmail: email,
      phone: representative.phone,
      title: representative.title,
    };
    if (!existing) {
      return insertMember(tx, {
        organizationId,
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

  if (account) {
    await db
      .insert(memberRoles)
      .values({ memberId, roleId: role.id, grantedById: actor.id })
      .onConflictDoNothing();
    await claimOrganizationIfSteward(memberId, organizationId);
    await recordAudit({
      action: "organization.representative_granted",
      subjectType: "member",
      subjectId: memberId,
      organizationId,
      metadata: { role: roleCode },
    });
    return { invited: false };
  }

  await sendRepresentativeInvitation({
    organizationId,
    email,
    memberId,
    kind: invitationKindForRole(roleCode),
    roleIds: [role.id],
    invitedById: actor.id,
    locale,
    organizationName,
    inviterName: actor.name || actor.email,
  });
  return { invited: true };
}

export const inviteOrganizationRepresentative = protectedEditorAction(
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
    await requireMemberAdministration(user.id, parsed.organizationId, locale);
    await assertOrganizationWritable(user.id, parsed.organizationId);

    const organization = await requireOrganization(parsed.organizationId);
    await onboardRepresentative({
      organizationId: parsed.organizationId,
      organizationName: organization.displayName,
      representative: parsed,
      locale,
      actor: user,
    });
    refresh(locale, parsed.organizationId);
  },
);

/**
 * Send the invitation again with a fresh token and expiry. An invitation that
 * has already lapsed is replaced rather than extended, so the old link stays
 * dead.
 */
export const resendOrganizationInvitation = protectedEditorAction(
  async (formData, locale, user) => {
    const organizationId = orgIdSchema.parse(formData.get("organizationId"));
    await requireMemberAdministration(user.id, organizationId, locale);
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
      inviterName: user.name || user.email,
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
export const revokeOrganizationInvitation = protectedEditorAction(
  async (formData, locale, user) => {
    const organizationId = orgIdSchema.parse(formData.get("organizationId"));
    await requireMemberAdministration(user.id, organizationId, locale);
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

/* ------------------------------- roles ------------------------------- */

const memberRoleSchema = z.object({
  memberId: z.string().uuid(),
  roleId: z.string().uuid(),
});

async function requireMemberForRoleChange(memberId: string) {
  const [member] = await db
    .select({
      id: organizationMembers.id,
      organizationId: organizationMembers.organizationId,
      userId: organizationMembers.userId,
    })
    .from(organizationMembers)
    .where(eq(organizationMembers.id, memberId))
    .limit(1);
  if (!member) throw new Error("Unknown organisation member");
  return member;
}

async function requireAssignableRole(roleId: string, organizationId: string) {
  const [role] = await db
    .select({
      id: roles.id,
      code: roles.code,
      organizationId: roles.organizationId,
    })
    .from(roles)
    .where(
      and(
        eq(roles.id, roleId),
        or(
          eq(roles.organizationId, organizationId),
          and(
            isNull(roles.organizationId),
            inArray(roles.code, [...ASSIGNABLE_ORGANIZATION_ROLE_CODES]),
          ),
        ),
      ),
    )
    .limit(1);
  if (!role)
    throw new Error("That role cannot be assigned in this organisation");
  return role;
}

export const grantOrganizationMemberRole = protectedEditorAction(
  async (formData, locale, user) => {
    const parsed = memberRoleSchema.parse({
      memberId: formData.get("memberId"),
      roleId: formData.get("roleId"),
    });
    const member = await requireMemberForRoleChange(parsed.memberId);
    await requirePermission("roles.manage", locale, member.organizationId);
    await assertOrganizationWritable(user.id, member.organizationId);
    const role = await requireAssignableRole(
      parsed.roleId,
      member.organizationId,
    );

    await db
      .insert(memberRoles)
      .values({
        memberId: member.id,
        roleId: role.id,
        grantedById: user.id,
      })
      .onConflictDoNothing();
    await recordAudit({
      action: "member.role_granted",
      subjectType: "member",
      subjectId: member.id,
      organizationId: member.organizationId,
      metadata: { role: role.code },
    });
    refresh(locale, member.organizationId);
  },
);

export const revokeOrganizationMemberRole = protectedEditorAction(
  async (formData, locale, user) => {
    const parsed = memberRoleSchema.parse({
      memberId: formData.get("memberId"),
      roleId: formData.get("roleId"),
    });
    const member = await requireMemberForRoleChange(parsed.memberId);
    await requirePermission("roles.manage", locale, member.organizationId);
    await assertOrganizationWritable(user.id, member.organizationId);
    const role = await requireAssignableRole(
      parsed.roleId,
      member.organizationId,
    );

    if (member.userId === user.id) {
      const [managingGrant] = await db
        .select({ code: rolePermissions.permissionCode })
        .from(rolePermissions)
        .where(
          and(
            eq(rolePermissions.roleId, role.id),
            eq(rolePermissions.permissionCode, "roles.manage"),
          ),
        )
        .limit(1);
      if (managingGrant) {
        throw new Error("You cannot remove your own role-management access.");
      }
    }

    await db
      .delete(memberRoles)
      .where(
        and(
          eq(memberRoles.memberId, member.id),
          eq(memberRoles.roleId, role.id),
        ),
      );
    await recordAudit({
      action: "member.role_revoked",
      subjectType: "member",
      subjectId: member.id,
      organizationId: member.organizationId,
      metadata: { role: role.code },
    });
    refresh(locale, member.organizationId);
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
