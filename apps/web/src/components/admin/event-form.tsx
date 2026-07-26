"use client";

import { Globe2, Lock, Network } from "lucide-react";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { Fragment, useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  createCoordinationEvent,
  updateCoordinationEvent,
} from "~/app/[locale]/dashboard/events/actions";
import { StewardContactCard } from "~/components/admin/steward-contact";
import {
  Card,
  Field,
  Select,
  TextArea,
  TextInput,
} from "~/components/admin/workspace";
import { PendingButton } from "~/components/pending-button";
import { TimePicker } from "~/components/shadcn-studio/date-picker/date-picker-09";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { DatePicker } from "~/components/ui/date-picker";
import {
  Field as ShadcnField,
  FieldDescription,
  FieldLabel,
} from "~/components/ui/field";
import {
  EVENT_VISIBILITIES,
  type EventVisibilityValue as EventVisibility,
} from "~/components/events/visibility";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { eventLanguages, type EventLanguage } from "~/lib/event-languages";
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

const languageOrder: readonly EventLanguage[] = eventLanguages;

/** The form field suffix each language's text is submitted under. */
const fieldSuffix: Record<EventLanguage, string> = {
  fr: "Fr",
  en: "En",
  ar: "Ar",
};

/** Only Arabic is written right to left among the authoring languages. */
function dirOf(language: EventLanguage) {
  return language === "ar" ? "rtl" : "ltr";
}

function label(labels: Record<string, string>, key: string) {
  return labels[key] ?? key;
}

type FormState = { result: "idle" | "error"; revision: number };
const initialState: FormState = { result: "idle", revision: 0 };

