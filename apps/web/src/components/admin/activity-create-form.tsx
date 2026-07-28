"use client";

import { type Locale } from "@infokit/shared/i18n";
import { ArrowLeft, CalendarClock, FileImage, Plus, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useFieldArray, type Control } from "react-hook-form";
import { z } from "zod";

import { createActivity } from "~/app/[locale]/dashboard/activities/actions";
import { createActivityImageUpload } from "~/app/[locale]/dashboard/activities/image-actions";
import {
  CoverImageField,
  coverImageLabels,
} from "~/components/admin/cover-image-field";
import {
  CheckboxFormField,
  DateFormField,
  FormSubmitButton,
  SearchableMultiSelectFormField,
  SearchableSelectFormField,
  SelectFormField,
  TextAreaFormField,
  TextFormField,
  TimeFormField,
} from "~/components/admin/form-field";
import { PublicationChoice } from "~/components/admin/publication-choice";
import { SidebarFocusMode } from "~/components/admin/sidebar-focus-mode";
import { TooltipHint } from "~/components/admin/tooltip-hint";
import { TranslationWorkspace } from "~/components/admin/translation-workspace";
import { PlaceAddressFields } from "~/components/address/place-address-fields";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import {
  useFormMessages,
  useServerFormAction,
  useWorkspaceForm,
} from "~/hooks/use-workspace-form";
import {
  activityLocationModes,
  activityScopes,
  placePrecisions,
  scheduleExceptionKinds,
} from "~/lib/activity-rules";
import { EDITOR_CONTACT_OPTION_ID } from "~/lib/editor-contact";
import { readLabel, type FormMessages, type Labels } from "~/lib/form-messages";
import { PLATFORM_OWNER_OPTION_ID } from "~/lib/platform-owner";
import {
  scheduleRowProblem,
  scheduleTimingModeSchema,
  scheduleTypeSchema,
  timeOfDayPattern,
  weekdayNumbers,
  weekdayValueSchema,
} from "~/lib/schedule-rules";

/**
 * The source language an editor authors in first. Restricted to French and
 * English for now, even though the translation editor still covers all
 * `editorialLanguageCodes` for the target content.
 */
const sourceLanguageOptions = ["fr", "en"] as const;

/** The schedule wording the rules borrow, which is the activity's own. */
type ScheduleErrors = { invalidRange: string; overlap: string };

/**
 * Everything an editor can get wrong before the activity is posted.
 *
 * The action re-checks every rule below when the post arrives, and several of
 * them are throws there rather than field errors. Running them here first is
 * what turns "that could not be saved" into a message on the field that caused
 * it, while the editor is still looking at it.
 *
 * The cover image is deliberately absent: its id comes out of an upload rather
 * than a keystroke, so `CoverImageField` owns it and posts it itself. The
 * address block is absent for the same reason — it holds its own suggestion, and
 * its coordinates stay a server-side check.
 */
