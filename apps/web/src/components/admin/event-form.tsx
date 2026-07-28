"use client";

import { Globe2, Lock, Network } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import {
  createCoordinationEvent,
  updateCoordinationEvent,
} from "~/app/[locale]/dashboard/events/actions";
import {
  CheckboxFormField,
  DateFormField,
  FormField,
  FormSubmitButton,
  SelectFormField,
  TextAreaFormField,
  TextFormField,
  TimeFormField,
} from "~/components/admin/form-field";
import { StewardContactCard } from "~/components/admin/steward-contact";
import { Card, Select } from "~/components/admin/workspace";
import {
  EVENT_VISIBILITIES,
  type EventVisibilityValue as EventVisibility,
} from "~/components/events/visibility";
import { Button } from "~/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  useFormMessages,
  useServerFormAction,
  useWorkspaceForm,
} from "~/hooks/use-workspace-form";
import { editorialTextDirection } from "~/lib/editorial-languages";
import { eventLanguages, type EventLanguage } from "~/lib/event-languages";
import { readLabel, type FormMessages, type Labels } from "~/lib/form-messages";
import { timeOfDayPattern } from "~/lib/schedule-rules";
import { type StewardContactValues } from "~/lib/steward-contact";
import { cn } from "~/lib/utils";

export type { EventVisibilityValue as EventVisibility } from "~/components/events/visibility";

export interface EventFormOption {
  id: string;
  name: string;
  /** Places are offered for the selected city only. */
  cityId?: string;
}

export interface EventFormText {
  title: string;
  description: string;
}

export interface EventFormValues {
  hostOrganizationId: string;
  cityId: string;
  visibility: EventVisibility;
  placeId: string;
  locationLabel: string;
  contactLabel: string;
  contactValue: string;
  allDay: boolean;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  sourceLanguageCode: EventLanguage;
  text: Record<EventLanguage, EventFormText>;
  /** Who to ask about this event — workspace only, never published. */
  steward: StewardContactValues;
}

/** The field each language's text is authored in, per `FormData` key. */
const titleFields = {
  fr: "titleFr",
  en: "titleEn",
  ar: "titleAr",
} as const satisfies Record<EventLanguage, string>;

const descriptionFields = {
  fr: "descriptionFr",
  en: "descriptionEn",
  ar: "descriptionAr",
} as const satisfies Record<EventLanguage, string>;

/**
 * The event as this form holds it: one field per `FormData` key the action
 * reads, so the values the editor sees and the post the server parses cannot
 * describe different events.
 *
 * The rules mirror `parseEventFields` — a source-language title, a city, a start
 * day, and a window that does not end before it begins — because a rule the
 * server enforces is a rule the editor deserves to be told about before saving.
 */
function eventFormSchema(messages: FormMessages, titleMissing: string) {
  const optional = z.string();
  return z
    .object({
      sourceLanguageCode: z.enum(eventLanguages),
      titleFr: optional,
      titleEn: optional,
      titleAr: optional,
      descriptionFr: optional,
      descriptionEn: optional,
      descriptionAr: optional,
      allDay: z.boolean(),
      startDate: z.string().min(1, messages.required),
      startTime: optional,
      endDate: optional,
      endTime: optional,
      cityId: z.string().uuid(messages.required),
      placeId: optional,
      locationLabel: optional,
      contactLabel: optional,
      contactValue: optional,
      hostOrganizationId: optional,
      visibility: z.enum(EVENT_VISIBILITIES),
    })
    .superRefine((values, context) => {
      const sourceTitle = titleFields[values.sourceLanguageCode];
      if (values[sourceTitle].trim() === "") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [sourceTitle],
          message: titleMissing,
        });
      }

      // An all-day event is stored as midnight to 23:59, so its times are the
      // server's to decide and this form never asks for them.
      const timed = !values.allDay;
      let timesValid = true;
      if (timed) {
        for (const field of ["startTime", "endTime"] as const) {
          if (timeOfDayPattern.test(values[field])) continue;
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [field],
            message: messages.invalidTime,
          });
          timesValid = false;
        }
      }
      if (!timesValid) return;

      // An empty end day means "same day", the default the action applies.
      const endDate = values.endDate === "" ? values.startDate : values.endDate;
      if (endDate < values.startDate) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["endDate"],
          message: messages.endBeforeStart,
        });
        return;
      }
      if (
        endDate === values.startDate &&
        timed &&
        values.endTime < values.startTime
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["endTime"],
          message: messages.endBeforeStart,
        });
      }
    });
}

