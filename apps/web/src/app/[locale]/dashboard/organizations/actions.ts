"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "~/server/db";
import { localizedPath } from "~/i18n/routing";
import { organizations } from "~/server/db/schema";
import { protectedEditorAction } from "~/server/auth/require";

const createOrganizationSchema = z.object({
  displayName: z.string().trim().min(2),
  legalName: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v)),
  status: z.enum(["draft", "verified"]),
});

function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

export const createOrganization = protectedEditorAction(
  async (formData, locale) => {
    const parsed = createOrganizationSchema.parse({
      displayName: formData.get("displayName"),
      legalName: formData.get("legalName") ?? "",
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

    await db.insert(organizations).values({
      displayName: parsed.displayName,
      legalName: parsed.legalName,
      slug,
      status: parsed.status,
    });
    revalidatePath(localizedPath("/dashboard/organizations", locale));
    revalidatePath(localizedPath("/dashboard", locale));
  },
);