function activityFormSchema(
  messages: FormMessages,
  scheduleErrors: ScheduleErrors,
  /** Why a withheld location still needs somebody to ask. */
  contactRequired: string,
) {
  const optional = z.string();
  const time = z.string().regex(timeOfDayPattern, messages.invalidTime);

  return z
    .object({
      sourceLanguage: z.enum(sourceLanguageOptions),
      /**
       * An organisation, or the platform itself — which is not one, and so
       * travels as its own value rather than as an id that could be mistaken
       * for an association's.
       */
      organizationId: z.union(
        [z.string().uuid(), z.literal(PLATFORM_OWNER_OPTION_ID)],
        { errorMap: () => ({ message: messages.required }) },
      ),
      /**
       * The several-choice fields hold their ids under the singular key the
       * action reads with `getAll`, because a field's path is its posted name.
       */
      creatorOrganizationId: z.array(z.string()),
      providerOrganizationId: z.array(z.string()),
      teamName: optional,
      scope: z.enum(activityScopes),
      cityId: optional,
      locationMode: z.enum(activityLocationModes),
      placeId: optional,
      placeName: optional,
      precision: z.enum(placePrecisions),
      categoryId: z.string().uuid(messages.required),
      audienceCategoryId: z.string().uuid(messages.required),
      // The chips input already stops at five and the server agrees, so the
      // form says so too rather than letting a sixth tag fail the save.
      tagId: z.array(z.string()).max(5, messages.invalid),
      serviceId: z.array(z.string()),
      contactId: z.array(z.string()),
      scheduleType: scheduleTypeSchema,
      occurrenceDate: optional,
      validFrom: optional,
      validTo: optional,
      scheduleRows: z
        .array(
          z.object({
            weekday: weekdayValueSchema,
            timingMode: scheduleTimingModeSchema,
            startTime: time,
            endTime: time,
          }),
        )
        .min(1)
        .max(7),
      hasException: z.boolean(),
      exceptionDate: optional,
      exceptionKind: z.enum(scheduleExceptionKinds),
      partialException: z.boolean(),
      exceptionStartTime: optional,
      exceptionEndTime: optional,
      exceptionReason: optional,
      sourceNote: optional,
    })
    .superRefine((values, context) => {
      const reject = (path: (string | number)[], message: string) => {
        context.addIssue({ code: z.ZodIssueCode.custom, path, message });
      };

      // A global activity is nowhere in particular: it posts no city and no
      // place, so none of the location rules apply to it.
      if (values.scope === "city") {
        if (!values.cityId) reject(["cityId"], messages.required);
        if (values.locationMode === "existing" && !values.placeId) {
          reject(["placeId"], messages.required);
        }
        if (values.locationMode === "new") {
          const name = values.placeName.trim();
          if (name.length === 0) reject(["placeName"], messages.required);
          else if (name.length < 2) reject(["placeName"], messages.tooShort);
          /**
           * A withheld address leaves the contact as the only way in, which the
           * action requires too. A platform-held activity has no contact to
           * offer, so for it the honest answer is a less precise location.
           */
          if (
            values.precision === "contact_to_learn" &&
            values.contactId.length === 0
          ) {
            reject(["contactId"], contactRequired);
          }
        }
      }

      if (values.scheduleType === "one_off" && !values.occurrenceDate) {
        reject(["occurrenceDate"], messages.required);
      }
      if (
        values.validFrom &&
        values.validTo &&
        values.validFrom > values.validTo
      ) {
        reject(["validTo"], messages.endBeforeStart);
      }

      /**
       * Only the rows the form posts are judged. A one-off date keeps a single
       * set of hours, so weekly rows an editor added before switching are
       * neither shown nor sent, and failing on one would name a field that is
       * not on the screen.
       */
      const rows =
        values.scheduleType === "one_off"
          ? values.scheduleRows.slice(0, 1)
          : values.scheduleRows;
      const problem = scheduleRowProblem(
        values.scheduleType,
        rows.map((row) => ({
          weekday: Number(row.weekday),
          startTime: row.startTime,
          endTime: row.endTime,
        })),
      );
      if (problem) {
        const overlap = problem.issue === "overlap";
        reject(
          ["scheduleRows", problem.index, overlap ? "startTime" : "endTime"],
          overlap ? scheduleErrors.overlap : scheduleErrors.invalidRange,
        );
      }

      if (!values.hasException) return;
      if (!values.exceptionDate) reject(["exceptionDate"], messages.required);
      if (!values.partialException) return;
      for (const field of ["exceptionStartTime", "exceptionEndTime"] as const) {
        const value = values[field];
        if (!value) reject([field], messages.required);
        else if (!timeOfDayPattern.test(value)) {
          reject([field], messages.invalidTime);
        }
      }
      if (
        values.exceptionStartTime &&
        values.exceptionEndTime &&
        values.exceptionStartTime >= values.exceptionEndTime
      ) {
        reject(["exceptionEndTime"], messages.endBeforeStart);
      }
    });
}

type ActivityFieldValues = z.infer<ReturnType<typeof activityFormSchema>>;

export interface ActivityFormOption {
  id: string;
  label: string;
  description?: string;
  organizationId?: string | null;
  cityId?: string;
  icon?: string;
}

/** One list of choices, as the searchable controls take it. */
function toOptions(items: readonly ActivityFormOption[]) {
  return items.map((item) => ({
    value: item.id,
    label: item.label,
    description: item.description,
    icon: item.icon,
  }));
}

/**
 * What one organisation may pick from: its own entries, plus the shared ones.
 *
 * The platform owns no catalogue entries, and its option id is not an
 * organisation id, so asking with it leaves exactly the shared entries.
 */
function ownedBy(organizationId: string) {
  return (option: ActivityFormOption) =>
    option.organizationId === null ||
    option.organizationId === undefined ||
    option.organizationId === organizationId;
}