type EventFieldValues = z.infer<ReturnType<typeof eventFormSchema>>;

/** The page's values, flattened into the fields the form and the post share. */
function eventDefaults(values: EventFormValues): EventFieldValues {
  const { fr, en, ar } = values.text;
  return {
    sourceLanguageCode: values.sourceLanguageCode,
    titleFr: fr.title,
    titleEn: en.title,
    titleAr: ar.title,
    descriptionFr: fr.description,
    descriptionEn: en.description,
    descriptionAr: ar.description,
    allDay: values.allDay,
    startDate: values.startDate,
    startTime: values.startTime,
    endDate: values.endDate,
    endTime: values.endTime,
    cityId: values.cityId,
    placeId: values.placeId,
    locationLabel: values.locationLabel,
    contactLabel: values.contactLabel,
    contactValue: values.contactValue,
    hostOrganizationId: values.hostOrganizationId,
    visibility: values.visibility,
  };
}

const visibilityIcon = {
  organization: Lock,
  inter_organization: Network,
  public: Globe2,
} as const;

/**
 * The three tiers, always in widening order, each with the sentence that says
 * who ends up reading the event. Reach is the one decision on this form whose
 * consequence cannot be guessed from the field name, so it is spelled out
 * rather than hidden behind a dropdown value.
 */
function VisibilityChoice({
  name,
  value,
  onChange,
  labels,
}: {
  name: string;
  value: EventVisibility;
  onChange: (next: EventVisibility) => void;
  labels: Labels;
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-medium">
        {readLabel(labels, "events.visibility")}
      </legend>
      {EVENT_VISIBILITIES.map((tier) => {
        const Glyph = visibilityIcon[tier];
        const selected = value === tier;
        return (
          <label
            key={tier}
            className={cn(
              "rounded-card focus-within:ring-brand/50 flex cursor-pointer items-start gap-3 border p-3 transition-colors focus-within:ring-2",
              selected
                ? "border-brand bg-brand-soft"
                : "border-line hover:bg-subtle",
            )}
          >
            <input
              type="radio"
              name={name}
              value={tier}
              checked={selected}
              onChange={() => {
                onChange(tier);
              }}
              className="sr-only"
            />
            <Glyph
              className={cn(
                "mt-0.5 size-4 shrink-0",
                selected ? "text-brand" : "text-copy-muted",
              )}
              aria-hidden
            />
            <span className="grid gap-0.5">
              <span className="text-sm font-semibold">
                {readLabel(labels, `events.visibility.${tier}`)}
              </span>
              <span className="text-copy-muted text-xs leading-relaxed">
                {readLabel(labels, `events.visibility.${tier}.hint`)}
              </span>
            </span>
          </label>
        );
      })}
      {value === "public" ? (
        <p
          role="status"
          className="border-warn/40 bg-warn-soft text-ink rounded-card border p-3 text-xs font-medium"
        >
          {readLabel(labels, "events.visibility.publicWarning")}
        </p>
      ) : null}
    </fieldset>
  );
}

/**
 * One form for creating and editing a coordination event. Both modes ask the
 * same four questions in the same order — what it is, when, where, and who may
 * see it — so an editor who has created one event already knows where to look
 * to change another.
 */
