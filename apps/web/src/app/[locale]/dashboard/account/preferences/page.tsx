import {
  localeMetadata,
  translatedInterfaceLocales,
} from "@infokit/shared/i18n";
import { loadPageCatalog } from "@infokit/shared/i18n/catalogs";

import { updateAccountPreferences } from "../actions";
import { AccountStatus } from "../parts";
import {
  AccountThemeField,
  AccountTimeZoneField,
} from "~/components/admin/account-preference-fields";
import {
  Card,
  ControlField,
  Field,
  Select,
} from "~/components/admin/workspace";
import { PendingButton } from "~/components/pending-button";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { requireRouteLocale } from "~/i18n/route-locale";
import { getAccountSettings } from "~/server/account/settings";
import { requireEditor } from "~/server/auth/require";

/**
 * ISO weekdays in their own language: 1 January 2024 was a Monday, so counting
 * from it gives Monday…Sunday without a translation key per day.
 */
function weekdayOptions(locale: string) {
  const formatter = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    timeZone: "UTC",
  });
  return Array.from({ length: 7 }, (_, index) => ({
    value: String(index + 1),
    label: formatter.format(new Date(Date.UTC(2024, 0, 1 + index))),
  }));
}

export default async function AccountPreferencesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string; error?: string }>;
}) {
  const locale = requireRouteLocale((await params).locale);
  const [user, query, messages] = await Promise.all([
    requireEditor(locale),
    searchParams,
    loadPageCatalog(locale, "dashboard-account"),
  ]);
  const settings = await getAccountSettings(user.id);

  return (
    <div className="grid gap-5">
      <AccountStatus
        status={query.status}
        error={query.error}
        savedLabel={messages["account.status.saved"]}
        errorLabels={{ invalid: messages["account.status.error"] }}
      />
      <form action={updateAccountPreferences} className="grid gap-5">
        <input type="hidden" name="locale" value={locale} />

        <Card
          title={messages["preferences.heading"]}
          hint={messages["preferences.hint"]}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={messages["preferences.language"]}
              hint={messages["preferences.languageHint"]}
            >
              <Select
                name="preferredLanguageCode"
                defaultValue={settings.preferredLanguageCode ?? ""}
              >
                <option value="">
                  {messages["preferences.language.request"]}
                </option>
                {translatedInterfaceLocales.map((code) => (
                  <option key={code} value={code}>
                    {localeMetadata[code].label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label={messages["ui.theme"]}
              hint={messages["preferences.themeHint"]}
            >
              <AccountThemeField
                name="theme"
                defaultValue={settings.theme}
                labels={{
                  system: messages["ui.theme.system"],
                  light: messages["ui.theme.light"],
                  dark: messages["ui.theme.dark"],
                }}
              />
            </Field>
            <Field
              label={messages["preferences.density"]}
              hint={messages["preferences.densityHint"]}
            >
              <Select name="density" defaultValue={settings.density}>
                <option value="comfortable">
                  {messages["preferences.density.comfortable"]}
                </option>
                <option value="compact">
                  {messages["preferences.density.compact"]}
                </option>
              </Select>
            </Field>
            {/*
              No "open the console on" control here either. Honouring it would
              mean every sign-in completion path resolving a stored section, and
              a reader who then clicked "Today's runbook" would be redirected
              away from the page they asked for. Not worth that for one saved
              click, so the field is gone rather than left pretending.
            */}
          </div>
        </Card>

        <Card
          title={messages["preferences.time.heading"]}
          hint={messages["preferences.time.hint"]}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <ControlField
              label={messages["preferences.timeZone"]}
              htmlFor="timeZone"
              hint={messages["preferences.timeZoneHint"]}
            >
              <AccountTimeZoneField
                id="timeZone"
                name="timeZone"
                defaultValue={settings.timeZone}
                label={messages["preferences.timeZone"]}
                placeholder={messages["preferences.timeZonePlaceholder"]}
                emptyLabel={messages["preferences.timeZoneEmpty"]}
              />
            </ControlField>
            <Field label={messages["preferences.clockFormat"]}>
              <Select name="clockFormat" defaultValue={settings.clockFormat}>
                <option value="h24">{messages["preferences.clock.h24"]}</option>
                <option value="h12">{messages["preferences.clock.h12"]}</option>
              </Select>
            </Field>
            <Field label={messages["preferences.weekStart"]}>
              <Select
                name="weekStartsOn"
                defaultValue={String(settings.weekStartsOn)}
              >
                {weekdayOptions(locale).map((day) => (
                  <option key={day.value} value={day.value}>
                    {day.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Card>

        <Card
          title={messages["preferences.comfort.heading"]}
          hint={messages["preferences.comfort.hint"]}
        >
          <div className="grid gap-3">
            <Label className="flex items-start gap-3 text-sm font-medium">
              <Switch
                name="reducedMotion"
                defaultChecked={settings.reducedMotion}
                className="mt-0.5"
              />
              <span className="grid gap-1">
                <span>{messages["preferences.reducedMotion"]}</span>
                <span className="text-copy-muted text-xs font-normal">
                  {messages["preferences.reducedMotionHint"]}
                </span>
              </span>
            </Label>
            <Label className="flex items-start gap-3 text-sm font-medium">
              <Switch
                name="highContrast"
                defaultChecked={settings.highContrast}
                className="mt-0.5"
              />
              <span className="grid gap-1">
                <span>{messages["preferences.highContrast"]}</span>
                <span className="text-copy-muted text-xs font-normal">
                  {messages["preferences.highContrastHint"]}
                </span>
              </span>
            </Label>
          </div>
        </Card>

        <div>
          <PendingButton>{messages["account.save"]}</PendingButton>
        </div>
      </form>
    </div>
  );
}
