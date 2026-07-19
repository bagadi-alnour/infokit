import { desc } from "drizzle-orm";

import {
  Button,
  Card,
  Chip,
  EmptyState,
  Field,
  PageHeader,
  Select,
  TextInput,
} from "~/components/ui";
import { db } from "~/server/db";
import { organizations } from "~/server/db/schema";
import { createOrganization } from "./actions";

export default async function OrganizationsPage() {
  const rows = await db
    .select()
    .from(organizations)
    .orderBy(desc(organizations.createdAt));

  return (
    <>
      <PageHeader
        title="Organisations"
        sub="Set status to “verified” only after a real identity/duplicate check (PRODUCT.md §9)."
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card title={`All organisations (${String(rows.length)})`}>
          {rows.length === 0 ? (
            <EmptyState>
              No organisations yet — create the first one to start entering
              services.
            </EmptyState>
          ) : (
            <ul className="divide-line divide-y">
              {rows.map((org) => (
                <li
                  key={org.id}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <div>
                    <p className="text-sm font-medium">{org.displayName}</p>
                    <p className="text-muted text-xs">{org.slug}</p>
                  </div>
                  <Chip tone={org.status === "verified" ? "ok" : "neutral"}>
                    {org.status}
                  </Chip>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="New organisation">
          <form action={createOrganization} className="grid gap-3">
            <Field label="Display name">
              <TextInput name="displayName" required minLength={2} />
            </Field>
            <Field label="Legal name" hint="Optional">
              <TextInput name="legalName" />
            </Field>
            <Field
              label="Status"
              hint="“Verified” asserts a real check happened."
            >
              <Select name="status" defaultValue="draft">
                <option value="draft">draft</option>
                <option value="verified">verified</option>
              </Select>
            </Field>
            <Button>Create organisation</Button>
          </form>
        </Card>
      </div>
    </>
  );
}