export function EventForm({
  mode,
  locale,
  eventId,
  values,
  organizations,
  cities,
  places,
  canHostAsPlatform,
  labels,
  consoleLabels,
  cancelHref,
}: {
  mode: "create" | "edit";
  locale: "fr" | "en" | "ar";
  eventId?: string;
  values: EventFormValues;
  organizations: readonly EventFormOption[];
  cities: readonly EventFormOption[];
  places: readonly EventFormOption[];
  /** Platform stewards may host an event as the platform itself. */
  canHostAsPlatform: boolean;
  labels: Labels;
  /** The shared console catalogue, for wording every content type shares. */
  consoleLabels: Labels;
  cancelHref: string;
}) {
  const copy = (key: string) => readLabel(labels, key);
  const messages = useFormMessages(labels);
  const schema = useMemo(
    () => eventFormSchema(messages, readLabel(labels, "events.titleMissing")),
    [labels, messages],
  );
  const form = useWorkspaceForm({
    schema,
    defaultValues: eventDefaults(values),
  });
  const { formProps } = useServerFormAction({
    form,
    action:
      mode === "create" ? createCoordinationEvent : updateCoordinationEvent,
    errorMessage: copy("events.saveError"),
    // The form is four cards tall, so the field holding the submit back is
    // often off screen.
    invalidMessage: messages.reviewFields,
    onSuccess: () => {
      toast.success(copy("events.saved"));
    },
  });

  // Which language is on screen is not part of the event, so it stays here
  // rather than in the form: every language posts either way.
  const [activeLanguage, setActiveLanguage] = useState<string>(
    values.sourceLanguageCode,
  );
  const sourceLanguage = form.watch("sourceLanguageCode");
  const allDay = form.watch("allDay");
  const cityId = form.watch("cityId");

  const placeOptions = useMemo(
    () => places.filter((place) => !place.cityId || place.cityId === cityId),
    [cityId, places],
  );
  useEffect(() => {
    // A place belongs to one city, so changing the city drops a choice the new
    // city does not offer instead of posting a place from the old one.
    const placeId = form.getValues("placeId");
    if (placeId === "") return;
    if (placeOptions.some((place) => place.id === placeId)) return;
    form.setValue("placeId", "", { shouldDirty: true });
  }, [form, placeOptions]);

  const sourceTitleMissing =
    form.watch(titleFields[sourceLanguage]).trim() === "";

  return (
    <form {...formProps} className="grid gap-5">
      <input type="hidden" name="locale" value={locale} />
      {eventId ? <input type="hidden" name="eventId" value={eventId} /> : null}

      <Card
        title={copy("events.section.what")}
        hint={copy("events.section.whatHint")}
      >
        <div className="grid gap-4">
          <FormField
            control={form.control}
            name="sourceLanguageCode"
            label={copy("events.sourceLanguage")}
            description={copy("events.sourceLanguageHint")}
          >
            {({ field, id, describedBy }) => (
              <Select
                id={id}
                name={field.name}
                value={field.value}
                onValueChange={(next) => {
                  field.onChange(next);
                  // The source text is the one that must be filled in, so the
                  // tab follows the choice instead of waiting to be found.
                  setActiveLanguage(next);
                }}
                aria-describedby={describedBy}
              >
                {eventLanguages.map((language) => (
                  <option key={language} value={language}>
                    {copy(`events.language.${language}`)}
                  </option>
                ))}
              </Select>
            )}
          </FormField>

          {/* One tab per language, so the required source text and its
           * translations never compete for the same screen space. */}
          <Tabs
            value={activeLanguage}
            onValueChange={(next) => {
              setActiveLanguage(String(next));
            }}
          >
            <TabsList variant="line" className="justify-start">
              {eventLanguages.map((language) => (
                <TabsTrigger key={language} value={language}>
                  {copy(`events.language.${language}`)}
                  {language === sourceLanguage ? " ★" : ""}
                </TabsTrigger>
              ))}
            </TabsList>
            {eventLanguages.map((language) => (
              <TabsContent
                key={language}
                value={language}
                // Kept in the DOM while another tab is showing: the fields are
                // the post, so a translation the editor is not looking at
                // still travels with the event.
                keepMounted
                className="grid gap-4 pt-2"
              >
                <TextFormField
                  control={form.control}
                  name={titleFields[language]}
                  label={copy("events.eventTitle")}
                  description={copy(
                    language === sourceLanguage
                      ? "events.titleRequired"
                      : "events.titleOptional",
                  )}
                  dir={editorialTextDirection(language)}
                  maxLength={180}
                />
                <TextAreaFormField
                  control={form.control}
                  name={descriptionFields[language]}
                  label={copy("events.description")}
                  description={copy("events.descriptionHint")}
                  dir={editorialTextDirection(language)}
                  rows={4}
                />
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </Card>

      <Card
        title={copy("events.section.when")}
        hint={copy("events.section.whenHint")}
      >
        <div className="grid gap-4">
          <CheckboxFormField
            control={form.control}
            name="allDay"
            label={copy("events.allDay")}
            description={copy("events.allDayHint")}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <DateFormField
              control={form.control}
              name="startDate"
              label={copy("events.startDate")}
              locale={locale}
              placeholder={copy("events.selectDate")}
              clearLabel={copy("events.clearDate")}
              required
            />
            {allDay ? null : (
              <TimeFormField
                control={form.control}
                name="startTime"
                label={copy("events.startTime")}
                required
              />
            )}
            <DateFormField
              control={form.control}
              name="endDate"
              label={copy("events.endDate")}
              description={copy("events.endDateHint")}
              locale={locale}
              placeholder={copy("events.sameDay")}
              clearLabel={copy("events.clearDate")}
            />
            {allDay ? null : (
              <TimeFormField
                control={form.control}
                name="endTime"
                label={copy("events.endTime")}
                required
              />
            )}
          </div>
        </div>
      </Card>

      <Card
        title={copy("events.section.where")}
        hint={copy("events.section.whereHint")}
      >
        <div className="grid gap-4">
          <SelectFormField
            control={form.control}
            name="cityId"
            label={copy("events.city")}
            required
          >
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </SelectFormField>
          <SelectFormField
            control={form.control}
            name="placeId"
            label={copy("events.place")}
            description={copy("events.placeHint")}
          >
            <option value="">{copy("events.noPlace")}</option>
            {placeOptions.map((place) => (
              <option key={place.id} value={place.id}>
                {place.name}
              </option>
            ))}
          </SelectFormField>
          <TextFormField
            control={form.control}
            name="locationLabel"
            label={copy("events.locationLabel")}
            description={copy("events.locationLabelHint")}
            maxLength={200}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextFormField
              control={form.control}
              name="contactLabel"
              label={copy("events.contactLabel")}
              description={copy("events.contactLabelHint")}
              maxLength={120}
            />
            <TextFormField
              control={form.control}
              name="contactValue"
              label={copy("events.contactValue")}
              description={copy("events.contactHint")}
              maxLength={200}
            />
          </div>
        </div>
      </Card>

      <Card
        title={copy("events.section.who")}
        hint={copy("events.section.whoHint")}
      >
        <div className="grid gap-4">
          <SelectFormField
            control={form.control}
            name="hostOrganizationId"
            label={copy("events.host")}
            description={copy("events.hostHint")}
          >
            {canHostAsPlatform ? (
              <option value="">{copy("events.hostPlatform")}</option>
            ) : null}
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name}
              </option>
            ))}
          </SelectFormField>
          <FormField control={form.control} name="visibility">
            {({ field }) => (
              <VisibilityChoice
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                labels={labels}
              />
            )}
          </FormField>
        </div>
      </Card>

      <StewardContactCard values={values.steward} labels={consoleLabels} />

      <div className="flex flex-wrap items-center gap-3">
        <FormSubmitButton control={form.control} disabled={sourceTitleMissing}>
          {copy(mode === "create" ? "events.create" : "events.saveChanges")}
        </FormSubmitButton>
        <Button
          nativeButton={false}
          render={<Link href={cancelHref} />}
          variant="ghost"
        >
          {copy("events.cancelEdit")}
        </Button>
        {sourceTitleMissing ? (
          <p className="text-copy-muted text-xs">
            {copy("events.titleMissing")}
          </p>
        ) : null}
      </div>
    </form>
  );
}
