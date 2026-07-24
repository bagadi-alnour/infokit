import Link from "next/link";

import { loadPageCatalog } from "@calais/shared/i18n/catalogs";
import {
  Button,
  Card,
  Field,
  PageHeader,
  Select,
  TextInput,
} from "~/components/admin/workspace";
import { requireRouteLocale } from "~/i18n/route-locale";
import { localizedPath } from "~/i18n/routing";
import { createOrganization } from "../actions";

export default async function NewOrganizationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = requireRouteLocale((await params).locale);
  const t = await loadPageCatalog(locale, "dashboard-console");
  return (
    <div className="mx-auto max-w-lg">
      <Link
        href={localizedPath("/dashboard/organizations", locale)}
        className="text-brand text-sm"
      >
        ← {t["console.back"]}
      </Link>
      <PageHeader title={t["org.newTitle"]} sub={t["org.statusHint"]} />
      <Card>
        <form action={createOrganization} className="grid gap-4">
          <input type="hidden" name="locale" value={locale} />
          <Field label={t["field.displayName"]}>
            <TextInput name="displayName" required minLength={2} autoFocus />
          </Field>
          <Field label={t["field.legalName"]} hint={t["console.optional"]}>
            <TextInput name="legalName" />
          </Field>
          <Field label={t["field.foundedYear"]} hint={t["console.optional"]}>
            <TextInput
              name="foundedYear"
              type="number"
              inputMode="numeric"
              min={1800}
              max={new Date().getFullYear()}
            />
          </Field>
          <Field label={t["field.status"]} hint={t["org.statusHint"]}>
            <Select name="status" defaultValue="draft">
              <option value="draft">{t["status.draft"]}</option>
              <option value="verified">{t["status.verified"]}</option>
            </Select>
          </Field>
          <div>
            <Button>{t["console.create"]}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
