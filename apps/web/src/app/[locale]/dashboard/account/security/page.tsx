import { formatMessage } from "@infokit/shared/i18n";
import { loadPageCatalog } from "@infokit/shared/i18n/catalogs";
import Link from "next/link";

import { updateAccountSignIn } from "../actions";
import { AccountStatus } from "../parts";
import { enrolSecondFactorPhone } from "~/app/[locale]/login/actions";
import {
  Card,
  Field,
  Notice,
  Select,
  TextInput,
} from "~/components/admin/workspace";
import { PendingButton } from "~/components/pending-button";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { requireRouteLocale } from "~/i18n/route-locale";
import { authPath, localizedPath } from "~/i18n/routing";
import {
  getAccountSettings,
  secondFactorMandatory,
} from "~/server/account/settings";
import { maskPhone, secondFactorNumber } from "~/server/auth/second-factor";
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
  const [settings, locked, number] = await Promise.all([
    getAccountSettings(user.id),
    secondFactorMandatory(user.id),
    secondFactorNumber(user.id),
  ]);
  const changedAt = settings.twoFactorUpdatedAt
    ? new Intl.DateTimeFormat(locale, {
        dateStyle: "long",
        timeStyle: "short",
        timeZone: settings.timeZone,
      }).format(settings.twoFactorUpdatedAt)
    : null;
  // The confirmation happens where the code is entered, so the number card
  // sends people to the same page the sign-in gate uses.
  const confirmPath = authPath("verify", locale, {
    returnTo: localizedPath("/dashboard/account/security", locale),
  });

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
                <span className="text-copy-muted text-xs font-normal">
                  {number
                    ? formatMessage(messages["security.twoFactor.recipient"], {
                        phone: maskPhone(number.phone),
                      })
                    : messages["security.twoFactor.noRecipient"]}
                </span>
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

      {/* Its own form, outside the settings one: enrolling sends a code and
       * leaves for the page where that code is entered, which has nothing to do
       * with saving preferences. */}
      <Card
        title={messages["security.phone.heading"]}
        hint={messages["security.phone.hint"]}
      >
        <div className="grid gap-4">
          {number && !number.verified ? (
            <Notice tone="warn" title={messages["security.phone.pending"]}>
              {messages["security.phone.pendingHint"]}{" "}
              <Link
                href={confirmPath}
                className="text-brand underline-offset-4 hover:underline"
              >
                {messages["security.phone.confirmLink"]}
              </Link>
            </Notice>
          ) : null}
          <form action={enrolSecondFactorPhone} className="grid max-w-md gap-4">
            <input type="hidden" name="locale" value={locale} />
            <input
              type="hidden"
              name="returnTo"
              value={localizedPath("/dashboard/account/security", locale)}
            />
            <Field
              label={messages["security.phone.label"]}
              hint={messages["security.phone.labelHint"]}
            >
              <TextInput
                name="phone"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                maxLength={20}
                placeholder={messages["security.phone.placeholder"]}
                dir="ltr"
                required
              />
            </Field>
            <div>
              <PendingButton>
                {number
                  ? messages["security.phone.replace"]
                  : messages["security.phone.enrol"]}
              </PendingButton>
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
}