/**
 * The contact preselected for a new activity.
 *
 * A reader who needs to ask something should reach the organisation running the
 * activity, so the first contact it has published is preselected. When it has
 * published none — which is most of them — the signed-in editor stands in.
 * Editors can drop it or add another; the point is that the common case needs no
 * decision, and that no activity is filed with nobody to ask.
 */
function defaultContactSelection(
  contacts: ActivityFormOption[],
  owner: string,
) {
  /**
   * A platform-held activity publishes no contact: the addresses in the list
   * belong to organisations, and the editor's own stands in for the
   * organisation running the activity, not for the platform.
   */
  if (owner === PLATFORM_OWNER_OPTION_ID) return [];
  const owned = contacts.find((contact) => contact.organizationId === owner);
  if (owned) return [owned.id];
  const editor = contacts.find(
    (contact) => contact.id === EDITOR_CONTACT_OPTION_ID,
  );
  return editor ? [editor.id] : [];
}

/**
 * Where each row of hours lives in the form, written out.
 *
 * A row's fields are addressed as `scheduleRows.2.startTime`, and the console
 * keeps numbers out of template literals on purpose — an unformatted count has no
 * business reaching an editor. A week allows seven rows and the schema says so,
 * so the seven paths are simply listed and the index picks one.
 */
const scheduleRowPaths = [
  "scheduleRows.0",
  "scheduleRows.1",
  "scheduleRows.2",
  "scheduleRows.3",
  "scheduleRows.4",
  "scheduleRows.5",
  "scheduleRows.6",
] as const;

type ScheduleRowPath = (typeof scheduleRowPaths)[number];

/**
 * The hours one schedule row keeps: how the time is meant, and the window.
 *
 * A one-off date and a weekly row post the same three repeated keys, which the
 * action reads index-aligned, so both render the same three controls from the
 * same field array. The weekday is the only difference, and stays in the caller.
 */
function ScheduleHoursFields({
  control,
  path,
  copy,
}: {
  control: Control<ActivityFieldValues>;
  path: ScheduleRowPath;
  copy: (key: string) => string;
}) {
  return (
    <>
      <SelectFormField
        control={control}
        name={`${path}.timingMode`}
        inputName="scheduleTimingMode"
        label={copy("activity.create.timingMode")}
      >
        <option value="fixed">{copy("activity.create.fixedTime")}</option>
        <option value="flexible">{copy("activity.create.flexibleTime")}</option>
      </SelectFormField>
      <TimeFormField
        control={control}
        name={`${path}.startTime`}
        inputName="scheduleStartTime"
        label={copy("activity.startTime")}
        required
      />
      <TimeFormField
        control={control}
        name={`${path}.endTime`}
        inputName="scheduleEndTime"
        label={copy("activity.endTime")}
        required
      />
    </>
  );
}

