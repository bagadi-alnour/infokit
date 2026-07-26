import { loadPageCatalog } from "@infokit/shared/i18n/catalogs";
import type { NotificationChannel } from "@infokit/validation/account";

import { updateAccountNotifications } from "../actions";
import { AccountStatus } from "../parts";
import {
  Card,
  Field,
  Select,
  Table,
  TableBody,
  TableHeader,
  TableRow,
  TD,
  TH,
} from "~/components/admin/workspace";
import { Icon } from "~/components/icons";
import { PendingButton } from "~/components/pending-button";
import { Checkbox } from "~/components/ui/checkbox";
import { requireRouteLocale } from "~/i18n/route-locale";
import {
  getAccountSettings,
  getNotificationSelection,
  notificationKindPolicies,
} from "~/server/account/settings";
import { requireEditor } from "~/server/auth/require";

const channels: readonly NotificationChannel[] = [
  "email",
  "sms",
  "push",
  "inApp",
];

/**
 * Whole hours only: a quiet window is "after work" and "before work", and an
 * hour list is a menu instead of a free-text time field nobody can mistype.
 */
function hourOptions(
  locale: string,
  clockFormat: "h12" | "h24",
  selected: readonly (string | null)[],
) {
  const formatter = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: clockFormat === "h12",
    timeZone: "UTC",
  });
  const values = Array.from(
    { length: 24 },
    (_, hour) => `${String(hour).padStart(2, "0")}:00`,
  );
  // A window saved at a finer grain than this page offers stays selectable,
  // so opening the page never silently moves someone's quiet hours.
  for (const value of selected) {
    if (value && !values.includes(value)) values.push(value);
  }
  return values.sort().map((value) => ({
    value,
    label: formatter.format(
      new Date(
        Date.UTC(2024, 0, 1, Number(value.slice(0, 2)), Number(value.slice(3))),
      ),
    ),
  }));
}

export default async function AccountNotificationsPage({
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
  const [settings, selection] = await Promise.all([
    getAccountSettings(user.id),
    getNotificationSelection(user.id),
  ]);
  const hours = hourOptions(locale, settings.clockFormat, [
    settings.quietHoursStart,
    settings.quietHoursEnd,
  ]);

  return (
    <div className="grid gap-5">
      <AccountStatus
        status={query.status}
        error={query.error}
        savedLabel={messages["account.status.saved"]}
        errorLabels={{ invalid: messages["account.status.error"] }}
      />
      <form action={updateAccountNotifications} className="grid gap-5">
        <input type="hidden" name="locale" value={locale} />

        <Card
          title={messages["notify.heading"]}
          hint={messages["notify.hint"]}
          className="overflow-hidden"
        >
          <div className="-mx-1 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TH>{messages["notify.kind"]}</TH>
                  {channels.map((channel) => (
                    <TH key={channel} className="text-center">
                      {messages[`notify.channel.${channel}`]}
                    </TH>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {notificationKindPolicies.map((policy) => (
                  <TableRow key={policy.kind}>
                    <TD className="max-w-xs">
                      <span className="block text-sm font-medium">
                        {messages[`notify.kind.${policy.kind}`]}
                      </span>
                      {policy.alwaysOn ? (
                        <span className="text-copy-muted text-xs">
                          {messages["notify.always"]}
                        </span>
                      ) : null}
                    </TD>
                    {channels.map((channel) => {
                      const deliverable = policy.channels.includes(channel);
                      const label = `${messages[`notify.kind.${policy.kind}`]} — ${messages[`notify.channel.${channel}`]}`;
                      return (
                        <TD key={channel} className="text-center">
                          {!deliverable ? (
                            <>
                              <span aria-hidden className="text-copy-muted">
                                —
                              </span>
                              <span className="sr-only">
                                {messages["notify.unavailable"]}
                              </span>
                            </>
                          ) : policy.alwaysOn ? (
                            // Nothing to decide: an account-security message is
                            // delivered whatever this page says, so it shows the
                            // fact instead of a switch that would be ignored.
                            <span
                              className="text-ok inline-flex"
                              title={messages["notify.always"]}
                            >
                              <Icon name="check" size={16} />
                              <span className="sr-only">
                                {messages["notify.always"]}
                              </span>
                            </span>
                          ) : (
                            <Checkbox
                              name="channels"
                              value={`${policy.kind}:${channel}`}
                              defaultChecked={selection[policy.kind][channel]}
                              aria-label={label}
                              className="mx-auto"
                            />
                          )}
                        </TD>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>

        <Card
          title={messages["notify.rhythm.heading"]}
          hint={messages["notify.rhythm.hint"]}
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              label={messages["notify.digest"]}
              hint={messages["notify.digestHint"]}
            >
              <Select name="digest" defaultValue={settings.digest}>
                <option value="weekly">
                  {messages["notify.digest.weekly"]}
                </option>
                <option value="daily">{messages["notify.digest.daily"]}</option>
                <option value="off">{messages["notify.digest.off"]}</option>
              </Select>
            </Field>
            <Field
              label={messages["notify.quietFrom"]}
              hint={messages["notify.quietHint"]}
            >
              <Select
                name="quietHoursStart"
                defaultValue={settings.quietHoursStart ?? ""}
              >
                <option value="">{messages["notify.quiet.none"]}</option>
                {hours.map((hour) => (
                  <option key={hour.value} value={hour.value}>
                    {hour.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={messages["notify.quietUntil"]}>
              <Select
                name="quietHoursEnd"
                defaultValue={settings.quietHoursEnd ?? ""}
              >
                <option value="">{messages["notify.quiet.none"]}</option>
                {hours.map((hour) => (
                  <option key={hour.value} value={hour.value}>
                    {hour.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Card>

        <div>
          <PendingButton>{messages["account.save"]}</PendingButton>
        </div>
      </form>
    </div>
  );
}
