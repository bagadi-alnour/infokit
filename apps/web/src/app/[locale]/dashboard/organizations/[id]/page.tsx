import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, isNull } from "drizzle-orm";

import { loadPageCatalog } from "@calais/shared/i18n/catalogs";
import { Icon } from "~/components/icons";
import { PendingButton } from "~/components/pending-button";
import {
  Card,
  Chip,
  EmptyState,
  Field,
  PageHeader,
  Select,
  TextArea,
  TextInput,
} from "~/components/admin/workspace";
import { Checkbox } from "~/components/ui/checkbox";
import { Label } from "~/components/ui/label";
import { requireRouteLocale } from "~/i18n/route-locale";
import { localizedPath } from "~/i18n/routing";
import { db } from "~/server/db";
import {
  activities,
  activityTranslations,
  contacts,
  contactTranslations,
  languages,
  organizationLanguages,
  organizationProfiles,
  organizationProfileTranslations,
  organizations,
  organizationSpecialities,
  specialities,
  specialityTranslations,
} from "~/server/db/schema";
import {
  addOrganizationContact,
  addOrganizationSpeciality,
  retireOrganizationSpeciality,
  setOrganizationArchived,
  setPrimarySpeciality,
  toggleOrganizationContact,
  toggleOrganizationLanguage,
  updateOrganization,
  upsertOrganizationPurpose,
} from "../actions";

const statusTone = {
  draft: "neutral",
  verified: "ok",
  suspended: "warn",
  archived: "neutral",
} as const;

const LOCALES = ["fr", "en", "ar"] as const;
const CONTACT_KINDS = ["phone", "whatsapp", "email", "on_site", "url"] as const;

