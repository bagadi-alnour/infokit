import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";

import { loadPageCatalog } from "@infokit/shared/i18n/catalogs";
import {
  Card,
  Chip,
  ControlField,
  DangerZone,
  EmptyState,
  Field,
  Notice,
  PageHeader,
  ReadOnlyField,
  Select,
  TextInput,
  WorkspacePage,
} from "~/components/admin/workspace";
import {
  OrganizationNarrativeEditor,
  type OrganizationNarrativeLanguage,
} from "~/components/admin/organization-narrative-editor";
import { OrganizationArchiveAction } from "~/components/admin/organization-archive-action";
import { StewardContactForm } from "~/components/admin/steward-contact-form";
import { StewardContactSummary } from "~/components/admin/steward-contact";
import { Icon } from "~/components/icons";
import { PendingButton } from "~/components/pending-button";
import { Checkbox } from "~/components/ui/checkbox";
import { DatePicker } from "~/components/ui/date-picker";
import { Label } from "~/components/ui/label";
import { requireRouteLocale } from "~/i18n/route-locale";
import { localizedPath } from "~/i18n/routing";
import { editorialLanguageCodes } from "~/lib/editorial-languages";
import {
  hasStewardContact,
  type StewardContactValues,
} from "~/lib/steward-contact";
import { buildWorkspaceLabels } from "~/lib/workspace-labels";
import { getRoleTestState } from "~/server/auth/authorization";
import { organizationWriteAccess } from "~/server/auth/org-access";
import { hasPermission, requireEditor } from "~/server/auth/require";
import { db } from "~/server/db";
import {
  activities,
  activityTranslations,
  contacts,
  contactTranslations,
  invitationRoles,
  invitations,
  languages,
  memberRoles,
  organizationLanguages,
  organizationMembers,
  organizationProfiles,
  organizationProfileTranslations,
  organizations,
  organizationSpecialities,
  roles,
  specialities,
  specialityTranslations,
  translationAssignments,
  translationSourceVersions,
} from "~/server/db/schema";
import { INVITABLE_ROLE_CODES } from "~/server/invitations";
import {
  addOrganizationContact,
  addOrganizationSpeciality,
  inviteOrganizationRepresentative,
  releaseOrganizationClaim,
  resendOrganizationInvitation,
  revokeOrganizationInvitation,
  retireOrganizationSpeciality,
  setOrganizationArchived,
  setOrganizationNarrativeLanguage,
  setPrimarySpeciality,
  toggleOrganizationContact,
  toggleOrganizationLanguage,
  updateOrganization,
} from "../actions";
import { updateOrganizationSteward } from "../../steward-actions";

const statusTone = {
  draft: "neutral",
  verified: "ok",
  suspended: "warn",
  archived: "neutral",
} as const;

const CONTACT_KINDS = ["phone", "whatsapp", "email", "on_site", "url"] as const;

/**
 * One organisation record, rendered for whoever is looking at it.
 *
 * The claim rule (docs/PRODUCT.md; server/auth/org-access.ts) decides that:
 * before an organisation claims itself the platform maintains it, and after the
 * claim the platform sees exactly the same page as plain values it cannot
 * change. Read-only is rendered as text, not as a dimmed form — a disabled
 * input invites a click that will never work.
 */
