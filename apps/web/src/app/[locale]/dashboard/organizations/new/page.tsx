import { loadPageCatalog } from "@infokit/shared/i18n/catalogs";
import { ActionFeedbackForm } from "~/components/admin/action-feedback-form";
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
import { hasActualPlatformPermission } from "~/server/auth/authorization";
import { requireEditor } from "~/server/auth/require";
import { INVITABLE_ROLE_CODES } from "~/server/invitations";
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
  const canCreate = await hasActualPlatformPermission(
    user.id,
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
        <ActionFeedbackForm
          action={createOrganization}
          successMessage={t["org.createSuccess"]}
          errorMessage={t["org.createError"]}
          className="grid gap-4"
        >
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

          {/* The second half of the same errand. It is one form because
           * creating a record and naming who will maintain it is one decision
           * for an operator — and it is optional because a directory entry
           * verified from public sources legitimately exists before anybody at
           * the organisation has agreed to keep it up to date. */}
          <fieldset className="border-line mt-2 grid gap-4 border-t pt-5">
            <legend className="sr-only">{t["org.representativeTitle"]}</legend>
            <div className="grid gap-1">
              <h2 className="text-ink text-base font-bold">
                {t["org.representativeTitle"]}
              </h2>
              <p className="text-copy-muted text-sm leading-relaxed">
                {t["org.representativeSub"]}
              </p>
            </div>
            <Field
              label={t["invite.email"]}
              hint={t["org.representativeEmailHint"]}
            >
              <TextInput name="representativeEmail" type="email" />
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label={t["invite.firstName"]}>
                <TextInput name="representativeFirstName" />
              </Field>
              <Field label={t["invite.lastName"]}>
                <TextInput name="representativeLastName" />
              </Field>
              <Field label={t["invite.title"]} hint={t["invite.titleHint"]}>
                <TextInput name="representativeTitle" />
              </Field>
              <Field label={t["invite.phone"]}>
                <TextInput name="representativePhone" type="tel" dir="ltr" />
              </Field>
            </div>
            <Field label={t["invite.role"]}>
              <Select
                name="representativeRoleCode"
                defaultValue="organization_admin"
              >
                {INVITABLE_ROLE_CODES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </Select>
            </Field>
          </fieldset>

          <div>
            <PendingButton>{t["console.create"]}</PendingButton>
          </div>
        </ActionFeedbackForm>
      </Card>
    </WorkspacePage>
  );
}