export default async function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale: rawLocale, id } = await params;
  const locale = requireRouteLocale(rawLocale);
  const t = await loadPageCatalog(locale, "dashboard-console");

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, id));
  if (!org) notFound();

  const [profile] = await db
    .select()
    .from(organizationProfiles)
    .where(eq(organizationProfiles.organizationId, id));
  const narratives = new Map(
    (
      await db
        .select()
        .from(organizationProfileTranslations)
        .where(eq(organizationProfileTranslations.organizationId, id))
    ).map((row) => [row.languageCode, row]),
  );

  const assignments = await db
    .select({
      id: organizationSpecialities.id,
      isPrimary: organizationSpecialities.isPrimary,
      specialityId: organizationSpecialities.specialityId,
      code: specialities.code,
      label: specialityTranslations.label,
    })
    .from(organizationSpecialities)
    .innerJoin(
      specialities,
      eq(organizationSpecialities.specialityId, specialities.id),
    )
    .leftJoin(
      specialityTranslations,
      and(
        eq(specialityTranslations.specialityId, specialities.id),
        eq(specialityTranslations.languageCode, "fr"),
      ),
    )
    .where(
      and(
        eq(organizationSpecialities.organizationId, id),
        isNull(organizationSpecialities.retiredAt),
      ),
    )
    .orderBy(asc(specialities.displayOrder));

  const allSpecialities = await db
    .select({
      id: specialities.id,
      code: specialities.code,
      label: specialityTranslations.label,
    })
    .from(specialities)
    .leftJoin(
      specialityTranslations,
      and(
        eq(specialityTranslations.specialityId, specialities.id),
        eq(specialityTranslations.languageCode, "fr"),
      ),
    )
    .where(eq(specialities.enabled, true))
    .orderBy(asc(specialities.displayOrder));
  const assignedIds = new Set(assignments.map((a) => a.specialityId));
  const addable = allSpecialities.filter((s) => !assignedIds.has(s.id));

  const allLanguages = await db
    .select()
    .from(languages)
    .orderBy(asc(languages.publicSortOrder));
  const orgLangs = new Set(
    (
      await db
        .select({ languageCode: organizationLanguages.languageCode })
        .from(organizationLanguages)
        .where(eq(organizationLanguages.organizationId, id))
    ).map((row) => row.languageCode),
  );

  const contactRows = await db
    .select({
      id: contacts.id,
      kind: contacts.kind,
      value: contacts.value,
      active: contacts.active,
      label: contactTranslations.label,
    })
    .from(contacts)
    .leftJoin(
      contactTranslations,
      and(
        eq(contactTranslations.contactId, contacts.id),
        eq(contactTranslations.languageCode, "fr"),
      ),
    )
    .where(eq(contacts.organizationId, id))
    .orderBy(asc(contacts.displayOrder));

  const orgActivities = await db
    .select({
      id: activities.id,
      name: activityTranslations.name,
      published: activities.published,
    })
    .from(activities)
    .leftJoin(
      activityTranslations,
      and(
        eq(activityTranslations.activityId, activities.id),
        eq(activityTranslations.languageCode, "fr"),
      ),
    )
    .where(
      and(eq(activities.organizationId, id), isNull(activities.archivedAt)),
    );

  const archived = org.status === "archived";
  const hidden = <input type="hidden" name="organizationId" value={org.id} />;
  const localeHidden = <input type="hidden" name="locale" value={locale} />;

  return (
    <>
      <Link
        href={localizedPath("/dashboard/organizations", locale)}
        className="text-brand text-sm"
      >
        ← {t["console.back"]}
      </Link>
      <PageHeader
        title={org.displayName}
        sub={org.slug}
        action={
          <span className="flex items-center gap-2">
            <Chip tone={statusTone[org.status]}>
              {t[`status.${org.status}`]}
            </Chip>
            <form action={setOrganizationArchived}>
              {localeHidden}
              {hidden}
              <input
                type="hidden"
                name="archive"
                value={archived ? "false" : "true"}
              />
              <PendingButton variant="secondary">
                <span className="inline-flex items-center gap-1.5">
                  <Icon name="archive" size={15} />
                  {archived ? t["console.restore"] : t["console.archive"]}
                </span>
              </PendingButton>
            </form>
          </span>
        }
      />

      <div className="grid gap-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title={t["section.profile"]}>
            <form action={updateOrganization} className="grid gap-3">
              {localeHidden}
              {hidden}
              <Field label={t["field.displayName"]}>
                <TextInput
                  name="displayName"
                  required
                  minLength={2}
                  defaultValue={org.displayName}
                />
              </Field>
              <Field label={t["field.legalName"]} hint={t["console.optional"]}>
                <TextInput
                  name="legalName"
                  defaultValue={org.legalName ?? ""}
                />
              </Field>
              <Field
                label={t["field.foundedYear"]}
                hint={t["console.optional"]}
              >
                <TextInput
                  name="foundedYear"
                  type="number"
                  inputMode="numeric"
                  min={1800}
                  max={new Date().getFullYear()}
                  defaultValue={org.foundedYear ?? ""}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t["field.status"]}>
                  <Select
                    name="status"
                    defaultValue={archived ? "draft" : org.status}
                  >
                    <option value="draft">{t["status.draft"]}</option>
                    <option value="verified">{t["status.verified"]}</option>
                    <option value="suspended">{t["status.suspended"]}</option>
                  </Select>
                </Field>
                <Field label={t["field.website"]} hint={t["console.optional"]}>
                  <TextInput
                    name="website"
                    inputMode="url"
                    defaultValue={profile?.website ?? ""}
                  />
                </Field>
              </div>
              <Field label={t["field.sourceUrl"]} hint={t["console.optional"]}>
                <TextInput
                  name="sourceUrl"
                  inputMode="url"
                  defaultValue={profile?.sourceUrl ?? ""}
                />
              </Field>
              <Field
                label={t["field.sourceCheckedOn"]}
                hint={t["console.optional"]}
              >
                <TextInput
                  name="sourceCheckedOn"
                  type="date"
                  defaultValue={profile?.sourceCheckedOn ?? ""}
                />
              </Field>
              <Label className="min-h-9">
                <Checkbox
                  name="published"
                  defaultChecked={profile?.published ?? false}
                />
                {t["field.published"]}
              </Label>
              <div>
                <PendingButton>{t["console.save"]}</PendingButton>
              </div>
            </form>
          </Card>

          <Card title={t["section.publicProfile"]}>
            <div className="grid gap-3">
              {LOCALES.map((code) => {
                const row = narratives.get(code);
                return (
                  <form
                    key={code}
                    action={upsertOrganizationPurpose}
                    className="grid gap-2"
                    dir={code === "ar" ? "rtl" : "ltr"}
                  >
                    {localeHidden}
                    {hidden}
                    <input type="hidden" name="languageCode" value={code} />
                    <Field
                      label={`${t["field.purpose"]} — ${code.toUpperCase()}`}
                    >
                      <TextArea
                        name="purpose"
                        rows={2}
                        required
                        defaultValue={row?.purpose ?? ""}
                      />
                    </Field>
                    <Field
                      label={t["field.goals"]}
                      hint={t["console.optional"]}
                    >
                      <TextArea
                        name="goals"
                        rows={3}
                        defaultValue={row?.goals ?? ""}
                      />
                    </Field>
                    <Field
                      label={t["field.values"]}
                      hint={t["console.optional"]}
                    >
                      <TextArea
                        name="values"
                        rows={3}
                        defaultValue={row?.values ?? ""}
                      />
                    </Field>
                    <div>
                      <PendingButton variant="secondary">
                        {t["console.save"]} {code}
                      </PendingButton>
                    </div>
                  </form>
                );
              })}
            </div>
          </Card>
        </div>

        <Card title={t["section.specialities"]}>
          <p className="text-copy-muted -mt-1 mb-3 text-xs">{t["spec.hint"]}</p>
          {assignments.length === 0 ? (
            <EmptyState>{t["empty.section"]}</EmptyState>
          ) : (
            <ul className="mb-3 flex flex-wrap gap-2">
              {assignments.map((assignment) => (
                <li
                  key={assignment.id}
                  className="border-line bg-surface flex items-center gap-2 rounded-full border py-1 pe-1 ps-3"
                >
                  {assignment.isPrimary ? (
                    <Icon name="star" size={14} className="text-brand" />
                  ) : null}
                  <span className="text-sm font-medium">
                    {assignment.label ?? assignment.code}
                  </span>
                  <form action={retireOrganizationSpeciality}>
                    {localeHidden}
                    {hidden}
                    <input
                      type="hidden"
                      name="assignmentId"
                      value={assignment.id}
                    />
                    <PendingButton variant="ghost" className="!px-2 !py-0.5">
                      ✕
                    </PendingButton>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-end gap-3">
            {addable.length > 0 ? (
              <form
                action={addOrganizationSpeciality}
                className="flex items-end gap-2"
              >
                {localeHidden}
                {hidden}
                <Field label={t["console.add"]}>
                  <Select name="specialityId">
                    {addable.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label ?? s.code}
                      </option>
                    ))}
                  </Select>
                </Field>
                <PendingButton variant="secondary">
                  {t["console.add"]}
                </PendingButton>
              </form>
            ) : null}
            {assignments.length > 0 ? (
              <form
                action={setPrimarySpeciality}
                className="flex items-end gap-2"
              >
                {localeHidden}
                {hidden}
                <Field label={t["spec.primary"]}>
                  <Select
                    name="assignmentId"
                    defaultValue={
                      assignments.find((a) => a.isPrimary)?.id ?? ""
                    }
                  >
                    <option value="">{t["spec.clearPrimary"]}</option>
                    {assignments.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label ?? a.code}
                      </option>
                    ))}
                  </Select>
                </Field>
                <PendingButton variant="secondary">
                  {t["spec.setPrimary"]}
                </PendingButton>
              </form>
            ) : null}
          </div>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card title={t["section.languages"]}>
            <p className="text-copy-muted -mt-1 mb-3 text-xs">
              {t["lang.hint"]}
            </p>
            <ul className="flex flex-wrap gap-2">
              {allLanguages.map((language) => {
                const on = orgLangs.has(language.code);
                return (
                  <li key={language.code}>
                    <form action={toggleOrganizationLanguage}>
                      {localeHidden}
                      {hidden}
                      <input
                        type="hidden"
                        name="languageCode"
                        value={language.code}
                      />
                      <input
                        type="hidden"
                        name="enabled"
                        value={on ? "false" : "true"}
                      />
                      <PendingButton
                        variant={on ? "primary" : "secondary"}
                        className="!rounded-full"
                      >
                        {on ? "✓ " : ""}
                        {language.nativeName}
                      </PendingButton>
                    </form>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card title={t["section.contacts"]}>
            <p className="text-copy-muted -mt-1 mb-3 text-xs">
              {t["contact.hint"]}
            </p>
            {contactRows.length === 0 ? (
              <EmptyState>{t["empty.section"]}</EmptyState>
            ) : (
              <ul className="divide-line mb-3 divide-y">
                {contactRows.map((contact) => (
                  <li
                    key={contact.id}
                    className="flex items-center justify-between gap-3 py-2"
                  >
                    <span className="min-w-0 text-sm">
                      <Chip tone="accent">
                        {t[`contact.kind.${contact.kind}`]}
                      </Chip>{" "}
                      <span className="font-medium">
                        {contact.label ?? contact.value ?? "—"}
                      </span>
                      {contact.value && contact.label ? (
                        <span className="text-copy-muted ms-2 text-xs">
                          {contact.value}
                        </span>
                      ) : null}
                      {!contact.active ? (
                        <Chip tone="neutral">{t["contact.inactive"]}</Chip>
                      ) : null}
                    </span>
                    <form action={toggleOrganizationContact}>
                      {localeHidden}
                      {hidden}
                      <input
                        type="hidden"
                        name="contactId"
                        value={contact.id}
                      />
                      <input
                        type="hidden"
                        name="active"
                        value={contact.active ? "false" : "true"}
                      />
                      <PendingButton variant="ghost">
                        {contact.active
                          ? t["console.archive"]
                          : t["console.restore"]}
                      </PendingButton>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            <form
              action={addOrganizationContact}
              className="flex flex-wrap items-end gap-2"
            >
              {localeHidden}
              {hidden}
              <Field label={t["contact.kind"]}>
                <Select name="kind">
                  {CONTACT_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {t[`contact.kind.${kind}`]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t["contact.value"]}>
                <TextInput name="value" />
              </Field>
              <Field label={t["contact.label"]}>
                <TextInput name="labelFr" />
              </Field>
              <PendingButton variant="secondary">
                {t["console.add"]}
              </PendingButton>
            </form>
          </Card>
        </div>

        <Card
          title={`${t["section.activities"]} (${String(orgActivities.length)})`}
        >
          {orgActivities.length === 0 ? (
            <EmptyState>{t["empty.section"]}</EmptyState>
          ) : (
            <ul className="divide-line divide-y">
              {orgActivities.map((activity) => (
                <li
                  key={activity.id}
                  className="flex items-center justify-between py-2"
                >
                  <Link
                    href={localizedPath(
                      `/dashboard/activities?activity=${activity.id}`,
                      locale,
                    )}
                    className="text-sm font-medium hover:underline"
                  >
                    {activity.name ?? "(no name)"}
                  </Link>
                  <Chip tone={activity.published ? "ok" : "neutral"}>
                    {activity.published
                      ? t["act.published"]
                      : t["status.draft"]}
                  </Chip>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
