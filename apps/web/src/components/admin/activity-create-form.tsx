"use client";

import {
  ArrowLeft,
  CalendarClock,
  FileImage,
  LoaderCircle,
  Plus,
  X,
} from "lucide-react";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import {
  useActionState,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import { createActivity } from "~/app/[locale]/dashboard/activities/actions";
import { createActivityImageUpload } from "~/app/[locale]/dashboard/activities/image-actions";
import {
  CoverImagePreview,
  useCoverImagePreview,
} from "~/components/admin/cover-image-preview";
import {
  SearchableMultiSelect,
  SearchableSelect,
} from "~/components/admin/searchable-select";
import { PlaceAddressFields } from "~/components/address/place-address-fields";
import { PendingButton } from "~/components/pending-button";
import { PublicationChoice } from "~/components/admin/publication-choice";
import { SidebarFocusMode } from "~/components/admin/sidebar-focus-mode";
import { TooltipHint } from "~/components/admin/tooltip-hint";
import { TranslationWorkspace } from "~/components/admin/translation-workspace";
import { TimePicker } from "~/components/shadcn-studio/date-picker/date-picker-09";
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
  AttachmentTrigger,
} from "~/components/ui/attachment";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import { DatePicker } from "~/components/ui/date-picker";
import { Field, FieldDescription, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { SelectField } from "~/components/ui/select-field";
import { Separator } from "~/components/ui/separator";
import { Textarea } from "~/components/ui/textarea";
import { EDITOR_CONTACT_OPTION_ID } from "~/lib/editor-contact";

/**
 * The source language an editor authors in first. Restricted to French and
 * English for now, even though the translation editor still covers all
 * `editorialLanguageCodes` for the target content.
 */
const sourceLanguageOptions = ["fr", "en"] as const;
type SourceLanguage = (typeof sourceLanguageOptions)[number];

type ScheduleRow = {
  id: string;
  weekday: number;
  timingMode: "fixed" | "flexible";
  startTime: string;
  endTime: string;
};

type CreateState = { result: "idle" | "error"; revision: number };
const initialCreateState: CreateState = { result: "idle", revision: 0 };

async function submitActivity(
  previous: CreateState,
  formData: FormData,
): Promise<CreateState> {
  try {
    await createActivity(formData);
    return previous;
  } catch (error) {
    unstable_rethrow(error);
    return { result: "error", revision: previous.revision + 1 };
  }
}

function newScheduleRow(weekday: number): ScheduleRow {
  return {
    id: crypto.randomUUID(),
    weekday,
    timingMode: "fixed",
    startTime: "09:00",
    endTime: "17:00",
  };
}

export interface ActivityFormOption {
  id: string;
  label: string;
  description?: string;
  organizationId?: string | null;
  cityId?: string;
  icon?: string;
}

function label(labels: Record<string, string>, key: string) {
  return labels[key] ?? key;
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
  const owned = contacts.find((contact) => contact.organizationId === owner);
  if (owned) return [owned.id];
  const editor = contacts.find(
    (contact) => contact.id === EDITOR_CONTACT_OPTION_ID,
  );
  return editor ? [editor.id] : [];
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
}: {
  locale: "fr" | "en" | "ar";
  activitiesPath: string;
  organizations: ActivityFormOption[];
  cities: ActivityFormOption[];
  places: ActivityFormOption[];
  categories: ActivityFormOption[];
  audiences: ActivityFormOption[];
  services: ActivityFormOption[];
  tags: ActivityFormOption[];
  contacts: ActivityFormOption[];
  labels: Record<string, string>;
  editorLabels: Record<string, string>;
  /** False when no AI translation provider is configured for this deployment. */
  aiEnabled: boolean;
}) {
  const [organizationId, setOrganizationId] = useState(
    organizations[0]?.id ?? "",
  );
  // Almost every activity belongs to one city; a nationwide helpline or an
  // online service is the rare exception, so the city stays the default.
  const [scope, setScope] = useState<"city" | "global">("city");
  const [cityId, setCityId] = useState(cities[0]?.id ?? "");
  const [sourceLanguage, setSourceLanguage] = useState<SourceLanguage>("fr");
  const [placeId, setPlaceId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [audienceId, setAudienceId] = useState("");
  const [locationMode, setLocationMode] = useState<
    "existing" | "new" | "mobile"
  >("existing");
  const [precision, setPrecision] = useState<
    "exact" | "area_only" | "contact_to_learn"
  >("exact");
  const [scheduleType, setScheduleType] = useState<"recurring" | "one_off">(
    "recurring",
  );
  // The first row is rendered on the server too, so its id has to survive the
  // handover: a fresh UUID on each side makes every label and control inside
  // the row hydrate as a mismatch. Rows the editor adds later are client-only,
  // so those can keep using a random id.
  const firstScheduleRowId = useId();
  const [scheduleRows, setScheduleRows] = useState<ScheduleRow[]>(() => [
    { ...newScheduleRow(1), id: firstScheduleRowId },
  ]);
  const [hasException, setHasException] = useState(false);
  const [partialException, setPartialException] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<string[]>(() =>
    defaultContactSelection(contacts, organizations[0]?.id ?? ""),
  );
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [creatorIds, setCreatorIds] = useState<string[]>(
    organizationId ? [organizationId] : [],
  );
  const [providerIds, setProviderIds] = useState<string[]>(
    organizationId ? [organizationId] : [],
  );
  const [coverAssetId, setCoverAssetId] = useState("");
  const [coverFileName, setCoverFileName] = useState("");
  const [coverAlt, setCoverAlt] = useState("");
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [imageState, setImageState] = useState<
    "idle" | "uploading" | "done" | "error"
  >("idle");
  const coverInputRef = useRef<HTMLInputElement>(null);
  const { previewSrc, showFile, clearPreview } = useCoverImagePreview();
  const [createState, createAction] = useActionState(
    submitActivity,
    initialCreateState,
  );

  useEffect(() => {
    if (createState.result === "error") {
      toast.error(label(labels, "activity.create.error"));
    }
  }, [createState, labels]);

  const inOrganization = (option: ActivityFormOption) =>
    option.organizationId === null ||
    option.organizationId === undefined ||
    option.organizationId === organizationId;
  const placeOptions = useMemo(
    () => places.filter((place) => place.cityId === cityId),
    [cityId, places],
  );

  const updateOrganization = (next: string) => {
    /**
     * The owner is always a creator and a provider, but it is *this* owner, not
     * every organisation that has ever been selected in the dropdown: switching
     * from A to B has to take A back out again, or a mistyped choice quietly
     * credits an organisation that has nothing to do with the activity. Any
     * other organisation an editor added by hand is left alone.
     */
    const replaceOwner = (current: string[]) => [
      next,
      ...current.filter((id) => id !== organizationId && id !== next),
    ];
    setOrganizationId(next);
    setCreatorIds(replaceOwner);
    setProviderIds(replaceOwner);
    setSelectedTags((current) =>
      current.filter((id) => {
        const tag = tags.find((item) => item.id === id);
        return tag?.organizationId === null || tag?.organizationId === next;
      }),
    );
    setSelectedContacts(defaultContactSelection(contacts, next));
    setSelectedServices([]);
  };

  const uploadCover = async (file: File | undefined) => {
    if (!file) return;
    setCoverFileName(file.name);
    setImageState("uploading");
    try {
      const request = new FormData();
      request.set("locale", locale);
      request.set("mimeType", file.type);
      request.set("byteSize", String(file.size));
      request.set("languageCode", sourceLanguage);
      request.set("altText", coverAlt);
      request.set("rightsConfirmed", rightsConfirmed ? "true" : "false");
      const upload = await createActivityImageUpload(request);
      const response = await fetch(upload.uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!response.ok) throw new Error("Upload failed");
      setCoverAssetId(upload.assetId);
      showFile(file);
      setImageState("done");
    } catch {
      setCoverAssetId("");
      setImageState("error");
    }
  };

  const clearCover = () => {
    setCoverAssetId("");
    setCoverFileName("");
    setImageState("idle");
    clearPreview();
    if (coverInputRef.current) coverInputRef.current.value = "";
  };

  const updateScheduleRow = (
    id: string,
    patch: Partial<Omit<ScheduleRow, "id">>,
  ) => {
    setScheduleRows((current) =>
      current.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  };

  const addScheduleRow = () => {
    const used = new Set(scheduleRows.map((row) => row.weekday));
    const nextWeekday =
      [1, 2, 3, 4, 5, 6, 7].find((weekday) => !used.has(weekday)) ?? 1;
    setScheduleRows((current) => [...current, newScheduleRow(nextWeekday)]);
  };

  const attachmentDescription =
    imageState === "uploading"
      ? label(labels, "activity.create.image.uploading")
      : imageState === "done"
        ? label(labels, "activity.create.image.uploaded").replace(
            "{name}",
            coverFileName,
          )
        : imageState === "error"
          ? label(labels, "activity.create.image.error")
          : label(labels, "activity.create.image.constraints");

  return (
    <form action={createAction} className="grid gap-6">
      <SidebarFocusMode />
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="coverAssetId" value={coverAssetId} />
      <input type="hidden" name="precision" value={precision} />

      <div className="space-y-3">
        <Button
          nativeButton={false}
          render={<Link href={activitiesPath} />}
          variant="ghost"
          size="sm"
          className="-ms-2"
        >
          <ArrowLeft aria-hidden />
          {label(labels, "activity.create.back")}
        </Button>
        <div className="flex items-center gap-3">
          <span className="bg-brand-soft text-brand flex size-10 items-center justify-center rounded-lg">
            <CalendarClock aria-hidden />
          </span>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              {label(labels, "activity.create.title")}
            </h1>
            <p className="text-copy-muted mt-1 max-w-2xl text-sm">
              {label(labels, "activity.create.hint")}
            </p>
          </div>
        </div>
      </div>

      {/* Content spans the full width: the source text and the translation rail
       * need the room, and everything below it is short-field work that reads
       * fine in two columns. */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle>{label(labels, "activity.create.content")}</CardTitle>
          <CardDescription>
            {label(labels, "activity.create.contentHint")}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <Field className="max-w-sm">
            <FieldLabel htmlFor="activity-source-language">
              {label(labels, "activity.create.sourceLanguage")}
            </FieldLabel>
            <SelectField
              id="activity-source-language"
              name="sourceLanguage"
              value={sourceLanguage}
              onValueChange={(next) => {
                setSourceLanguage(next as SourceLanguage);
              }}
            >
              {sourceLanguageOptions.map((language) => (
                <option key={language} value={language}>
                  {label(labels, `language.${language}`)}
                </option>
              ))}
            </SelectField>
            <FieldDescription>
              {label(labels, "activity.create.sourceLanguageHint")}
            </FieldDescription>
          </Field>
          <Separator />
          <TranslationWorkspace
            key={sourceLanguage}
            entityKind="activity"
            organizationId={organizationId || undefined}
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
              <CardTitle>{label(labels, "activity.create.schedule")}</CardTitle>
              <CardDescription>
                {label(labels, "activity.create.scheduleHint")}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5">
              <Field>
                <FieldLabel htmlFor="activity-schedule-type">
                  {label(labels, "activity.create.scheduleType")}
                </FieldLabel>
                <SelectField
                  id="activity-schedule-type"
                  name="scheduleType"
                  value={scheduleType}
                  onValueChange={(next) => {
                    setScheduleType(next as "recurring" | "one_off");
                  }}
                >
                  <option value="recurring">
                    {label(labels, "activity.create.recurring")}
                  </option>
                  <option value="one_off">
                    {label(labels, "activity.create.oneOff")}
                  </option>
                </SelectField>
              </Field>
              {scheduleType === "one_off" ? (
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field>
                    <FieldLabel>
                      {label(labels, "activity.create.date")}
                    </FieldLabel>
                    <DatePicker
                      name="occurrenceDate"
                      locale={locale}
                      placeholder={label(labels, "activity.create.selectDate")}
                      clearLabel={label(labels, "activity.create.clearDate")}
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="one-off-timing-mode">
                      {label(labels, "activity.create.timingMode")}
                    </FieldLabel>
                    <SelectField
                      id="one-off-timing-mode"
                      name="scheduleTimingMode"
                      defaultValue="fixed"
                    >
                      <option value="fixed">
                        {label(labels, "activity.create.fixedTime")}
                      </option>
                      <option value="flexible">
                        {label(labels, "activity.create.flexibleTime")}
                      </option>
                    </SelectField>
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field>
                      <FieldLabel>
                        {label(labels, "activity.startTime")}
                      </FieldLabel>
                      <TimePicker
                        name="scheduleStartTime"
                        defaultValue="09:00"
                        required
                      />
                    </Field>
                    <Field>
                      <FieldLabel>
                        {label(labels, "activity.endTime")}
                      </FieldLabel>
                      <TimePicker
                        name="scheduleEndTime"
                        defaultValue="17:00"
                        required
                      />
                    </Field>
                  </div>
                </div>
              ) : (
                <div className="grid gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel>
                        {label(labels, "activity.create.validFrom")}
                      </FieldLabel>
                      <DatePicker
                        name="validFrom"
                        locale={locale}
                        placeholder={label(
                          labels,
                          "activity.create.selectDate",
                        )}
                        clearLabel={label(labels, "activity.create.clearDate")}
                      />
                    </Field>
                    <Field>
                      <FieldLabel>
                        {label(labels, "activity.create.validTo")}
                      </FieldLabel>
                      <DatePicker
                        name="validTo"
                        locale={locale}
                        placeholder={label(
                          labels,
                          "activity.create.selectDate",
                        )}
                        clearLabel={label(labels, "activity.create.clearDate")}
                      />
                    </Field>
                  </div>
                  {scheduleRows.map((row, index) => (
                    <div
                      key={row.id}
                      className="border-line bg-subtle grid gap-3 rounded-lg border p-3 sm:grid-cols-[minmax(8rem,1fr)_minmax(8rem,1fr)_minmax(7rem,1fr)_minmax(7rem,1fr)_auto] sm:items-end"
                    >
                      <Field>
                        <FieldLabel htmlFor={`schedule-weekday-${row.id}`}>
                          {label(labels, "activity.weekday")}
                        </FieldLabel>
                        <SelectField
                          id={`schedule-weekday-${row.id}`}
                          name="scheduleWeekday"
                          value={String(row.weekday)}
                          onValueChange={(next) => {
                            updateScheduleRow(row.id, {
                              weekday: Number(next),
                            });
                          }}
                        >
                          {[1, 2, 3, 4, 5, 6, 7].map((weekday) => (
                            <option key={weekday} value={String(weekday)}>
                              {label(labels, `weekday.${String(weekday)}`)}
                            </option>
                          ))}
                        </SelectField>
                      </Field>
                      <Field>
                        <FieldLabel htmlFor={`schedule-mode-${row.id}`}>
                          {label(labels, "activity.create.timingMode")}
                        </FieldLabel>
                        <SelectField
                          id={`schedule-mode-${row.id}`}
                          name="scheduleTimingMode"
                          value={row.timingMode}
                          onValueChange={(next) => {
                            updateScheduleRow(row.id, {
                              timingMode: next as ScheduleRow["timingMode"],
                            });
                          }}
                        >
                          <option value="fixed">
                            {label(labels, "activity.create.fixedTime")}
                          </option>
                          <option value="flexible">
                            {label(labels, "activity.create.flexibleTime")}
                          </option>
                        </SelectField>
                      </Field>
                      <Field>
                        <FieldLabel>
                          {label(labels, "activity.startTime")}
                        </FieldLabel>
                        <TimePicker
                          name="scheduleStartTime"
                          value={row.startTime}
                          onChange={(event) => {
                            updateScheduleRow(row.id, {
                              startTime: event.target.value,
                            });
                          }}
                          required
                        />
                      </Field>
                      <Field>
                        <FieldLabel>
                          {label(labels, "activity.endTime")}
                        </FieldLabel>
                        <TimePicker
                          name="scheduleEndTime"
                          value={row.endTime}
                          onChange={(event) => {
                            updateScheduleRow(row.id, {
                              endTime: event.target.value,
                            });
                          }}
                          required
                        />
                      </Field>
                      <TooltipHint
                        label={label(labels, "activity.create.removeDay")}
                      >
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={label(
                            labels,
                            "activity.create.removeDay",
                          )}
                          disabled={scheduleRows.length === 1}
                          onClick={() => {
                            setScheduleRows((current) =>
                              current.filter((item) => item.id !== row.id),
                            );
                          }}
                        >
                          <X aria-hidden />
                        </Button>
                      </TooltipHint>
                      <span className="text-copy-muted text-xs sm:col-span-5">
                        {label(
                          labels,
                          row.timingMode === "fixed"
                            ? "activity.create.fixedTimeHint"
                            : "activity.create.flexibleTimeHint",
                        ).replace("{day}", String(index + 1))}
                      </span>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    className="justify-self-start"
                    onClick={addScheduleRow}
                    disabled={scheduleRows.length >= 7}
                  >
                    <Plus aria-hidden />
                    {label(labels, "activity.create.addDay")}
                  </Button>
                </div>
              )}
              <Separator />
              <label className="border-line bg-subtle flex items-start gap-3 rounded-lg border p-3 text-sm">
                <Checkbox
                  checked={hasException}
                  onCheckedChange={setHasException}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium">
                    {label(labels, "activity.create.addException")}
                  </span>
                  <span className="text-copy-muted mt-0.5 block text-xs">
                    {label(labels, "activity.create.exceptionHint")}
                  </span>
                </span>
              </label>
              {hasException ? (
                <div className="border-line grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel>
                      {label(labels, "activity.create.exceptionDate")}
                    </FieldLabel>
                    <DatePicker
                      name="exceptionDate"
                      locale={locale}
                      placeholder={label(labels, "activity.create.selectDate")}
                      clearLabel={label(labels, "activity.create.clearDate")}
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="activity-exception-kind">
                      {label(labels, "activity.create.exceptionKind")}
                    </FieldLabel>
                    <SelectField
                      id="activity-exception-kind"
                      name="exceptionKind"
                      defaultValue="closure"
                    >
                      <option value="closure">
                        {label(labels, "activity.create.closure")}
                      </option>
                      <option value="cancellation">
                        {label(labels, "activity.create.cancellation")}
                      </option>
                      <option value="exceptional_opening">
                        {label(labels, "activity.create.exceptionalOpening")}
                      </option>
                      <option value="uncertain">
                        {label(labels, "activity.create.uncertain")}
                      </option>
                    </SelectField>
                  </Field>
                  <label className="flex items-center gap-3 text-sm sm:col-span-2">
                    <Checkbox
                      checked={partialException}
                      onCheckedChange={setPartialException}
                    />
                    {label(labels, "activity.create.partialException")}
                  </label>
                  {partialException ? (
                    <>
                      <Field>
                        <FieldLabel>
                          {label(labels, "activity.startTime")}
                        </FieldLabel>
                        <TimePicker name="exceptionStartTime" required />
                      </Field>
                      <Field>
                        <FieldLabel>
                          {label(labels, "activity.endTime")}
                        </FieldLabel>
                        <TimePicker name="exceptionEndTime" required />
                      </Field>
                    </>
                  ) : null}
                  <Field className="sm:col-span-2">
                    <FieldLabel htmlFor="activity-exception-reason">
                      {label(labels, "activity.create.publicReason")}
                    </FieldLabel>
                    <Textarea
                      id="activity-exception-reason"
                      name="exceptionReason"
                      rows={2}
                      maxLength={1000}
                    />
                  </Field>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle>{label(labels, "activity.create.location")}</CardTitle>
              <CardDescription>
                {label(labels, "activity.create.locationHint")}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="activity-scope">
                    {label(labels, "activity.create.scope")}
                  </FieldLabel>
                  <SelectField
                    id="activity-scope"
                    name="scope"
                    value={scope}
                    onValueChange={(next) => {
                      const nextScope = next as typeof scope;
                      setScope(nextScope);
                      // Nothing global sits at an address: a place belongs to a
                      // city, so the only honest location is "no fixed place".
                      if (nextScope === "global") {
                        setLocationMode("mobile");
                        setPlaceId("");
                      }
                    }}
                  >
                    <option value="city">
                      {label(labels, "activity.create.scopeCity")}
                    </option>
                    <option value="global">
                      {label(labels, "activity.create.scopeGlobal")}
                    </option>
                  </SelectField>
                  <FieldDescription>
                    {label(
                      labels,
                      scope === "global"
                        ? "activity.create.scopeGlobalHint"
                        : "activity.create.scopeCityHint",
                    )}
                  </FieldDescription>
                </Field>
                {scope === "city" ? (
                  <>
                    <Field>
                      <FieldLabel>
                        {label(labels, "activity.create.city")}
                      </FieldLabel>
                      <SearchableSelect
                        name="cityId"
                        options={cities.map((city) => ({
                          value: city.id,
                          label: city.label,
                        }))}
                        value={cityId}
                        onValueChange={(nextCityId) => {
                          setCityId(nextCityId);
                          setPlaceId("");
                        }}
                        label={label(labels, "activity.create.city")}
                        placeholder={label(
                          labels,
                          "activity.create.chooseCity",
                        )}
                        emptyLabel={label(labels, "activity.create.noMatch")}
                        required
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="activity-location-mode">
                        {label(labels, "activity.create.locationType")}
                      </FieldLabel>
                      <SelectField
                        id="activity-location-mode"
                        name="locationMode"
                        value={locationMode}
                        onValueChange={(next) => {
                          setLocationMode(next as typeof locationMode);
                        }}
                      >
                        <option value="existing">
                          {label(labels, "activity.create.existingPlace")}
                        </option>
                        <option value="new">
                          {label(labels, "activity.create.newPlace")}
                        </option>
                        <option value="mobile">
                          {label(labels, "activity.create.mobile")}
                        </option>
                      </SelectField>
                    </Field>
                  </>
                ) : (
                  <input type="hidden" name="locationMode" value="mobile" />
                )}
              </div>
              {scope === "global" ? (
                <p className="border-line bg-subtle rounded-lg border p-4 text-sm">
                  {label(labels, "activity.create.globalLocationHint")}
                </p>
              ) : locationMode === "existing" ? (
                <Field>
                  <FieldLabel>
                    {label(labels, "activity.create.place")}
                  </FieldLabel>
                  <SearchableSelect
                    name="placeId"
                    options={placeOptions.map((place) => ({
                      value: place.id,
                      label: place.label,
                      description: place.description,
                    }))}
                    value={placeId}
                    onValueChange={setPlaceId}
                    label={label(labels, "activity.create.place")}
                    placeholder={label(labels, "activity.create.choosePlace")}
                    emptyLabel={label(labels, "activity.create.noPlaces")}
                    required
                  />
                </Field>
              ) : locationMode === "new" ? (
                <div className="border-line grid gap-4 rounded-lg border p-4">
                  <Field>
                    <FieldLabel htmlFor="activity-place-name">
                      {label(labels, "activity.create.placeName")}
                    </FieldLabel>
                    <Input
                      id="activity-place-name"
                      name="placeName"
                      minLength={2}
                      required
                    />
                  </Field>
                  <PlaceAddressFields
                    labels={{
                      label: label(labels, "activity.create.address"),
                      placeholder: label(
                        labels,
                        "activity.create.addressPlaceholder",
                      ),
                      help: label(labels, "activity.create.addressHelp"),
                      loading: label(labels, "activity.create.addressLoading"),
                      empty: label(labels, "activity.create.addressEmpty"),
                      error: label(labels, "activity.create.addressError"),
                      attribution: label(
                        labels,
                        "activity.create.addressAttribution",
                      ),
                    }}
                    selectedLabel={label(
                      labels,
                      "activity.create.addressSelected",
                    )}
                  />
                  <Field>
                    <FieldLabel htmlFor="activity-precision">
                      {label(labels, "field.precision")}
                    </FieldLabel>
                    <SelectField
                      id="activity-precision"
                      value={precision}
                      onValueChange={(next) => {
                        setPrecision(next as typeof precision);
                      }}
                    >
                      <option value="exact">
                        {label(labels, "precision.exact")}
                      </option>
                      <option value="area_only">
                        {label(labels, "precision.area_only")}
                      </option>
                      <option value="contact_to_learn">
                        {label(labels, "precision.contact_to_learn")}
                      </option>
                    </SelectField>
                    <FieldDescription>
                      {label(labels, "precision.hint")}
                    </FieldDescription>
                  </Field>
                </div>
              ) : (
                <p className="border-line bg-subtle rounded-lg border p-4 text-sm">
                  {label(labels, "activity.create.mobileHint")}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:sticky xl:top-6">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>
                {label(labels, "activity.create.ownership")}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Field>
                <FieldLabel>{label(labels, "field.organization")}</FieldLabel>
                <SearchableSelect
                  name="organizationId"
                  options={organizations.map((item) => ({
                    value: item.id,
                    label: item.label,
                  }))}
                  value={organizationId}
                  onValueChange={updateOrganization}
                  label={label(labels, "field.organization")}
                  placeholder={label(
                    labels,
                    "activity.create.chooseOrganization",
                  )}
                  emptyLabel={label(labels, "activity.create.noMatch")}
                  required
                />
              </Field>
              <Field>
                <FieldLabel>
                  {label(labels, "activity.create.creators")}
                </FieldLabel>
                <SearchableMultiSelect
                  name="creatorOrganizationId"
                  options={organizations.map((item) => ({
                    value: item.id,
                    label: item.label,
                  }))}
                  value={creatorIds}
                  onValueChange={setCreatorIds}
                  label={label(labels, "activity.create.creators")}
                  placeholder={label(
                    labels,
                    "activity.create.chooseOrganizations",
                  )}
                  emptyLabel={label(labels, "activity.create.noMatch")}
                />
              </Field>
              <Field>
                <FieldLabel>
                  {label(labels, "activity.create.providers")}
                </FieldLabel>
                <SearchableMultiSelect
                  name="providerOrganizationId"
                  options={organizations.map((item) => ({
                    value: item.id,
                    label: item.label,
                  }))}
                  value={providerIds}
                  onValueChange={setProviderIds}
                  label={label(labels, "activity.create.providers")}
                  placeholder={label(
                    labels,
                    "activity.create.chooseOrganizations",
                  )}
                  emptyLabel={label(labels, "activity.create.noMatch")}
                />
              </Field>
              {/* Teams are organisation-and-city pairs, so a global activity
               * has none to name. */}
              {scope === "city" ? (
                <Field>
                  <FieldLabel htmlFor="activity-team-name">
                    {label(labels, "activity.create.team")}
                  </FieldLabel>
                  <Input id="activity-team-name" name="teamName" />
                  <FieldDescription>
                    {label(labels, "activity.create.teamHint")}
                  </FieldDescription>
                </Field>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle>
                {label(labels, "activity.create.classification")}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Field>
                <FieldLabel>{label(labels, "table.category")}</FieldLabel>
                <SearchableSelect
                  name="categoryId"
                  options={categories.map((item) => ({
                    value: item.id,
                    label: item.label,
                    description: item.description,
                  }))}
                  value={categoryId}
                  onValueChange={setCategoryId}
                  label={label(labels, "table.category")}
                  placeholder={label(labels, "activity.create.chooseCategory")}
                  emptyLabel={label(labels, "activity.create.noMatch")}
                  required
                />
              </Field>
              <Field>
                <FieldLabel>{label(labels, "table.audience")}</FieldLabel>
                <SearchableSelect
                  name="audienceCategoryId"
                  options={audiences.map((item) => ({
                    value: item.id,
                    label: item.label,
                    description: item.description,
                  }))}
                  value={audienceId}
                  onValueChange={setAudienceId}
                  label={label(labels, "table.audience")}
                  placeholder={label(labels, "activity.create.chooseAudience")}
                  emptyLabel={label(labels, "activity.create.noMatch")}
                  required
                />
              </Field>
              <Field>
                <FieldLabel>{label(labels, "activity.create.tags")}</FieldLabel>
                <SearchableMultiSelect
                  name="tagId"
                  maxSelections={5}
                  options={tags.filter(inOrganization).map((item) => ({
                    value: item.id,
                    label: item.label,
                    description: item.description,
                  }))}
                  value={selectedTags}
                  onValueChange={setSelectedTags}
                  label={label(labels, "activity.create.tags")}
                  placeholder={label(labels, "activity.create.chooseTags")}
                  emptyLabel={label(labels, "activity.create.noMatch")}
                />
              </Field>
              <Field>
                <FieldLabel>
                  {label(labels, "activity.create.services")}
                </FieldLabel>
                <SearchableMultiSelect
                  name="serviceId"
                  options={services.filter(inOrganization).map((item) => ({
                    value: item.id,
                    label: item.label,
                    description: item.description,
                    icon: item.icon,
                  }))}
                  value={selectedServices}
                  onValueChange={setSelectedServices}
                  label={label(labels, "activity.create.services")}
                  placeholder={label(labels, "activity.create.chooseServices")}
                  emptyLabel={label(labels, "activity.create.noMatch")}
                />
              </Field>
              <Field>
                <FieldLabel>
                  {label(labels, "activity.create.contacts")}
                </FieldLabel>
                <SearchableMultiSelect
                  name="contactId"
                  options={contacts.filter(inOrganization).map((item) => ({
                    value: item.id,
                    label: item.label,
                    description: item.description,
                  }))}
                  value={selectedContacts}
                  onValueChange={setSelectedContacts}
                  label={label(labels, "activity.create.contacts")}
                  placeholder={label(labels, "activity.create.chooseContacts")}
                  emptyLabel={label(labels, "activity.create.noContacts")}
                />
                <FieldDescription>
                  {precision === "contact_to_learn"
                    ? label(labels, "activity.create.contactRequired")
                    : label(labels, "activity.create.contactsHint")}
                </FieldDescription>
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <FileImage aria-hidden />
                {label(labels, "activity.create.image")}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Field>
                <FieldLabel htmlFor="activity-cover-alt">
                  {label(labels, "activity.create.image.alt")}
                </FieldLabel>
                <Input
                  id="activity-cover-alt"
                  value={coverAlt}
                  onChange={(event) => {
                    setCoverAlt(event.target.value);
                  }}
                  maxLength={500}
                />
                <FieldDescription>
                  {label(labels, "activity.create.image.altHint")}
                </FieldDescription>
              </Field>
              <label className="flex items-start gap-3 text-sm">
                <Checkbox
                  checked={rightsConfirmed}
                  onCheckedChange={setRightsConfirmed}
                  className="mt-0.5"
                />
                <span>{label(labels, "activity.create.image.rights")}</span>
              </label>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                className="sr-only"
                disabled={
                  !coverAlt.trim() ||
                  !rightsConfirmed ||
                  imageState === "uploading"
                }
                onChange={(event) => void uploadCover(event.target.files?.[0])}
              />
              <Attachment state={imageState} className="w-full">
                <AttachmentMedia>
                  {imageState === "uploading" ? (
                    <LoaderCircle className="animate-spin" aria-hidden />
                  ) : (
                    <FileImage aria-hidden />
                  )}
                </AttachmentMedia>
                <AttachmentContent>
                  <AttachmentTitle>
                    {coverFileName ||
                      label(labels, "activity.create.image.select")}
                  </AttachmentTitle>
                  <AttachmentDescription
                    role={imageState === "error" ? "alert" : undefined}
                  >
                    {attachmentDescription}
                  </AttachmentDescription>
                </AttachmentContent>
                {coverFileName && imageState !== "uploading" ? (
                  <AttachmentActions>
                    <AttachmentAction
                      type="button"
                      aria-label={label(labels, "activity.create.image.remove")}
                      onClick={clearCover}
                    >
                      <X aria-hidden />
                    </AttachmentAction>
                  </AttachmentActions>
                ) : null}
                <AttachmentTrigger
                  aria-label={label(
                    labels,
                    coverFileName
                      ? "activity.create.image.replace"
                      : "activity.create.image.select",
                  )}
                  disabled={
                    !coverAlt.trim() ||
                    !rightsConfirmed ||
                    imageState === "uploading"
                  }
                  onClick={() => coverInputRef.current?.click()}
                />
              </Attachment>
              {previewSrc ? (
                <CoverImagePreview
                  src={previewSrc}
                  alt={coverAlt || coverFileName}
                />
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle>{label(labels, "activity.create.source")}</CardTitle>
            </CardHeader>
            <CardContent>
              <Field>
                <FieldLabel htmlFor="activity-source-note">
                  {label(labels, "activity.create.sourceNote")}
                </FieldLabel>
                <Textarea
                  id="activity-source-note"
                  name="sourceNote"
                  rows={3}
                />
              </Field>
            </CardContent>
            <CardContent className="border-t pt-5">
              <PublicationChoice
                locale={locale}
                labels={{
                  heading: label(labels, "publication.heading"),
                  hint: label(labels, "publication.hint"),
                  draft: label(labels, "publication.draft"),
                  now: label(labels, "publication.now"),
                  scheduled: label(labels, "publication.scheduled"),
                  date: label(labels, "publication.dateOnly"),
                  time: label(labels, "publication.time"),
                  selectDate: label(labels, "publication.selectDate"),
                  clearDate: label(labels, "publication.clearDate"),
                  dateHint: label(labels, "publication.dateHint"),
                }}
              />
            </CardContent>
            <CardFooter className="justify-end gap-2">
              <Button
                nativeButton={false}
                render={<Link href={activitiesPath} />}
                variant="outline"
              >
                {label(labels, "activity.create.cancel")}
              </Button>
              <PendingButton>
                <Plus aria-hidden />
                {label(labels, "activity.create.action")}
              </PendingButton>
            </CardFooter>
          </Card>
        </div>
      </div>
    </form>
  );
}
