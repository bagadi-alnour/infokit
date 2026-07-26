"use server";

import { type Locale } from "@infokit/shared/i18n";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { localizedPath } from "~/i18n/routing";
import {
  parseStewardContact,
  type StewardContactValues,
} from "~/lib/steward-contact";
import { recordAudit } from "~/server/audit";
import { protectedPermissionAction } from "~/server/auth/require";
import { db } from "~/server/db";
import {
  activities,
  editorialEntries,
  flows,
  organizationProfiles,
} from "~/server/db/schema";

/**
 * The workspace-only steward contact — "who to ask about this record" — for the
 * content types whose editor is split across several forms. One action per type
 * rather than one generic one, because each carries its own permission: the gate
 * is the same one that guards editing the record itself.
 *
 * The contact is never published. Only the three columns are written, so saving
 * it cannot touch a draft, a translation, or a publication state.
 */

const recordId = z.string().uuid();

/**
 * Audit metadata says whether a way to reach someone was recorded, never the
 * number or address itself (AGENTS.md: no sensitive values in the trail).
 */
function stewardMetadata(values: StewardContactValues) {
  return {
    named: values.stewardName !== null,
    phone: values.stewardPhone !== null,
    email: values.stewardEmail !== null,
  };
}

function refresh(path: string, locale: Locale) {
  revalidatePath(localizedPath(path, locale));
}

export const updateActivitySteward = protectedPermissionAction(
  "content.activity.manage",
  async (formData, locale) => {
    const id = recordId.parse(formData.get("recordId"));
    const steward = parseStewardContact(formData);
    const [row] = await db
      .update(activities)
      .set(steward)
      .where(eq(activities.id, id))
      .returning({
        id: activities.id,
        organizationId: activities.organizationId,
      });
    if (!row) throw new Error("Unknown activity");
    await recordAudit({
      action: "activity.steward_contact.set",
      subjectType: "activity",
      subjectId: row.id,
      organizationId: row.organizationId,
      metadata: stewardMetadata(steward),
    });
    refresh("/dashboard/activities", locale);
  },
);

/**
 * Articles, fixed information and basic information are all editorial entries,
 * so one action serves every screen that edits one.
 */
export const updateEditorialSteward = protectedPermissionAction(
  "content.article.write",
  async (formData, locale) => {
    const id = recordId.parse(formData.get("recordId"));
    const steward = parseStewardContact(formData);
    const [row] = await db
      .update(editorialEntries)
      .set(steward)
      .where(eq(editorialEntries.id, id))
      .returning({ id: editorialEntries.id });
    if (!row) throw new Error("Unknown editorial entry");
    await recordAudit({
      action: "editorial.steward_contact.set",
      subjectType: "editorial_entry",
      subjectId: row.id,
      metadata: stewardMetadata(steward),
    });
    refresh("/dashboard/articles", locale);
  },
);

/**
 * The organisation's steward lives on its profile row, which a directory record
 * may not have yet — a record the platform entered but nobody has filled in. So
 * this writes the profile rather than updating it, creating the row when the
 * contact is the first thing anyone records.
 */
export const updateOrganizationSteward = protectedPermissionAction(
  "organization.profile.manage",
  async (formData, locale) => {
    const id = recordId.parse(formData.get("recordId"));
    const steward = parseStewardContact(formData);
    const [row] = await db
      .insert(organizationProfiles)
      .values({ organizationId: id, ...steward })
      .onConflictDoUpdate({
        target: organizationProfiles.organizationId,
        set: steward,
      })
      .returning({ id: organizationProfiles.organizationId });
    if (!row) throw new Error("Unknown organization");
    await recordAudit({
      action: "organization.steward_contact.set",
      subjectType: "organization",
      subjectId: row.id,
      organizationId: row.id,
      metadata: stewardMetadata(steward),
    });
    revalidatePath(
      `${localizedPath("/dashboard/organizations", locale)}/${row.id}`,
    );
  },
);

export const updateSimulatorFlowSteward = protectedPermissionAction(
  "content.simulator.review",
  async (formData, locale) => {
    const id = recordId.parse(formData.get("recordId"));
    const steward = parseStewardContact(formData);
    const [row] = await db
      .update(flows)
      .set(steward)
      .where(eq(flows.id, id))
      .returning({
        id: flows.id,
        ownerOrganizationId: flows.ownerOrganizationId,
      });
    if (!row) throw new Error("Unknown flow");
    await recordAudit({
      action: "simulator.steward_contact.set",
      subjectType: "simulator_flow",
      subjectId: row.id,
      organizationId: row.ownerOrganizationId,
      metadata: stewardMetadata(steward),
    });
    revalidatePath(
      `${localizedPath("/dashboard/simulator", locale)}/${row.id}`,
    );
  },
);