export default async function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale: rawLocale, id } = await params;
  const locale = requireRouteLocale(rawLocale);
  const t = await loadPageCatalog(locale, "dashboard-console");
  /**
   * The language accordion speaks the create catalogue's vocabulary — the same
   * words the article and activity editors use for the same states and errands,
   * with this page's own field names filling the rest.
   */
  const narrativeLabels = buildWorkspaceLabels(
    await loadPageCatalog(locale, "dashboard-overview"),
    t,
  );
  const user = await requireEditor(locale);

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, id));
  if (!org) notFound();

  const [access, authorization] = await Promise.all([
    organizationWriteAccess(user.id, id),
    getRoleTestState(user.id, id),
  ]);
  const canWrite = access.canWrite;
  const canLifecycle =
    canWrite && authorization.effectivePermissions.has("organization.verify");
  /**
   * Asking a translator, and accepting what they send, are asked for this
   * organisation — the same two questions the article and activity screens ask.
   */
  const [canRequestTranslations, canReviewTranslations] = await Promise.all([
    hasPermission("content.translation.request", id),
    hasPermission("content.translation.review", id),
  ]);

  const [profile] = await db
    .select()
    .from(organizationProfiles)
    .where(eq(organizationProfiles.organizationId, id));
  // The steward contact lives on the profile row, which a directory record the
  // platform entered may not have yet.
  const steward: StewardContactValues = {
    stewardName: profile?.stewardName ?? null,
    stewardPhone: profile?.stewardPhone ?? null,
    stewardEmail: profile?.stewardEmail ?? null,
  };
  const narratives = new Map(
    (
      await db
        .select()
        .from(organizationProfileTranslations)
        .where(eq(organizationProfileTranslations.organizationId, id))
    ).map((row) => [row.languageCode, row]),
  );

  /**
   * Translator collaboration for the narrative: which language it is written
   * in, whether that text has been sealed as a source version, and what is
   * outstanding per target language.
   */
  const narrativeSourceLanguage =
    editorialLanguageCodes.find(
      (code) => code === profile?.narrativeSourceLanguage,
    ) ?? "fr";
  const [narrativeSource] = await db
    .select({ id: translationSourceVersions.id })
    .from(translationSourceVersions)
    .where(
      and(
        eq(translationSourceVersions.entityKind, "organization_profile"),
        eq(translationSourceVersions.entityId, id),
      ),
    )
    .orderBy(desc(translationSourceVersions.version))
    .limit(1);
  const narrativeAssignments = await db
    .select({
      id: translationAssignments.id,
      languageCode: translationAssignments.targetLanguageCode,
      state: translationAssignments.state,
      translatorEmail: translationAssignments.translatorEmail,
      translatorName: translationAssignments.translatorName,
      expiresAt: translationAssignments.expiresAt,
    })
    .from(translationAssignments)
    .where(
      and(
        eq(translationAssignments.entityKind, "organization_profile"),
        eq(translationAssignments.entityId, id),
        isNull(translationAssignments.revokedAt),
        isNull(translationAssignments.expiredAt),
      ),
    )
    .orderBy(desc(translationAssignments.createdAt));
  const latestAssignmentByLanguage = new Map<
    string,
    (typeof narrativeAssignments)[number]
  >();
  for (const assignment of narrativeAssignments) {
    if (!latestAssignmentByLanguage.has(assignment.languageCode)) {
      latestAssignmentByLanguage.set(assignment.languageCode, assignment);
    }
  }
  const narrativeLanguages: OrganizationNarrativeLanguage[] =
    editorialLanguageCodes.map((code) => {
      const assignment = latestAssignmentByLanguage.get(code);
      const row = narratives.get(code);
      return {
        code,
        purpose: row?.purpose ?? "",
        goals: row?.goals ?? "",
        values: row?.values ?? "",
        state: row?.state ?? null,
        // Translated from a version of the narrative that has since moved on.
        stale: Boolean(
          code !== narrativeSourceLanguage &&
          row?.sourceVersionId &&
          narrativeSource &&
          row.sourceVersionId !== narrativeSource.id,
        ),
        assignment: assignment
          ? {
              id: assignment.id,
              // An untouched link that has run out is expired, whatever the
              // lifecycle column still says.
              state:
                assignment.expiresAt <= new Date() &&
                !["accepted", "rejected", "published"].includes(
                  assignment.state,
                )
                  ? "expired"
                  : assignment.state,
              translatorEmail: assignment.translatorEmail,
              translatorName: assignment.translatorName,
              expiresAt: new Intl.DateTimeFormat(locale, {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(assignment.expiresAt),
            }
          : null,
      };
    });

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

  /**
   * Who belongs to this organisation, and what each of them may do — a role,
   * not a job title, is the answer to the second question (docs/PRODUCT.md §15).
   *
   * The roster is administrative data: the organisation's own administrators
   * read it, and so does the platform while it still maintains an unclaimed
   * record. Contact emails are held one notch tighter — only `members.read`
   * opens them, so an operator sees the shape of the team without its inbox.
   */
  const canReadMembers =
    authorization.isSuperadmin ||
    authorization.effectivePermissions.has("members.read") ||
    access.actor === "platform_admin";
  const canReadMemberEmails =
    authorization.isSuperadmin ||
    authorization.effectivePermissions.has("members.read");

  const memberRows = canReadMembers
    ? await db
        .select({
          id: organizationMembers.id,
          displayName: organizationMembers.displayName,
          contactEmail: organizationMembers.contactEmail,
          title: organizationMembers.title,
          status: organizationMembers.status,
          userId: organizationMembers.userId,
        })
        .from(organizationMembers)
        .where(eq(organizationMembers.organizationId, id))
        .orderBy(asc(organizationMembers.displayName))
    : [];
  const memberRoleRows =
    memberRows.length > 0
      ? await db
          .select({
            memberId: memberRoles.memberId,
            code: roles.code,
            description: roles.description,
            expiresAt: memberRoles.expiresAt,
          })
          .from(memberRoles)
          .innerJoin(roles, eq(roles.id, memberRoles.roleId))
          .where(
            inArray(
              memberRoles.memberId,
              memberRows.map((member) => member.id),
            ),
          )
          .orderBy(asc(roles.code))
      : [];
  const rolesByMember = new Map<string, typeof memberRoleRows>();
  for (const row of memberRoleRows) {
    rolesByMember.set(row.memberId, [
      ...(rolesByMember.get(row.memberId) ?? []),
      row,
    ]);
  }
  const memberStatusTone = {
    active: "ok",
    invited: "accent",
    inactive: "neutral",
    offboarded: "neutral",
  } as const;
  const memberStatusLabel = {
    active: t["memberStatus.active"],
    invited: t["memberStatus.invited"],
    inactive: t["memberStatus.inactive"],
    offboarded: t["memberStatus.offboarded"],
  } as const;

  /**
   * Invitations the platform has sent for this record but nobody has accepted
   * yet (docs/PHASE-1.3-COLLABORATION.md Flow 1). The roster shows a reserved
   * membership; only the invitation shows when the link dies, so both the
   * operator who may resend it and anyone allowed to read member addresses see
   * it here.
   */
  const canInvite = canLifecycle;
  const canSeeInvitations = canInvite || canReadMemberEmails;
  const invitationRows = canSeeInvitations
    ? await db
        .select({
          id: invitations.id,
          email: invitations.email,
          expiresAt: invitations.expiresAt,
        })
        .from(invitations)
        .where(
          and(
            eq(invitations.organizationId, id),
            isNull(invitations.acceptedAt),
            isNull(invitations.revokedAt),
          ),
        )
        .orderBy(desc(invitations.createdAt))
    : [];
  const invitationRoleRows =
    invitationRows.length > 0
      ? await db
          .select({
            invitationId: invitationRoles.invitationId,
            code: roles.code,
          })
          .from(invitationRoles)
          .innerJoin(roles, eq(roles.id, invitationRoles.roleId))
          .where(
            inArray(
              invitationRoles.invitationId,
              invitationRows.map((invitation) => invitation.id),
            ),
          )
          .orderBy(asc(roles.code))
      : [];
  const rolesByInvitation = new Map<string, string[]>();
  for (const row of invitationRoleRows) {
    rolesByInvitation.set(row.invitationId, [
      ...(rolesByInvitation.get(row.invitationId) ?? []),
      row.code,
    ]);
  }
  const now = Date.now();

  const archived = org.status === "archived";
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "long" });
  const hidden = <input type="hidden" name="organizationId" value={org.id} />;
  const localeHidden = <input type="hidden" name="locale" value={locale} />;

  return (
    <WorkspacePage>
      <PageHeader
        back={{
          href: localizedPath("/dashboard/organizations", locale),
          label: t["org.listTitle"],
        }}
        title={org.displayName}
        sub={org.slug}
        badges={
          <>
            <Chip tone={statusTone[org.status]}>
              {t[`status.${org.status}`]}
            </Chip>
            <Chip tone={access.claimed ? "accent" : "neutral"}>
              <span className="inline-flex items-center gap-1">
                <Icon
                  name={access.claimed ? "claimed" : "unclaimed"}
                  size={13}
                />
                {access.claimed
                  ? t["org.maintainedByOrg"]
                  : t["org.maintainedByPlatform"]}
              </span>
            </Chip>
            {canWrite ? null : (
              <Chip tone="warn">
                <span className="inline-flex items-center gap-1">
                  <Icon name="readOnly" size={13} />
                  {t["console.readOnly"]}
                </span>
              </Chip>
            )}
          </>
        }
      />

      {!canWrite && access.actor === "platform_admin" ? (
        <Notice tone="info" title={t["console.claimedTitle"]}>
          {t["console.claimedBody"]}
          {org.claimedAt ? (
            <span className="mt-1 block">
              {t["org.claimedOn"]} {dateFormat.format(org.claimedAt)}
            </span>
          ) : null}
        </Notice>
      ) : null}
      {!canWrite && access.actor === "none" ? (
        <Notice tone="warn" title={t["console.readOnlyTitle"]}>
          {t["console.readOnlyBody"]}
        </Notice>
      ) : null}
      {canWrite && access.actor === "organization_member" ? (
        <Notice tone="ok" title={t["org.ownEditTitle"]}>
          {t["org.ownEditBody"]}
        </Notice>
      ) : null}

      {/* At desktop width the public profile is an actual rail, not a section
       * that may silently fall below the record when a container threshold is
       * missed. Narrow screens keep the same reading order in normal flow. */}
      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="grid min-w-0 gap-5 xl:col-start-1 xl:row-start-1">
          <Card title={t["section.profile"]}>
            {canWrite ? (
              <form
                action={updateOrganization}
                className="grid gap-x-4 gap-y-3 md:grid-cols-12"
              >
                {localeHidden}
                {hidden}
                <div className="md:col-span-7">
                  <Field label={t["field.displayName"]}>
                    <TextInput
                      name="displayName"
                      required
                      minLength={2}
                      defaultValue={org.displayName}
                    />
                  </Field>
                </div>
                <div className="md:col-span-5">
                  <Field
                    label={t["field.legalName"]}
                    hint={t["console.optional"]}
                  >
                    <TextInput
                      name="legalName"
                      defaultValue={org.legalName ?? ""}
                    />
                  </Field>
                </div>
                <div className="md:col-span-2">
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
                </div>
                <div className="md:col-span-3">
                  {canLifecycle ? (
                    <Field label={t["field.status"]}>
                      <Select
                        name="status"
                        defaultValue={archived ? "draft" : org.status}
                      >
                        <option value="draft">{t["status.draft"]}</option>
                        <option value="verified">{t["status.verified"]}</option>
                        <option value="suspended">
                          {t["status.suspended"]}
                        </option>
                      </Select>
                    </Field>
                  ) : (
                    <>
                      {/* Members maintain their profile; the platform owns verification. */}
                      <input type="hidden" name="status" value={org.status} />
                      <ReadOnlyField
                        label={t["field.status"]}
                        value={t[`status.${org.status}`]}
                      />
                    </>
                  )}
                </div>
                <div className="md:col-span-7">
                  <Field
                    label={t["field.website"]}
                    hint={t["console.optional"]}
                  >
                    <TextInput
                      name="website"
                      inputMode="url"
                      defaultValue={profile?.website ?? ""}
                    />
                  </Field>
                </div>
                <div className="md:col-span-8">
                  <Field
                    label={t["field.sourceUrl"]}
                    hint={t["console.optional"]}
                  >
                    <TextInput
                      name="sourceUrl"
                      inputMode="url"
                      defaultValue={profile?.sourceUrl ?? ""}
                    />
                  </Field>
                </div>
                <div className="md:col-span-4">
                  <ControlField
                    label={t["field.sourceCheckedOn"]}
                    htmlFor="organization-source-checked-on"
                    hint={t["console.optional"]}
                  >
                    <DatePicker
                      id="organization-source-checked-on"
                      name="sourceCheckedOn"
                      locale={locale}
                      defaultValue={profile?.sourceCheckedOn ?? ""}
                      placeholder={t["console.selectDate"]}
                      clearLabel={t["console.clearDate"]}
                    />
                  </ControlField>
                </div>
                {/* The switch that decides whether any of this is public sits on
                 * the same line as the save it needs to take effect. */}
                <div className="border-line flex flex-wrap items-center justify-between gap-3 border-t pt-3 md:col-span-12">
                  <Label className="min-h-9">
                    <Checkbox
                      name="published"
                      defaultChecked={profile?.published ?? false}
                    />
                    {t["field.published"]}
                  </Label>
                  <PendingButton>{t["console.save"]}</PendingButton>
                </div>
              </form>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <ReadOnlyField
                  label={t["field.displayName"]}
                  value={org.displayName}
                />
                <ReadOnlyField
                  label={t["field.legalName"]}
                  value={org.legalName}
                />
                <ReadOnlyField
                  label={t["field.foundedYear"]}
                  value={org.foundedYear}
                />
                <ReadOnlyField
                  label={t["field.status"]}
                  value={t[`status.${org.status}`]}
                />
                <ReadOnlyField
                  label={t["field.website"]}
                  value={profile?.website}
                />
                <ReadOnlyField
                  label={t["field.sourceUrl"]}
                  value={profile?.sourceUrl}
                />
                <ReadOnlyField
                  label={t["field.sourceCheckedOn"]}
                  value={profile?.sourceCheckedOn}
                />
                <ReadOnlyField
                  label={t["field.published"]}
                  value={
                    profile?.published
                      ? t["act.published"]
                      : t["act.unpublished"]
                  }
                />
              </div>
            )}
          </Card>

          {/* These are the two compact public classification sets. Keeping them
           * together uses the wide work column without separating related facts
           * across the page; they stack naturally on smaller screens. */}
          <div className="grid items-start gap-5 lg:grid-cols-2">
            <Card title={t["section.specialities"]} hint={t["spec.hint"]}>
              {assignments.length === 0 ? (
                <EmptyState>{t["empty.section"]}</EmptyState>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {assignments.map((assignment) => (
                    <li
                      key={assignment.id}
                      className={`border-line bg-surface flex items-center gap-1.5 rounded-full border py-1 ${canWrite ? "pe-1 ps-1" : "pe-3 ps-3"}`}
                    >
                      {/* Which speciality leads is a property of that speciality,
                       * so it is decided on it: the star marks it, the star of the
                       * current one clears it back to co-equal. The dropdown this
                       * replaces listed the same rows a second time and asked the
                       * reader to match names between two controls. */}
                      {canWrite ? (
                        <form action={setPrimarySpeciality}>
                          {localeHidden}
                          {hidden}
                          <input
                            type="hidden"
                            name="assignmentId"
                            value={assignment.isPrimary ? "" : assignment.id}
                          />
                          <PendingButton
                            variant="ghost"
                            className="!rounded-full !px-1.5 !py-0.5"
                            aria-label={
                              assignment.isPrimary
                                ? t["spec.clearPrimary"]
                                : t["spec.setPrimary"]
                            }
                            title={
                              assignment.isPrimary
                                ? t["spec.clearPrimary"]
                                : t["spec.setPrimary"]
                            }
                          >
                            {/* Filled, not merely coloured: the marked star reads
                             * as marked in a screenshot, in high contrast, and
                             * to anyone who does not see the brand colour. */}
                            <Icon
                              name="star"
                              size={14}
                              className={
                                assignment.isPrimary
                                  ? "text-brand fill-current"
                                  : "text-copy-muted"
                              }
                            />
                          </PendingButton>
                        </form>
                      ) : assignment.isPrimary ? (
                        <Icon name="star" size={14} className="text-brand" />
                      ) : null}
                      <span className="text-sm font-medium">
                        {assignment.label ?? assignment.code}
                      </span>
                      {/* The star is never the only carrier: the leading
                       * speciality also says so in words. */}
                      {assignment.isPrimary ? (
                        <span className="text-brand text-[11px] font-semibold uppercase tracking-wide">
                          {t["spec.primary"]}
                        </span>
                      ) : null}
                      {canWrite ? (
                        <form action={retireOrganizationSpeciality}>
                          {localeHidden}
                          {hidden}
                          <input
                            type="hidden"
                            name="assignmentId"
                            value={assignment.id}
                          />
                          <PendingButton
                            variant="ghost"
                            className="!rounded-full !px-2 !py-0.5"
                            aria-label={t["console.remove"]}
                            title={t["console.remove"]}
                          >
                            ✕
                          </PendingButton>
                        </form>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
              {canWrite && addable.length > 0 ? (
                <form
                  action={addOrganizationSpeciality}
                  className="border-line mt-4 grid items-end gap-3 border-t pt-4 sm:grid-cols-[minmax(0,1fr)_auto]"
                >
                  {localeHidden}
                  {hidden}
                  <div className="min-w-56 flex-1">
                    <Field label={t["subj.speciality"]}>
                      <Select name="specialityId">
                        {addable.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.label ?? s.code}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>
                  <PendingButton variant="secondary" className="min-w-20">
                    {t["console.add"]}
                  </PendingButton>
                </form>
              ) : null}
            </Card>

            <Card title={t["section.languages"]} hint={t["lang.hint"]}>
              {canWrite ? (
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
              ) : orgLangs.size === 0 ? (
                <EmptyState>{t["empty.section"]}</EmptyState>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {allLanguages
                    .filter((language) => orgLangs.has(language.code))
                    .map((language) => (
                      <li key={language.code}>
                        <Chip tone="accent">{language.nativeName}</Chip>
                      </li>
                    ))}
                </ul>
              )}
            </Card>
          </div>

          <Card title={t["section.contacts"]} hint={t["contact.hint"]}>
            {contactRows.length === 0 ? (
              <EmptyState>{t["empty.section"]}</EmptyState>
            ) : (
              <ul className="divide-line divide-y">
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
                    {canWrite ? (
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
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {/* Adding a contact is its own step below the list, on the grid the
             * profile form uses: three labelled fields and the button that files
             * them, never a row of controls squeezed against each other. */}
            {canWrite ? (
              <form
                action={addOrganizationContact}
                className="border-line mt-4 grid items-end gap-3 border-t pt-4 md:grid-cols-[minmax(9rem,.7fr)_minmax(0,1.2fr)_minmax(0,1fr)_auto]"
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
                <div>
                  <PendingButton variant="secondary" className="min-w-20">
                    {t["console.add"]}
                  </PendingButton>
                </div>
              </form>
            ) : null}
          </Card>

          {/* Public offerings follow the public contact data they rely on, before
           * the private membership and invitation administration below. */}
          <Card
            title={`${t["section.activities"]} (${String(orgActivities.length)})`}
            action={
              <Link
                href={localizedPath(
                  `/dashboard/activities?q=${encodeURIComponent(org.displayName)}`,
                  locale,
                )}
                className="text-copy-muted hover:text-ink inline-flex items-center gap-1.5 text-xs font-medium"
              >
                <Icon name="external" size={14} />
                {t["console.open"]}
              </Link>
            }
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
                      {activity.name ?? t["activities.untitled"]}
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

          <section id="organization-members" className="scroll-mt-6">
            <Card
              title={`${t["section.members"]} (${String(memberRows.length)})`}
              hint={t["members.hint"]}
              action={
                canWrite &&
                authorization.effectivePermissions.has("members.manage") ? (
                  <Link
                    href={localizedPath(
                      `/dashboard/team?org=${org.id}`,
                      locale,
                    )}
                    className="text-copy-muted hover:text-ink inline-flex items-center gap-1.5 text-xs font-medium"
                  >
                    <Icon name="external" size={14} />
                    {t["members.manage"]}
                  </Link>
                ) : null
              }
            >
              {!canReadMembers ? (
                <EmptyState>{t["members.hidden"]}</EmptyState>
              ) : memberRows.length === 0 ? (
                <EmptyState>{t["members.empty"]}</EmptyState>
              ) : (
                <ul className="divide-line divide-y">
                  {memberRows.map((member) => {
                    const granted = rolesByMember.get(member.id) ?? [];
                    return (
                      <li
                        key={member.id}
                        className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:items-start sm:gap-4"
                      >
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                            {member.displayName}
                            <Chip tone={memberStatusTone[member.status]}>
                              {memberStatusLabel[member.status]}
                            </Chip>
                            {member.userId === null ? (
                              <span className="text-copy-muted text-xs">
                                {t["members.noAccount"]}
                              </span>
                            ) : null}
                          </p>
                          {member.title ? (
                            <p className="text-copy-muted text-xs">
                              {member.title}
                            </p>
                          ) : null}
                          {canReadMemberEmails && member.contactEmail ? (
                            <p className="text-copy-muted text-xs">
                              {member.contactEmail}
                            </p>
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <p className="text-copy-muted mb-1 text-[11px] font-semibold uppercase tracking-wide">
                            {t["members.roles"]}
                          </p>
                          {granted.length === 0 ? (
                            <p className="text-copy-muted text-xs">
                              {t["members.noRole"]}
                            </p>
                          ) : (
                            <ul className="flex flex-wrap gap-1.5">
                              {granted.map((role) => (
                                <li key={role.code}>
                                  {/* The console names roles by their code, as
                                   * the role switcher does — the code is what
                                   * the permission matrix is written in. */}
                                  <Chip
                                    tone="accent"
                                    title={role.description ?? undefined}
                                  >
                                    {role.code}
                                    {role.expiresAt
                                      ? ` · ${t["members.until"]} ${dateFormat.format(role.expiresAt)}`
                                      : ""}
                                  </Chip>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </section>

          {/* A pending invitation is not a member: it is a link with an expiry
           * date, resent or revoked on its own. Its own card says so, and gives
           * the send form room to be read as a form. */}
          {canSeeInvitations ? (
            <Card
              title={`${t["invite.pendingTitle"]} (${String(invitationRows.length)})`}
              hint={canInvite ? t["invite.hint"] : undefined}
            >
              {invitationRows.length === 0 ? (
                <EmptyState>{t["invite.none"]}</EmptyState>
              ) : (
                <ul className="divide-line divide-y">
                  {invitationRows.map((invitation) => {
                    const expired = invitation.expiresAt.getTime() <= now;
                    return (
                      <li
                        key={invitation.id}
                        className="flex flex-wrap items-center justify-between gap-2 py-2"
                      >
                        <span className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
                          <span className="font-medium">
                            {invitation.email}
                          </span>
                          <Chip tone={expired ? "warn" : "accent"}>
                            {expired
                              ? t["invite.expired"]
                              : `${t["invite.expires"]} ${dateFormat.format(invitation.expiresAt)}`}
                          </Chip>
                          {(rolesByInvitation.get(invitation.id) ?? []).map(
                            (code) => (
                              <Chip key={code} tone="neutral">
                                {code}
                              </Chip>
                            ),
                          )}
                        </span>
                        {canInvite ? (
                          <span className="flex items-center gap-1">
                            <form action={resendOrganizationInvitation}>
                              {localeHidden}
                              {hidden}
                              <input
                                type="hidden"
                                name="invitationId"
                                value={invitation.id}
                              />
                              <PendingButton variant="ghost">
                                {t["invite.resend"]}
                              </PendingButton>
                            </form>
                            <form action={revokeOrganizationInvitation}>
                              {localeHidden}
                              {hidden}
                              <input
                                type="hidden"
                                name="invitationId"
                                value={invitation.id}
                              />
                              <PendingButton variant="ghost">
                                {t["invite.revoke"]}
                              </PendingButton>
                            </form>
                          </span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
              {canInvite ? (
                <form
                  action={inviteOrganizationRepresentative}
                  className="border-line mt-4 grid items-end gap-3 border-t pt-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,.8fr)_minmax(10rem,.7fr)_auto]"
                >
                  {localeHidden}
                  {hidden}
                  <Field label={t["invite.email"]}>
                    <TextInput name="email" type="email" required />
                  </Field>
                  <Field
                    label={t["invite.displayName"]}
                    hint={t["console.optional"]}
                  >
                    <TextInput name="displayName" />
                  </Field>
                  <Field label={t["invite.role"]}>
                    {/* Roles are named by code here, as everywhere else in the
                     * console: the code is what the permission matrix is written
                     * in. */}
                    <Select name="roleCode" defaultValue="organization_admin">
                      {INVITABLE_ROLE_CODES.map((code) => (
                        <option key={code} value={code}>
                          {code}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <div>
                    <PendingButton variant="secondary" className="min-w-28">
                      {t["invite.send"]}
                    </PendingButton>
                  </div>
                </form>
              ) : null}
            </Card>
          ) : null}
        </div>

        {/* The public-facing text stays visible beside the record work, with
         * all configured languages and each language's own action menu. */}
        <aside className="grid min-w-0 gap-5 xl:col-start-2 xl:row-start-1">
          <Card
            title={t["section.publicProfile"]}
            hint={t["translation.orgHint"]}
          >
            {canWrite ? (
              <form
                action={setOrganizationNarrativeLanguage}
                className="border-line mb-4 grid items-end gap-3 border-b pb-4 sm:grid-cols-[minmax(0,1fr)_auto]"
              >
                {localeHidden}
                {hidden}
                <div className="min-w-40 flex-1">
                  <ControlField
                    label={t["field.sourceLanguage"]}
                    htmlFor="narrative-source-language"
                    hint={t["translation.sourceHint"]}
                  >
                    <Select
                      id="narrative-source-language"
                      name="sourceLanguage"
                      defaultValue={narrativeSourceLanguage}
                    >
                      {editorialLanguageCodes.map((code) => (
                        <option key={code} value={code}>
                          {narrativeLabels[`language.${code}`]}
                        </option>
                      ))}
                    </Select>
                  </ControlField>
                </div>
                <PendingButton variant="secondary" className="min-w-20">
                  {t["console.save"]}
                </PendingButton>
              </form>
            ) : (
              <div className="mb-4">
                <ReadOnlyField
                  label={t["field.sourceLanguage"]}
                  value={narrativeLabels[`language.${narrativeSourceLanguage}`]}
                />
              </div>
            )}
            <OrganizationNarrativeEditor
              locale={locale}
              organizationId={org.id}
              sourceLanguage={narrativeSourceLanguage}
              languages={narrativeLanguages}
              labels={narrativeLabels}
              hasSource={Boolean(narrativeSource)}
              canWrite={canWrite}
              canRequest={canRequestTranslations}
              canReview={canReviewTranslations}
            />
          </Card>

          {/* The contacts in the other column are published; this one never is.
           * It is the line back to whoever knows, for an editor elsewhere in the
           * network who finds something wrong on this record. */}
          <Card title={t["steward.title"]} hint={t["steward.hint"]}>
            {canWrite ? (
              <StewardContactForm
                action={updateOrganizationSteward}
                locale={locale}
                recordId={org.id}
                values={steward}
                labels={t}
                columns={false}
              />
            ) : hasStewardContact(steward) ? (
              <StewardContactSummary values={steward} labels={t} />
            ) : (
              <EmptyState>{t["steward.empty"]}</EmptyState>
            )}
          </Card>

          {/* Stable system metadata comes last: it supports administration,
           * but the profile and its steward are the active editing work. */}
          <Card title={t["section.record"]} hint={t["record.hint"]}>
            <div className="grid gap-3">
              <ReadOnlyField label={t["field.slug"]} value={org.slug} />
              <ReadOnlyField label={t["field.timezone"]} value={org.timezone} />
              <ReadOnlyField
                label={t["org.maintainedBy"]}
                value={
                  access.claimed
                    ? t["org.maintainedByOrg"]
                    : t["org.maintainedByPlatform"]
                }
              />
              <ReadOnlyField
                label={t["field.publishing"]}
                value={
                  org.publishingSuspended
                    ? t["field.publishingSuspended"]
                    : t["field.publishingActive"]
                }
              />
              <ReadOnlyField
                label={t["field.createdAt"]}
                value={dateFormat.format(org.createdAt)}
              />
              <ReadOnlyField
                label={t["field.updatedAt"]}
                value={dateFormat.format(org.updatedAt)}
              />
              <ReadOnlyField
                label={t["org.claimedOn"]}
                value={org.claimedAt ? dateFormat.format(org.claimedAt) : null}
              />
              <ReadOnlyField label={t["field.recordId"]} value={org.id} />
            </div>
          </Card>
        </aside>
      </div>

      {canLifecycle || (authorization.isSuperadmin && access.claimed) ? (
        <div className="mt-4">
          <DangerZone title={t["org.danger"]}>
            {canLifecycle ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-copy-muted max-w-xl text-sm">
                  {archived ? t["org.restoreHint"] : t["org.archiveHint"]}
                </p>
                <OrganizationArchiveAction
                  action={setOrganizationArchived}
                  locale={locale}
                  organizationId={org.id}
                  archived={archived}
                  labels={{
                    archive: t["console.archive"],
                    restore: t["console.restore"],
                    cancel: t.cancel,
                    confirmTitle: t["org.archiveConfirmTitle"],
                    confirmBody: t["org.archiveConfirmBody"],
                  }}
                />
              </div>
            ) : null}
            {authorization.isSuperadmin && access.claimed ? (
              <form
                action={releaseOrganizationClaim}
                className="border-line flex flex-wrap items-end gap-3 border-t pt-3"
              >
                {localeHidden}
                {hidden}
                <div className="min-w-0 flex-1">
                  <Field
                    label={t["org.releaseClaim"]}
                    hint={t["org.releaseClaimHint"]}
                  >
                    <TextInput name="reason" required minLength={4} />
                  </Field>
                </div>
                <PendingButton variant="danger">
                  <span className="inline-flex items-center gap-1.5">
                    <Icon name="unclaimed" size={15} />
                    {t["org.releaseClaim"]}
                  </span>
                </PendingButton>
              </form>
            ) : null}
          </DangerZone>
        </div>
      ) : null}
    </WorkspacePage>
  );
}