function submitter(action: (formData: FormData) => Promise<void>) {
  return async (
    previous: FormState,
    formData: FormData,
  ): Promise<FormState> => {
    try {
      await action(formData);
      return { result: "idle", revision: previous.revision + 1 };
    } catch (error) {
      // A successful create reports itself by redirecting.
      unstable_rethrow(error);
      return { result: "error", revision: previous.revision + 1 };
    }
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
  value,
  onChange,
  labels,
}: {
  value: EventVisibility;
  onChange: (next: EventVisibility) => void;
  labels: Record<string, string>;
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-medium">
        {label(labels, "events.visibility")}
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
              name="visibility"
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
                {label(labels, `events.visibility.${tier}`)}
              </span>
              <span className="text-copy-muted text-xs leading-relaxed">
                {label(labels, `events.visibility.${tier}.hint`)}
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
          {label(labels, "events.visibility.publicWarning")}
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
  labels: Record<string, string>;
  /** The shared console catalogue, for wording every content type shares. */
  consoleLabels: Record<string, string>;
  cancelHref: string;
}) {
  const action = useMemo(
    () =>
      submitter(
        mode === "create" ? createCoordinationEvent : updateCoordinationEvent,
      ),
    [mode],
  );
  const [state, formAction] = useActionState(action, initialState);
  const [visibility, setVisibility] = useState<EventVisibility>(
    values.visibility,
  );
  const [cityId, setCityId] = useState(values.cityId);
  const [allDay, setAllDay] = useState(values.allDay);
  const [sourceLanguage, setSourceLanguage] = useState<EventLanguage>(
    values.sourceLanguageCode,
  );
  const [activeLanguage, setActiveLanguage] = useState<string>(
    values.sourceLanguageCode,
  );
  // The language tabs unmount the panels they hide, so the text lives in state
  // and travels to the server through the hidden inputs below.
  const [text, setText] = useState(values.text);

  useEffect(() => {
    if (state.revision === 0) return;
    if (state.result === "error") {
      toast.error(label(labels, "events.saveError"));
      return;
    }
    toast.success(label(labels, "events.saved"));
  }, [state, labels]);

  const placeOptions = useMemo(
    () => places.filter((place) => !place.cityId || place.cityId === cityId),
    [cityId, places],
  );
  const sourceTitleMissing = text[sourceLanguage].title.trim() === "";

  const setField = (
    language: EventLanguage,
    field: keyof EventFormText,
    next: string,
  ) => {
    setText((previous) => ({
      ...previous,
      [language]: { ...previous[language], [field]: next },
    }));
  };

  return (
    <form action={formAction} className="grid gap-5">
      <input type="hidden" name="locale" value={locale} />
      {eventId ? <input type="hidden" name="eventId" value={eventId} /> : null}
      <input type="hidden" name="allDay" value={allDay ? "true" : "false"} />
      {languageOrder.map((language) => (
        <Fragment key={`${language}-values`}>
          <input
            type="hidden"
            name={`title${fieldSuffix[language]}`}
            value={text[language].title}
          />
          <input
            type="hidden"
            name={`description${fieldSuffix[language]}`}
            value={text[language].description}
          />
        </Fragment>
      ))}

      <Card
        title={label(labels, "events.section.what")}
        hint={label(labels, "events.section.whatHint")}
      >
        <div className="grid gap-4">
          <Field
            label={label(labels, "events.sourceLanguage")}
            hint={label(labels, "events.sourceLanguageHint")}
          >
            <Select
              name="sourceLanguageCode"
              value={sourceLanguage}
              onValueChange={(next) => {
                setSourceLanguage(next as EventLanguage);
                setActiveLanguage(next);
              }}
            >
              {languageOrder.map((language) => (
                <option key={language} value={language}>
                  {label(labels, `events.language.${language}`)}
                </option>
              ))}
            </Select>
          </Field>

          {/* One tab per language, so the required source text and its
           * translations never compete for the same screen space. */}
          <Tabs
            value={activeLanguage}
            onValueChange={(next) => {
              setActiveLanguage(String(next));
            }}
          >
            <TabsList variant="line" className="justify-start">
              {languageOrder.map((language) => (
                <TabsTrigger key={language} value={language}>
                  {label(labels, `events.language.${language}`)}
                  {language === sourceLanguage ? " ★" : ""}
                </TabsTrigger>
              ))}
            </TabsList>
            {languageOrder.map((language) => (
              <TabsContent
                key={language}
                value={language}
                className="grid gap-4 pt-2"
              >
                <ShadcnField className="gap-1">
                  <FieldLabel htmlFor={`event-title-${language}`}>
                    {label(labels, "events.eventTitle")}
                  </FieldLabel>
                  <TextInput
                    id={`event-title-${language}`}
                    dir={dirOf(language)}
                    value={text[language].title}
                    maxLength={180}
                    onChange={(changed) => {
                      setField(language, "title", changed.target.value);
                    }}
                  />
                  <FieldDescription className="text-copy-muted text-xs">
                    {label(
                      labels,
                      language === sourceLanguage
                        ? "events.titleRequired"
                        : "events.titleOptional",
                    )}
                  </FieldDescription>
                </ShadcnField>
                <ShadcnField className="gap-1">
                  <FieldLabel htmlFor={`event-description-${language}`}>
                    {label(labels, "events.description")}
                  </FieldLabel>
                  <TextArea
                    id={`event-description-${language}`}
                    dir={dirOf(language)}
                    value={text[language].description}
                    rows={4}
                    onChange={(changed) => {
                      setField(language, "description", changed.target.value);
                    }}
                  />
                  <FieldDescription className="text-copy-muted text-xs">
                    {label(labels, "events.descriptionHint")}
                  </FieldDescription>
                </ShadcnField>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </Card>

      <Card
        title={label(labels, "events.section.when")}
        hint={label(labels, "events.section.whenHint")}
      >
        <div className="grid gap-4">
          <ShadcnField orientation="horizontal" className="items-start gap-2.5">
            <Checkbox
              id="event-all-day"
              checked={allDay}
              onCheckedChange={setAllDay}
              className="mt-0.5"
            />
            <div className="grid gap-0.5">
              <FieldLabel htmlFor="event-all-day" className="leading-normal">
                {label(labels, "events.allDay")}
              </FieldLabel>
              <FieldDescription className="text-copy-muted text-xs">
                {label(labels, "events.allDayHint")}
              </FieldDescription>
            </div>
          </ShadcnField>

          <div className="grid gap-4 sm:grid-cols-2">
            <ShadcnField className="gap-1">
              <FieldLabel htmlFor="event-start-date">
                {label(labels, "events.startDate")}
              </FieldLabel>
              <DatePicker
                id="event-start-date"
                name="startDate"
                locale={locale}
                defaultValue={values.startDate}
                placeholder={label(labels, "events.selectDate")}
                clearLabel={label(labels, "events.clearDate")}
                required
              />
            </ShadcnField>
            {allDay ? null : (
              <Field label={label(labels, "events.startTime")}>
                <TimePicker
                  name="startTime"
                  defaultValue={values.startTime}
                  required
                />
              </Field>
            )}
            <ShadcnField className="gap-1">
              <FieldLabel htmlFor="event-end-date">
                {label(labels, "events.endDate")}
              </FieldLabel>
              <DatePicker
                id="event-end-date"
                name="endDate"
                locale={locale}
                defaultValue={values.endDate}
                placeholder={label(labels, "events.sameDay")}
                clearLabel={label(labels, "events.clearDate")}
              />
              <FieldDescription className="text-copy-muted text-xs">
                {label(labels, "events.endDateHint")}
              </FieldDescription>
            </ShadcnField>
            {allDay ? null : (
              <Field label={label(labels, "events.endTime")}>
                <TimePicker
                  name="endTime"
                  defaultValue={values.endTime}
                  required
                />
              </Field>
            )}
          </div>
        </div>
      </Card>

      <Card
        title={label(labels, "events.section.where")}
        hint={label(labels, "events.section.whereHint")}
      >
        <div className="grid gap-4">
          <Field label={label(labels, "events.city")}>
            <Select
              name="cityId"
              value={cityId}
              onValueChange={setCityId}
              required
            >
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label={label(labels, "events.place")}
            hint={label(labels, "events.placeHint")}
          >
            <Select name="placeId" defaultValue={values.placeId}>
              <option value="">{label(labels, "events.noPlace")}</option>
              {placeOptions.map((place) => (
                <option key={place.id} value={place.id}>
                  {place.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label={label(labels, "events.locationLabel")}
            hint={label(labels, "events.locationLabelHint")}
          >
            <TextInput
              name="locationLabel"
              defaultValue={values.locationLabel}
              maxLength={200}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={label(labels, "events.contactLabel")}
              hint={label(labels, "events.contactLabelHint")}
            >
              <TextInput
                name="contactLabel"
                defaultValue={values.contactLabel}
                maxLength={120}
              />
            </Field>
            <Field
              label={label(labels, "events.contactValue")}
              hint={label(labels, "events.contactHint")}
            >
              <TextInput
                name="contactValue"
                defaultValue={values.contactValue}
                maxLength={200}
              />
            </Field>
          </div>
        </div>
      </Card>

      <Card
        title={label(labels, "events.section.who")}
        hint={label(labels, "events.section.whoHint")}
      >
        <div className="grid gap-4">
          <Field
            label={label(labels, "events.host")}
            hint={label(labels, "events.hostHint")}
          >
            <Select
              name="hostOrganizationId"
              defaultValue={values.hostOrganizationId}
            >
              {canHostAsPlatform ? (
                <option value="">{label(labels, "events.hostPlatform")}</option>
              ) : null}
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </Select>
          </Field>
          <VisibilityChoice
            value={visibility}
            onChange={setVisibility}
            labels={labels}
          />
        </div>
      </Card>

      <StewardContactCard values={values.steward} labels={consoleLabels} />

      <div className="flex flex-wrap items-center gap-3">
        <PendingButton disabled={sourceTitleMissing}>
          {label(
            labels,
            mode === "create" ? "events.create" : "events.saveChanges",
          )}
        </PendingButton>
        <Button
          nativeButton={false}
          render={<Link href={cancelHref} />}
          variant="ghost"
        >
          {label(labels, "events.cancelEdit")}
        </Button>
        {sourceTitleMissing ? (
          <p className="text-copy-muted text-xs">
            {label(labels, "events.titleMissing")}
          </p>
        ) : null}
      </div>
    </form>
  );
}
