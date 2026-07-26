import { loadPageCatalog } from "@infokit/shared/i18n/catalogs";
import {
  Card,
  Field,
  Notice,
  PageHeader,
  Select,
  TextInput,
  WorkspacePage,
} from "~/components/admin/workspace";
import { PendingButton } from "~/components/pending-button";
import { requireRouteLocale } from "~/i18n/route-locale";
import { localizedPath } from "~/i18n/routing";
import { getRoleTestState } from "~/server/auth/authorization";
import { requireEditor } from "~/server/auth/require";
import { createOrganization } from "../actions";

export default async function NewOrganizationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = requireRouteLocale((await params).locale);
  const t = await loadPageCatalog(locale, "dashboard-console");
  // Only the platform creates directory records. Someone without the
  // permission is told so here rather than by a failed submit.
  const user = await requireEditor(locale);
  const authorization = await getRoleTestState(user.id);
  const canCreate = authorization.effectivePermissions.has(
    "organization.verify",
  );
  if (!canCreate) {
    return (
      <WorkspacePage width="narrow">
        <PageHeader
          back={{
            href: localizedPath("/dashboard/organizations", locale),
            label: t["org.listTitle"],
          }}
          title={t["org.newTitle"]}
        />
        <Notice tone="warn" title={t["console.readOnlyTitle"]}>
          {t["org.createDenied"]}
        </Notice>
      </WorkspacePage>
    );
  }
  return (
    <WorkspacePage width="narrow">
      <PageHeader
        back={{
          href: localizedPath("/dashboard/organizations", locale),
          label: t["org.listTitle"],
        }}
        title={t["org.newTitle"]}
        sub={t["org.newSub"]}
      />
      <Notice tone="info" title={t["org.claimFlowTitle"]}>
        {t["org.claimFlowBody"]}
      </Notice>
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
            <PendingButton>{t["console.create"]}</PendingButton>
          </div>
        </form>
      </Card>
    </WorkspacePage>
  );
}
