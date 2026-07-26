import { formatMessage } from "@infokit/shared/i18n";
import { loadPageCatalog } from "@infokit/shared/i18n/catalogs";
import Link from "next/link";

import { updateAccountSignIn } from "../actions";
import { AccountStatus } from "../parts";
import { Card, Field, Notice, Select } from "~/components/admin/workspace";
import { PendingButton } from "~/components/pending-button";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { requireRouteLocale } from "~/i18n/route-locale";
import { localizedPath } from "~/i18n/routing";
import { getAccountSettings } from "~/server/account/settings";
import { isPlatformAdmin } from "~/server/auth/authorization";
import { editorRecipient, maskPhone } from "~/server/auth/editors";
import { requireEditor } from "~/server/auth/require";

export default async function AccountSecurityPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string; error?: string }>;
}) {
  const locale = requireRouteLocale((await params).locale);
  const user = await requireEditor(locale);
  const query = await searchParams;
  const messages = await loadPageCatalog(locale, "dashboard-account");
  const [settings, locked] = await Promise.all([
    getAccountSettings(user.id),
    isPlatformAdmin(user.id),
  ]);
  // The number lives in the delivery allowlist, never in the database: this
  // page can say where a code goes without the row knowing.
  const recipient = user.email ? editorRecipient(user.email) : undefined;
  const changedAt = settings.twoFactorUpdatedAt
    ? new Intl.DateTimeFormat(locale, {
        dateStyle: "long",
        timeStyle: "short",
        timeZone: settings.timeZone,
      }).format(settings.twoFactorUpdatedAt)
    : null;

  return (
    <div className="grid gap-5">
      <AccountStatus
        status={query.status}
        error={query.error}
        savedLabel={messages["account.status.saved"]}
        errorLabels={{
          invalid: messages["account.status.error"],
          twoFactorRequired: messages["security.error.twoFactorRequired"],
        }}
      />
      <form action={updateAccountSignIn} className="grid gap-5">
        <input type="hidden" name="locale" value={locale} />
        {/* One second-factor method ships today; the column already carries the
         * others, so the form states which one it is rather than implying a
         * choice that does not exist yet. */}
        <input type="hidden" name="twoFactorMethod" value="sms" />

        <Card
          title={messages["security.heading"]}
          hint={messages["security.hint"]}
        >
          <div className="grid max-w-md gap-4">
            <Field
              label={messages["security.method"]}
              hint={messages["security.methodHint"]}
            >
              <Select
                name="preferredSignInMethod"
                defaultValue={
                  settings.preferredSignInMethod === "password"
                    ? "password"
                    : "magic_link"
                }
              >
                <option value="magic_link">
                  {messages["security.method.magic_link"]}
                </option>
                <option value="password">
                  {messages["security.method.password"]}
                </option>
              </Select>
            </Field>
            <p className="text-sm">
              <Link
                href={localizedPath("/dashboard/account/password", locale)}
                className="text-brand underline-offset-4 hover:underline"
              >
                {messages["security.password.link"]}
              </Link>
            </p>
          </div>
        </Card>

        <Card
          title={messages["security.twoFactor.heading"]}
          hint={messages["security.twoFactor.hint"]}
        >
          <div className="grid gap-4">
            {locked ? (
              <Notice title={messages["security.twoFactor.locked"]}>
                {messages["security.twoFactor.lockedHint"]}
              </Notice>
            ) : null}
            <Label className="flex items-start gap-3 text-sm font-medium">
              <Switch
                name="twoFactorEnabled"
                defaultChecked={locked || settings.twoFactorEnabled}
                disabled={locked}
                className="mt-0.5"
              />
              <span className="grid gap-1">
                <span>{messages["security.twoFactor.label"]}</span>
                {recipient ? (
                  <span className="text-copy-muted text-xs font-normal">
                    {formatMessage(messages["security.twoFactor.recipient"], {
                      phone: maskPhone(recipient.phone),
                    })}
                  </span>
                ) : (
                  <span className="text-copy-muted text-xs font-normal">
                    {messages["security.twoFactor.noRecipient"]}
                  </span>
                )}
              </span>
            </Label>
            {locked ? null : (
              <Notice tone="warn" title={messages["security.twoFactor.risk"]}>
                {messages["security.twoFactor.riskHint"]}
              </Notice>
            )}
            {changedAt ? (
              <p className="text-copy-muted text-xs">
                {formatMessage(messages["security.twoFactor.updated"], {
                  date: changedAt,
                })}
              </p>
            ) : null}
            <div>
              <PendingButton>{messages["account.save"]}</PendingButton>
            </div>
          </div>
        </Card>
      </form>
    </div>
  );
}