export function ActivityCreateForm({
  locale,
  activitiesPath,
  organizations,
  cities,
  places,
  categories,
  audiences,
  services,
  tags,
  contacts,
  labels,
  editorLabels,
  aiEnabled,
  canPublish = false,
}: {
  locale: Locale;
  activitiesPath: string;
  organizations: ActivityFormOption[];
  cities: ActivityFormOption[];
  places: ActivityFormOption[];
  categories: ActivityFormOption[];
  audiences: ActivityFormOption[];
  services: ActivityFormOption[];
  tags: ActivityFormOption[];
  contacts: ActivityFormOption[];
  labels: Labels;
  editorLabels: Labels;
  /** False when no AI translation provider is configured for this deployment. */
  aiEnabled: boolean;
  /**
   * Whether this editor may put the activity in front of readers from this form.
   * Publishing straight from a creation form means nobody has reviewed it, which
   * belongs to whoever holds the platform's own check; everyone else sends it up
   * the chain instead, so the two publishing choices are simply not offered.
   */
  canPublish?: boolean;
}) {
  const copy = (key: string) => readLabel(labels, key);
  const messages = useFormMessages(labels);
  const schema = useMemo(
    () =>
      activityFormSchema(
        messages,
        {
          invalidRange: readLabel(labels, "activity.scheduleInvalidRange"),
          overlap: readLabel(labels, "activity.scheduleOverlap"),
        },
        readLabel(labels, "activity.create.contactRequired"),
      ),
    [labels, messages],
  );
  /**
   * The associations, without the platform entry the owner list carries. They
   * are what a creator or provider can be: a relationship names an
   * organisation, and the platform is not one.
   */
  const partnerOrganizations = useMemo(
    () =>
      organizations.filter(
        (organization) => organization.id !== PLATFORM_OWNER_OPTION_ID,
      ),
    [organizations],
  );
  const defaultValues = useMemo<ActivityFieldValues>(() => {
    // An association by default, even where the platform may hold an activity:
    // holding one is the exception, and picking it should be deliberate.
    const owner = partnerOrganizations[0]?.id ?? organizations[0]?.id ?? "";
    const ownerRelationship =
      owner && owner !== PLATFORM_OWNER_OPTION_ID ? [owner] : [];
    return {
      sourceLanguage: "fr",
      organizationId: owner,
      creatorOrganizationId: ownerRelationship,
      providerOrganizationId: ownerRelationship,
      teamName: "",
      // Almost every activity belongs to one city; a nationwide helpline or an
      // online service is the rare exception, so the city stays the default.
      scope: "city",
      cityId: cities[0]?.id ?? "",
      locationMode: "existing",
      placeId: "",
      placeName: "",
      precision: "exact",
      categoryId: "",
      audienceCategoryId: "",
      tagId: [],
      serviceId: [],
      contactId: defaultContactSelection(contacts, owner),
      scheduleType: "recurring",
      occurrenceDate: "",
      validFrom: "",
      validTo: "",
      scheduleRows: [
        {
          weekday: "1",
          timingMode: "fixed",
          startTime: "09:00",
          endTime: "17:00",
        },
      ],
      hasException: false,
      exceptionDate: "",
      exceptionKind: "closure",
      partialException: false,
      exceptionStartTime: "",
      exceptionEndTime: "",
      exceptionReason: "",
      sourceNote: "",
    };
  }, [cities, contacts, organizations, partnerOrganizations]);
  const form = useWorkspaceForm({ schema, defaultValues });
  const { formProps } = useServerFormAction({
    form,
    action: createActivity,
    errorMessage: copy("activity.create.error"),
    invalidMessage: messages.reviewFields,
  });
  const scheduleRows = useFieldArray({
    control: form.control,
    name: "scheduleRows",
  });
  /**
   * Held here rather than in the form: the alt text belongs to the upload, and
   * the translation rail offers it beside the text it describes.
   */
  const [coverAlt, setCoverAlt] = useState("");

  const sourceLanguage = form.watch("sourceLanguage");
  const organizationId = form.watch("organizationId");
  const scope = form.watch("scope");
  const cityId = form.watch("cityId");
  const locationMode = form.watch("locationMode");
  const precision = form.watch("precision");
  const scheduleType = form.watch("scheduleType");
  const hasException = form.watch("hasException");
  const partialException = form.watch("partialException");
  const rows = form.watch("scheduleRows");

  /**
   * Whether the platform is holding this activity itself: no custodian, and so
   * no team, no organisation relationship and no organisation contact to
   * publish alongside it.
   */
  const ownedByPlatform = organizationId === PLATFORM_OWNER_OPTION_ID;
  const organizationOptions = useMemo(
    () => toOptions(organizations),
    [organizations],
  );
  const partnerOptions = useMemo(
    () => toOptions(partnerOrganizations),
    [partnerOrganizations],
  );
  const cityOptions = useMemo(() => toOptions(cities), [cities]);
  const placeOptions = useMemo(
    () => toOptions(places.filter((place) => place.cityId === cityId)),
    [cityId, places],
  );
  const categoryOptions = useMemo(() => toOptions(categories), [categories]);
  const audienceOptions = useMemo(() => toOptions(audiences), [audiences]);
  const tagOptions = useMemo(
    () => toOptions(tags.filter(ownedBy(organizationId))),
    [organizationId, tags],
  );
  const serviceOptions = useMemo(
    () => toOptions(services.filter(ownedBy(organizationId))),
    [organizationId, services],
  );
  const contactOptions = useMemo(
    // The platform publishes no contact of its own, and the addresses on offer
    // are organisations' — including the editor's, which stands in for one.
    () =>
      ownedByPlatform
        ? []
        : toOptions(contacts.filter(ownedBy(organizationId))),
    [contacts, organizationId, ownedByPlatform],
  );

  const changeOrganization = (next: string) => {
    /**
     * The owner is always a creator and a provider, but it is *this* owner, not
     * every organisation that has ever been selected in the dropdown: switching
     * from A to B has to take A back out again, or a mistyped choice quietly
     * credits an organisation that has nothing to do with the activity. Any
     * other organisation an editor added by hand is left alone.
     *
     * Handing the activity to the platform drops the relationships entirely:
     * nobody has agreed to stand behind it, which is the whole point of the
     * platform holding it, and a claim about an association is not the
     * platform's to make on its behalf.
     */
    const replaceOwner = (current: string[]) =>
      next === PLATFORM_OWNER_OPTION_ID
        ? []
        : [
            next,
            ...current.filter((id) => id !== organizationId && id !== next),
          ];
    const kept = ownedBy(next);
    form.setValue(
      "creatorOrganizationId",
      replaceOwner(form.getValues("creatorOrganizationId")),
      { shouldDirty: true },
    );
    form.setValue(
      "providerOrganizationId",
      replaceOwner(form.getValues("providerOrganizationId")),
      { shouldDirty: true },
    );
    form.setValue(
      "tagId",
      form
        .getValues("tagId")
        .filter((id) => tags.some((tag) => tag.id === id && kept(tag))),
      { shouldDirty: true },
    );
    form.setValue("contactId", defaultContactSelection(contacts, next), {
      shouldDirty: true,
    });
    form.setValue("serviceId", [], { shouldDirty: true });
  };

  const changeScope = (next: string) => {
    // Nothing global sits at an address: a place belongs to a city, so the only
    // honest location is "no fixed place".
    if (next !== "global") return;
    form.setValue("locationMode", "mobile", { shouldDirty: true });
    form.setValue("placeId", "", { shouldDirty: true });
  };

  /**
   * The rows to render, each with the path its controls address. A week allows
   * seven, which both the schema and the add button below enforce, so an eighth
   * row has no path and nothing to show.
   */
  const rowFields = scheduleRows.fields.flatMap((row, index) => {
    const path = scheduleRowPaths[index];
    return path ? [{ id: row.id, path, index }] : [];
  });

  const addScheduleRow = () => {
    const used = new Set(rows.map((row) => Number(row.weekday)));
    const free = weekdayNumbers.find((weekday) => !used.has(weekday)) ?? 1;
    scheduleRows.append({
      weekday: String(free),
      timingMode: "fixed",
      startTime: "09:00",
      endTime: "17:00",
    });
  };

  return (
    <form {...formProps} className="grid gap-6">
      <SidebarFocusMode />
      <input type="hidden" name="locale" value={locale} />

      <div className="space-y-3">
        <Button
          nativeButton={false}
          render={<Link href={activitiesPath} />}
          variant="ghost"
          size="sm"
          className="-ms-2"
        >
          <ArrowLeft aria-hidden />
          {copy("activity.create.back")}
        </Button>
        <div className="flex items-center gap-3">
          <span className="bg-brand-soft text-brand flex size-10 items-center justify-center rounded-lg">
            <CalendarClock aria-hidden />
          </span>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              {copy("activity.create.title")}
            </h1>
            <p className="text-copy-muted mt-1 max-w-2xl text-sm">
              {copy("activity.create.hint")}
            </p>
          </div>
        </div>
      </div>

      {/* Content spans the full width: the source text and the translation rail
       * need the room, and everything below it is short-field work that reads
       * fine in two columns. */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle>{copy("activity.create.content")}</CardTitle>
          <CardDescription>
            {copy("activity.create.contentHint")}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <SelectFormField
            control={form.control}
            name="sourceLanguage"
            label={copy("activity.create.sourceLanguage")}
            description={copy("activity.create.sourceLanguageHint")}
            className="max-w-sm"
          >
            {sourceLanguageOptions.map((language) => (
              <option key={language} value={language}>
                {copy(`language.${language}`)}
              </option>
            ))}
          </SelectFormField>
          <Separator />
          <TranslationWorkspace
            key={sourceLanguage}
            entityKind="activity"
            // The scope the permission check reads, so it is an organisation or
            // nothing: the platform's own work is checked platform-wide.
            organizationId={
              ownedByPlatform ? undefined : organizationId || undefined
            }
            interfaceLocale={locale}
            sourceLanguage={sourceLanguage}
            labels={editorLabels}
            aiEnabled={aiEnabled}
            imageAlt={{ source: coverAlt }}
          />
        </CardContent>
      </Card>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="grid gap-6">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>{copy("activity.create.schedule")}</CardTitle>
              <CardDescription>
                {copy("activity.create.scheduleHint")}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5">
              <SelectFormField
                control={form.control}
                name="scheduleType"
                label={copy("activity.create.scheduleType")}
              >
                <option value="recurring">
                  {copy("activity.create.recurring")}
                </option>
                <option value="one_off">
                  {copy("activity.create.oneOff")}
                </option>
              </SelectFormField>
              {scheduleType === "one_off" ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <DateFormField
                    control={form.control}
                    name="occurrenceDate"
                    label={copy("activity.create.date")}
                    locale={locale}
                    placeholder={copy("activity.create.selectDate")}
                    clearLabel={copy("activity.create.clearDate")}
                    required
                  />
                  <ScheduleHoursFields
                    control={form.control}
                    path="scheduleRows.0"
                    copy={copy}
                  />
                </div>
              ) : (
                <div className="grid gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <DateFormField
                      control={form.control}
                      name="validFrom"
                      label={copy("activity.create.validFrom")}
                      locale={locale}
                      placeholder={copy("activity.create.selectDate")}
                      clearLabel={copy("activity.create.clearDate")}
                    />
                    <DateFormField
                      control={form.control}
                      name="validTo"
                      label={copy("activity.create.validTo")}
                      locale={locale}
                      placeholder={copy("activity.create.selectDate")}
                      clearLabel={copy("activity.create.clearDate")}
                    />
                  </div>
                  {rowFields.map((row) => (
                    <div
                      key={row.id}
                      className="border-line bg-subtle grid gap-3 rounded-lg border p-3 sm:grid-cols-[minmax(8rem,1fr)_minmax(8rem,1fr)_minmax(7rem,1fr)_minmax(7rem,1fr)_auto] sm:items-end"
                    >
                      <SelectFormField
                        control={form.control}
                        name={`${row.path}.weekday`}
                        inputName="scheduleWeekday"
                        label={copy("activity.weekday")}
                      >
                        {weekdayNumbers.map((weekday) => (
                          <option key={weekday} value={String(weekday)}>
                            {copy(`weekday.${String(weekday)}`)}
                          </option>
                        ))}
                      </SelectFormField>
                      <ScheduleHoursFields
                        control={form.control}
                        path={row.path}
                        copy={copy}
                      />
                      <TooltipHint label={copy("activity.create.removeDay")}>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={copy("activity.create.removeDay")}
                          disabled={rowFields.length === 1}
                          onClick={() => {
                            scheduleRows.remove(row.index);
                          }}
                        >
                          <X aria-hidden />
                        </Button>
                      </TooltipHint>
                      <span className="text-copy-muted text-xs sm:col-span-5">
                        {copy(
                          rows[row.index]?.timingMode === "flexible"
                            ? "activity.create.flexibleTimeHint"
                            : "activity.create.fixedTimeHint",
                        ).replace("{day}", String(row.index + 1))}
                      </span>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    className="justify-self-start"
                    onClick={addScheduleRow}
                    disabled={rowFields.length >= scheduleRowPaths.length}
                  >
                    <Plus aria-hidden />
                    {copy("activity.create.addDay")}
                  </Button>
                </div>
              )}
              <Separator />
              <CheckboxFormField
                control={form.control}
                name="hasException"
                label={copy("activity.create.addException")}
                description={copy("activity.create.exceptionHint")}
                className="border-line bg-subtle rounded-lg border p-3"
              />
              {hasException ? (
                <div className="border-line grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
                  <DateFormField
                    control={form.control}
                    name="exceptionDate"
                    label={copy("activity.create.exceptionDate")}
                    locale={locale}
                    placeholder={copy("activity.create.selectDate")}
                    clearLabel={copy("activity.create.clearDate")}
                    required
                  />
                  <SelectFormField
                    control={form.control}
                    name="exceptionKind"
                    label={copy("activity.create.exceptionKind")}
                  >
                    <option value="closure">
                      {copy("activity.create.closure")}
                    </option>
                    <option value="cancellation">
                      {copy("activity.create.cancellation")}
                    </option>
                    <option value="exceptional_opening">
                      {copy("activity.create.exceptionalOpening")}
                    </option>
                    <option value="uncertain">
                      {copy("activity.create.uncertain")}
                    </option>
                  </SelectFormField>
                  <CheckboxFormField
                    control={form.control}
                    name="partialException"
                    label={copy("activity.create.partialException")}
                    className="sm:col-span-2"
                  />
                  {partialException ? (
                    <>
                      <TimeFormField
                        control={form.control}
                        name="exceptionStartTime"
                        label={copy("activity.startTime")}
                        required
                      />
                      <TimeFormField
                        control={form.control}
                        name="exceptionEndTime"
                        label={copy("activity.endTime")}
                        required
                      />
                    </>
                  ) : null}
                  <TextAreaFormField
                    control={form.control}
                    name="exceptionReason"
                    label={copy("activity.create.publicReason")}
                    className="sm:col-span-2"
                    rows={2}
                    maxLength={1000}
                  />
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle>{copy("activity.create.location")}</CardTitle>
              <CardDescription>
                {copy("activity.create.locationHint")}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectFormField
                  control={form.control}
                  name="scope"
                  label={copy("activity.create.scope")}
                  description={copy(
                    scope === "global"
                      ? "activity.create.scopeGlobalHint"
                      : "activity.create.scopeCityHint",
                  )}
                  onValueChange={changeScope}
                >
                  <option value="city">
                    {copy("activity.create.scopeCity")}
                  </option>
                  <option value="global">
                    {copy("activity.create.scopeGlobal")}
                  </option>
                </SelectFormField>
                {/* A global activity posts neither a city nor a location type:
                 * the action reads both as "nowhere in particular". */}
                {scope === "city" ? (
                  <>
                    <SearchableSelectFormField
                      control={form.control}
                      name="cityId"
                      label={copy("activity.create.city")}
                      options={cityOptions}
                      placeholder={copy("activity.create.chooseCity")}
                      emptyLabel={copy("activity.create.noMatch")}
                      onValueChange={() => {
                        form.setValue("placeId", "", { shouldDirty: true });
                      }}
                      required
                    />
                    <SelectFormField
                      control={form.control}
                      name="locationMode"
                      label={copy("activity.create.locationType")}
                    >
                      <option value="existing">
                        {copy("activity.create.existingPlace")}
                      </option>
                      <option value="new">
                        {copy("activity.create.newPlace")}
                      </option>
                      <option value="mobile">
                        {copy("activity.create.mobile")}
                      </option>
                    </SelectFormField>
                  </>
                ) : null}
              </div>
              {scope === "global" ? (
                <p className="border-line bg-subtle rounded-lg border p-4 text-sm">
                  {copy("activity.create.globalLocationHint")}
                </p>
              ) : locationMode === "existing" ? (
                <SearchableSelectFormField
                  control={form.control}
                  name="placeId"
                  label={copy("activity.create.place")}
                  options={placeOptions}
                  placeholder={copy("activity.create.choosePlace")}
                  emptyLabel={copy("activity.create.noPlaces")}
                  required
                />
              ) : locationMode === "new" ? (
                <div className="border-line grid gap-4 rounded-lg border p-4">
                  <TextFormField
                    control={form.control}
                    name="placeName"
                    label={copy("activity.create.placeName")}
                    minLength={2}
                    required
                  />
                  <PlaceAddressFields
                    labels={{
                      label: copy("activity.create.address"),
                      placeholder: copy("activity.create.addressPlaceholder"),
                      help: copy("activity.create.addressHelp"),
                      loading: copy("activity.create.addressLoading"),
                      empty: copy("activity.create.addressEmpty"),
                      error: copy("activity.create.addressError"),
                      attribution: copy("activity.create.addressAttribution"),
                    }}
                    selectedLabel={copy("activity.create.addressSelected")}
                  />
                  <SelectFormField
                    control={form.control}
                    name="precision"
                    label={copy("field.precision")}
                    description={copy("precision.hint")}
                  >
                    {placePrecisions.map((value) => (
                      <option key={value} value={value}>
                        {copy(`precision.${value}`)}
                      </option>
                    ))}
                  </SelectFormField>
                </div>
              ) : (
                <p className="border-line bg-subtle rounded-lg border p-4 text-sm">
                  {copy("activity.create.mobileHint")}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:sticky xl:top-6">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>{copy("activity.create.ownership")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <SearchableSelectFormField
                control={form.control}
                name="organizationId"
                label={copy("field.organization")}
                options={organizationOptions}
                placeholder={copy("activity.create.chooseOrganization")}
                emptyLabel={copy("activity.create.noMatch")}
                onValueChange={changeOrganization}
                required
              />
              {/* An activity the platform holds has nobody standing behind it
               * yet: it is published on the platform's own account, and a
               * relationship naming an association would say otherwise. */}
              {ownedByPlatform ? (
                <p className="border-line bg-subtle rounded-lg border p-4 text-sm">
                  {copy("activity.platformOwnerHint")}
                </p>
              ) : (
                <>
                  <SearchableMultiSelectFormField
                    control={form.control}
                    name="creatorOrganizationId"
                    label={copy("activity.create.creators")}
                    options={partnerOptions}
                    placeholder={copy("activity.create.chooseOrganizations")}
                    emptyLabel={copy("activity.create.noMatch")}
                  />
                  <SearchableMultiSelectFormField
                    control={form.control}
                    name="providerOrganizationId"
                    label={copy("activity.create.providers")}
                    options={partnerOptions}
                    placeholder={copy("activity.create.chooseOrganizations")}
                    emptyLabel={copy("activity.create.noMatch")}
                  />
                </>
              )}
              {/* Teams are organisation-and-city pairs, so neither a global
               * activity nor a platform-held one has any to name. */}
              {scope === "city" && !ownedByPlatform ? (
                <TextFormField
                  control={form.control}
                  name="teamName"
                  label={copy("activity.create.team")}
                  description={copy("activity.create.teamHint")}
                />
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle>{copy("activity.create.classification")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <SearchableSelectFormField
                control={form.control}
                name="categoryId"
                label={copy("table.category")}
                options={categoryOptions}
                placeholder={copy("activity.create.chooseCategory")}
                emptyLabel={copy("activity.create.noMatch")}
                required
              />
              <SearchableSelectFormField
                control={form.control}
                name="audienceCategoryId"
                label={copy("table.audience")}
                options={audienceOptions}
                placeholder={copy("activity.create.chooseAudience")}
                emptyLabel={copy("activity.create.noMatch")}
                required
              />
              <SearchableMultiSelectFormField
                control={form.control}
                name="tagId"
                label={copy("activity.create.tags")}
                options={tagOptions}
                maxSelections={5}
                placeholder={copy("activity.create.chooseTags")}
                emptyLabel={copy("activity.create.noMatch")}
              />
              <SearchableMultiSelectFormField
                control={form.control}
                name="serviceId"
                label={copy("activity.create.services")}
                options={serviceOptions}
                placeholder={copy("activity.create.chooseServices")}
                emptyLabel={copy("activity.create.noMatch")}
              />
              <SearchableMultiSelectFormField
                control={form.control}
                name="contactId"
                label={copy("activity.create.contacts")}
                options={contactOptions}
                placeholder={copy("activity.create.chooseContacts")}
                emptyLabel={copy("activity.create.noContacts")}
                description={copy(
                  precision === "contact_to_learn"
                    ? "activity.create.contactRequired"
                    : "activity.create.contactsHint",
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <FileImage aria-hidden />
                {copy("activity.create.image")}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <CoverImageField
                locale={locale}
                sourceLanguage={sourceLanguage}
                createUpload={createActivityImageUpload}
                labels={coverImageLabels(labels, "activity.create.image")}
                idPrefix="activity-cover"
                onAltTextChange={setCoverAlt}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle>{copy("activity.create.source")}</CardTitle>
            </CardHeader>
            <CardContent>
              <TextAreaFormField
                control={form.control}
                name="sourceNote"
                label={copy("activity.create.sourceNote")}
                rows={3}
              />
            </CardContent>
            <CardContent className="border-t pt-5">
              <PublicationChoice
                locale={locale}
                canPublish={canPublish}
                labels={{
                  heading: copy("publication.heading"),
                  hint: copy("publication.hint"),
                  draft: copy("publication.draft"),
                  team: copy("publication.team"),
                  platform: copy("publication.platform"),
                  now: copy("publication.now"),
                  scheduled: copy("publication.scheduled"),
                  date: copy("publication.dateOnly"),
                  time: copy("publication.time"),
                  selectDate: copy("publication.selectDate"),
                  clearDate: copy("publication.clearDate"),
                  dateHint: copy("publication.dateHint"),
                }}
              />
            </CardContent>
            <CardFooter className="justify-end gap-2">
              <Button
                nativeButton={false}
                render={<Link href={activitiesPath} />}
                variant="outline"
              >
                {copy("activity.create.cancel")}
              </Button>
              <FormSubmitButton control={form.control}>
                <Plus aria-hidden />
                {copy("activity.create.action")}
              </FormSubmitButton>
            </CardFooter>
          </Card>
        </div>
      </div>
    </form>
  );
}
