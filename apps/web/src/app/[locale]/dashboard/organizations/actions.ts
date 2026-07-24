"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNull, ne } from "drizzle-orm";
import { z } from "zod";
import { type Locale } from "@calais/shared/i18n";

import { localizedPath } from "~/i18n/routing";
import { recordAudit } from "~/server/audit";
import { protectedPermissionAction } from "~/server/auth/require";
import { db } from "~/server/db";
import {
  contacts,
  contactTranslations,
  organizationLanguages,
  organizationProfiles,
  organizationProfileTranslations,
  organizations,
  organizationSpecialities,
} from "~/server/db/schema";

const optional = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v));

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
  legalName: optional,
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
  legalName: optional,
  foundedYear: optionalFoundedYear,
  status: z.enum(["draft", "verified", "suspended"]),
  website: optional,
  sourceUrl: optional,
  sourceCheckedOn: optional,
  published: z.literal("on").nullable(),
});

export const updateOrganization = protectedPermissionAction(
  "organization.profile.manage",
  async (formData, locale) => {
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

const purposeSchema = z.object({
  organizationId: orgIdSchema,
  languageCode: z.enum(["fr", "en", "ar"]),
  purpose: z.string().trim().min(1),
  goals: optional,
  values: optional,
});

export const upsertOrganizationPurpose = protectedPermissionAction(
  "organization.profile.manage",
  async (formData, locale) => {
    const parsed = purposeSchema.parse({
      organizationId: formData.get("organizationId"),
      languageCode: formData.get("languageCode"),
      purpose: formData.get("purpose"),
      goals: formData.get("goals") ?? "",
      values: formData.get("values") ?? "",
    });
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
  async (formData, locale) => {
    const organizationId = orgIdSchema.parse(formData.get("organizationId"));
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
  async (formData, locale) => {
    const organizationId = orgIdSchema.parse(formData.get("organizationId"));
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

/** Primary is optional (PRODUCT.md §14.3): empty value clears it (co-equal). */
export const setPrimarySpeciality = protectedPermissionAction(
  "organization.profile.manage",
  async (formData, locale) => {
    const organizationId = orgIdSchema.parse(formData.get("organizationId"));
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
  async (formData, locale) => {
    const organizationId = orgIdSchema.parse(formData.get("organizationId"));
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
    refresh(locale, organizationId);
  },
);

/* ------------------------------ contacts ----------------------------- */

const contactSchema = z.object({
  organizationId: orgIdSchema,
  kind: z.enum(["phone", "whatsapp", "email", "on_site", "url"]),
  value: optional,
  labelFr: optional,
});

export const addOrganizationContact = protectedPermissionAction(
  "organization.profile.manage",
  async (formData, locale) => {
    const parsed = contactSchema.parse({
      organizationId: formData.get("organizationId"),
      kind: formData.get("kind"),
      value: formData.get("value") ?? "",
      labelFr: formData.get("labelFr") ?? "",
    });
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
  async (formData, locale) => {
    const organizationId = orgIdSchema.parse(formData.get("organizationId"));
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

export const setOrganizationArchived = protectedPermissionAction(
  "organization.verify",
  async (formData, locale) => {
    const organizationId = orgIdSchema.parse(formData.get("organizationId"));
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
