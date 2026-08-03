"use client";

import { Globe2, Lock, MapPinPlus, Network } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useWatch, type Control } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import {
  createCoordinationEvent,
  updateCoordinationEvent,
} from "~/app/[locale]/dashboard/events/actions";
import { PlaceAddressFields } from "~/components/address/place-address-fields";
import {
  EventMediaManager,
  type EventMediaLabels,
} from "~/components/admin/event-media-manager";
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
import {
  EventPublicPreview,
  type EventPreviewFrameLabels,
} from "~/components/admin/event-public-preview";
import {
  LanguageAccordion,
  LanguageAccordionItem,
} from "~/components/admin/language-accordion";
import { StewardContactCard } from "~/components/admin/steward-contact-picker";
import { TransitLinkFields } from "~/components/admin/transit-links";
import { Card, Select } from "~/components/admin/workspace";
import type {
  PublicEventCard,
  PublicEventListLabels,
} from "~/components/public/public-event-list";
import {
  EVENT_VISIBILITIES,
  type EventVisibilityValue as EventVisibility,
} from "~/components/events/visibility";
import { Button } from "~/components/ui/button";
import {
  useFormMessages,
  useServerFormAction,
  useWorkspaceForm,
} from "~/hooks/use-workspace-form";
import { editorialTextDirection } from "~/lib/editorial-languages";
import { eventLanguages, type EventLanguage } from "~/lib/event-languages";
import { eventMapHref } from "~/lib/event-links";
import { FALLBACK_TIME_ZONE, formatEventWindow } from "~/lib/event-window";
import { readLabel, type FormMessages, type Labels } from "~/lib/form-messages";
import { timeOfDayPattern } from "~/lib/schedule-rules";
import {
  type StewardCandidate,
  type StewardContactValues,
} from "~/lib/steward-contact";
import { type TransitLink } from "~/lib/transit-links";
import { cn } from "~/lib/utils";
import { zonedWallTimeToInstant } from "~/lib/zoned-time";

export type { EventVisibilityValue as EventVisibility } from "~/components/events/visibility";

export interface EventFormOption {
  id: string;
  name: string;
  /** Places are offered for the selected city only. */
  cityId?: string;
}

/** A city, with the clock its events are written and read in. */
export interface EventFormCity extends EventFormOption {
  timezone: string;
}

/**
 * A place, with what a map link needs to know about it — the preview beside
 * the form has to answer "can this be pinned" the same way the public page
 * will (RISKS.md R5).
 */
export interface EventFormPlace extends EventFormOption {
  cityId: string;
  addressLine: string | null;
  lat: number | null;
  lng: number | null;
  precision: "exact" | "area_only" | "contact_to_learn";
}

export interface EventFormText {
  title: string;
  description: string;
}

export interface EventFormValues {
  hostOrganizationId: string;
  /** Empty for an event that happens online and in no city. */
  cityId: string;
  /** Joinable from anywhere — then the city, the place and the way in go away. */
  isOnline: boolean;
  onlineUrl: string;
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
  /**
   * How to get there on public transport. Held outside the validated fields
   * because the rows are their own component's business — they post themselves,
   * and the server re-reads them from the post either way.
   */
  transit: TransitLink[];
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
 * The `placeId` value that means "none of these — I am writing the address in".
 * It never reaches the server: the dropdown that would post it is replaced by
 * the new-address fields, so what arrives is an empty `placeId` and a name.
 */
const NEW_PLACE = "new";

/** A field left blank is not an answer, and the card must not print one. */
function emptyToNull(value: string | undefined) {
  const written = value?.trim() ?? "";
  return written === "" ? null : written;
}

/** The city is chosen from a list, so "not a uuid" means "not chosen". */
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The event as this form holds it: one field per `FormData` key the action
 * reads, so the values the editor sees and the post the server parses cannot
 * describe different events.
 *
 * The rules mirror `parseEventFields` — a source-language title, somewhere to
 * be (a city, or online), a start day, and a window that does not end before it
 * begins — because a rule the server enforces is a rule the editor deserves to
 * be told about before saving.
 */
function eventFormSchema(
  messages: FormMessages,
  titleMissing: string,
  invalidLink: string,
) {
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
      isOnline: z.boolean(),
      onlineUrl: optional,
      cityId: optional,
      placeId: optional,
      newPlaceName: optional,
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

      // An event happens somewhere: in a city, or online. Only the second one
      // can go without a city, which is the whole point of saying so.
      if (!values.isOnline && !uuidPattern.test(values.cityId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["cityId"],
          message: messages.required,
        });
      }
      if (values.isOnline && values.onlineUrl.trim() !== "") {
        // A link people cannot click is worse than the promise of one to come.
        const link = values.onlineUrl.trim();
        if (!/^https?:\/\/\S+$/i.test(link)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["onlineUrl"],
            message: invalidLink,
          });
        }
      }

      // A new address is saved as a place of its own, and a place with no name
      // is a row nobody can pick from the list next time.
      if (values.placeId === NEW_PLACE && values.newPlaceName.trim() === "") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["newPlaceName"],
          message: messages.required,
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
    isOnline: values.isOnline,
    onlineUrl: values.onlineUrl,
    cityId: values.cityId,
    placeId: values.placeId,
    // Always blank to start with: an address is written in only by asking for
    // it, never carried over from a saved event.
    newPlaceName: "",
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
 * The media panel's wording, read from the same catalogue as the rest of the
 * form. The event page builds the same object; both read `events.media.*`, so
 * the panel says the same thing whether the event exists yet or not.
 */
function mediaLabels(copy: (key: string) => string): EventMediaLabels {
  return {
    coverHeading: copy("events.media.coverHeading"),
    coverHint: copy("events.media.coverHint"),
    coverAttached: copy("events.media.coverAttached"),
    altLabel: copy("events.media.altLabel"),
    altHint: copy("events.media.altHint"),
    rights: copy("events.media.rights"),
    select: copy("events.media.select"),
    replace: copy("events.media.replace"),
    remove: copy("events.media.remove"),
    uploading: copy("events.media.uploading"),
    uploadError: copy("events.media.uploadError"),
    coverSaved: copy("events.media.coverSaved"),
    coverRemoved: copy("events.media.coverRemoved"),
    flyersHeading: copy("events.media.flyersHeading"),
    flyersHint: copy("events.media.flyersHint"),
    flyersEmpty: copy("events.media.flyersEmpty"),
    flyerTitle: copy("events.media.flyerTitle"),
    flyerTitleHint: copy("events.media.flyerTitleHint"),
    addFlyer: copy("events.media.addFlyer"),
    flyerAdded: copy("events.media.flyerAdded"),
    flyerRemoved: copy("events.media.flyerRemoved"),
    removeError: copy("events.media.removeError"),
    constraints: copy("events.media.constraints"),
    pendingScan: copy("events.media.pendingScan"),
    download: copy("events.media.download"),
  };
}

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
 * The event as a reader will meet it, built from what the form holds right now.
 *
 * It subscribes to the values on its own — `useWatch` here rather than
 * `form.watch` in the editor — so a keystroke in the title re-renders this
 * panel and nothing else.
 *
 * Every string it needs is decided the way the server decides it: the same
 * window formatter, the same map-link rules, the same language fallback a
 * reader gets when their language was never authored. What it cannot know is
 * the event's id, so the links are dead and the panel is inert.
 */
function EventFormPreview({
  control,
  locale,
  cities,
  places,
  organizations,
  platformName,
  coverPreview,
  labels,
  frame,
  listLabels,
}: {
  control: Control<EventFieldValues>;
  locale: "fr" | "en" | "ar";
  cities: readonly EventFormCity[];
  places: readonly EventFormPlace[];
  organizations: readonly EventFormOption[];
  /** What the card calls an event the platform hosts itself. */
  platformName: string;
  coverPreview: string | null;
  labels: Labels;
  frame: EventPreviewFrameLabels;
  listLabels: PublicEventListLabels;
}) {
  const values = useWatch({ control });
  const copy = (key: string) => readLabel(labels, key);
  const language = values.sourceLanguageCode ?? "fr";
  const city = cities.find((candidate) => candidate.id === values.cityId);
  const place = places.find((candidate) => candidate.id === values.placeId);
  const host = organizations.find(
    (candidate) => candidate.id === values.hostOrganizationId,
  );
  const isOnline = values.isOnline === true;

  /**
   * The text a reader gets: the language they asked for, then the one the event
   * was written in — the same fallback `resolveText` applies on the server.
   */
  const authored = (field: "title" | "description") => {
    const fields = field === "title" ? titleFields : descriptionFields;
    const written = values[fields[locale]]?.trim();
    if (written) return written;
    return values[fields[language]]?.trim() ?? "";
  };

  const allDay = values.allDay === true;
  const startsAt = zonedWallTimeToInstant(
    values.startDate ?? "",
    allDay ? "00:00" : (values.startTime ?? ""),
    city?.timezone ?? FALLBACK_TIME_ZONE,
  );
  const endsAt = zonedWallTimeToInstant(
    values.endDate === undefined || values.endDate === ""
      ? (values.startDate ?? "")
      : values.endDate,
    allDay ? "23:59" : (values.endTime ?? ""),
    city?.timezone ?? FALLBACK_TIME_ZONE,
  );
  /**
   * A half-typed date has no window to format, so the card shows what was
   * typed rather than an invented day: the preview never states an hour the
   * event does not have.
   */
  const window =
    startsAt && endsAt
      ? formatEventWindow({
          startsAt,
          endsAt,
          allDay,
          timeZone: city?.timezone ?? FALLBACK_TIME_ZONE,
          locale,
          allDayLabel: copy("events.allDayShort"),
        })
      : {
          dateLabel: values.startDate ?? "",
          timeLabel: allDay
            ? copy("events.allDayShort")
            : `${values.startTime ?? ""} – ${values.endTime ?? ""}`,
        };

  // A place being written in is not saved yet, so it is named but never pinned:
  // the coordinates it will get belong to a row that does not exist.
  const newPlaceName =
    values.placeId === NEW_PLACE ? (values.newPlaceName?.trim() ?? "") : "";
  const placeFacts = {
    placeName: place?.name ?? (newPlaceName === "" ? null : newPlaceName),
    placeAddressLine: place?.addressLine ?? null,
    placeLat: place?.lat ?? null,
    placeLng: place?.lng ?? null,
    placePrecision: place?.precision ?? null,
    locationLabel: isOnline ? null : (values.locationLabel?.trim() ?? null),
  };

  const card: PublicEventCard = {
    id: "preview",
    href: "#",
    title: authored("title") || copy("events.untitled"),
    description: authored("description") || null,
    dateLabel: window.dateLabel,
    timeLabel: window.timeLabel,
    whereLabel: isOnline
      ? null
      : (placeFacts.placeName ?? placeFacts.locationLabel),
    mapHref: isOnline ? null : eventMapHref(placeFacts, city?.name ?? null),
    cityName: isOnline ? "" : (city?.name ?? ""),
    isOnline,
    onlineUrl: isOnline ? emptyToNull(values.onlineUrl) : null,
    hostName: host?.name ?? null,
    hostHref: null,
    contactLabel: emptyToNull(values.contactLabel),
    contactValue: emptyToNull(values.contactValue),
    cancelled: false,
    cancellationReason: null,
    icsHref: "#",
    coverImage:
      coverPreview === null
        ? null
        : { url: coverPreview, alt: "", decorative: true },
  };

  return (
    <EventPublicPreview
      card={card}
      labels={{ ...listLabels, platform: platformName }}
      frame={frame}
    />
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
  stewardCandidates,
  previewLabels,
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
  cities: readonly EventFormCity[];
  places: readonly EventFormPlace[];
  /**
   * Who may be named as the contact, keyed by hosting organisation — `""` for
   * the platform itself. Keyed rather than flat because the host is chosen on
   * this same form: the roster on screen has to be the one the event is
   * actually filed under.
   */
  stewardCandidates: Record<string, readonly StewardCandidate[]>;
  /**
   * The public agenda's own wording, when this form should show the event as a
   * reader will meet it. Omitted on a screen with no room for the panel.
   */
  previewLabels?: PublicEventListLabels;
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
    () =>
      eventFormSchema(
        messages,
        readLabel(labels, "events.titleMissing"),
        readLabel(labels, "events.onlineUrlInvalid"),
      ),
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

  // Which languages are open is not part of the event, so it stays here rather
  // than in the form: every language posts either way.
  const [openLanguages, setOpenLanguages] = useState<string[]>([
    values.sourceLanguageCode,
  ]);
  const sourceLanguage = form.watch("sourceLanguageCode");
  const allDay = form.watch("allDay");
  const isOnline = form.watch("isOnline");
  const cityId = form.watch("cityId");
  const placeId = form.watch("placeId");
  const hostOrganizationId = form.watch("hostOrganizationId");
  const visibility = form.watch("visibility");
  const addingPlace = placeId === NEW_PLACE;
  /**
   * The poster as the media panel currently holds it, so the preview beside the
   * form shows the same card a reader would get — image included.
   */
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  const placeOptions = useMemo(
    () => places.filter((place) => !place.cityId || place.cityId === cityId),
    [cityId, places],
  );
  useEffect(() => {
    // A place belongs to one city, so changing the city drops a choice the new
    // city does not offer instead of posting a place from the old one. An
    // address being written in belongs to whichever city is chosen when it is
    // saved, so it survives the change.
    const placeId = form.getValues("placeId");
    if (placeId === "" || placeId === NEW_PLACE) return;
    if (placeOptions.some((place) => place.id === placeId)) return;
    form.setValue("placeId", "", { shouldDirty: true });
  }, [form, placeOptions]);

  const sourceTitleMissing =
    form.watch(titleFields[sourceLanguage]).trim() === "";

  /**
   * The event's own text, in one language. The source language's pair is spelled
   * out in the left column; every other language is a row in the rail beside it.
   */
  const textFields = (language: EventLanguage) => (
    <>
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
    </>
  );

  /**
   * The languages this event is not written in, as a rail: one row each, opened
   * to be worked on beside the source rather than under it. The same list the
   * article and activity editors show, so a language is always in the same
   * place on every content type.
   *
   * Every row stays mounted while closed — the fields *are* the post
   * (`new FormData(form)`), so a translation nobody is looking at still has to
   * travel with the event.
   */
  const translationRail = (
    <Card
      title={copy("events.section.translations")}
      hint={copy("events.section.translationsHint")}
    >
      <LanguageAccordion value={openLanguages} onValueChange={setOpenLanguages}>
        {eventLanguages
          .filter((language) => language !== sourceLanguage)
          .map((language) => {
            const written = form.watch(titleFields[language]).trim() !== "";
            return (
              <LanguageAccordionItem
                key={language}
                code={language}
                name={copy(`events.language.${language}`)}
                status={written ? "draft" : "empty"}
                statusLabel={copy(
                  written
                    ? "events.language.written"
                    : "events.language.missing",
                )}
                keepMounted
              >
                {textFields(language)}
              </LanguageAccordionItem>
            );
          })}
      </LanguageAccordion>
    </Card>
  );

  const editor = (
    <form {...formProps} className="grid gap-5">
      <input type="hidden" name="locale" value={locale} />
      {eventId ? <input type="hidden" name="eventId" value={eventId} /> : null}

      {/* The record on the left, everything about presenting it on the right:
       * translations, media, and the card a reader will get. Below `xl` the rail
       * drops under the form, where two columns would leave neither wide enough
       * to write in. */}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="grid min-w-0 content-start gap-5">
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
                      /* The language leaving the rail is the one now being
                       * written in the column beside it, so its row does not
                       * need to stay open — but the one it replaces does. */
                      setOpenLanguages((current) =>
                        current.includes(sourceLanguage)
                          ? current
                          : [...current, sourceLanguage],
                      );
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
              {textFields(sourceLanguage)}
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
              {/* Asked first, because it decides whether the rest of this card is a
               * question at all: an event people join from anywhere has no city, no
               * place and no bus to catch. */}
              <CheckboxFormField
                control={form.control}
                name="isOnline"
                label={copy("events.online")}
                description={copy("events.onlineHint")}
              />
              {isOnline ? (
                <TextFormField
                  control={form.control}
                  name="onlineUrl"
                  label={copy("events.onlineUrl")}
                  description={copy("events.onlineUrlHint")}
                  type="url"
                  inputMode="url"
                  placeholder="https://"
                  maxLength={500}
                />
              ) : null}
              {isOnline ? null : (
                <SelectFormField
                  control={form.control}
                  name="cityId"
                  label={copy("events.city")}
                  required
                >
                  <option value="">{copy("events.chooseCity")}</option>
                  {cities.map((city) => (
                    <option key={city.id} value={city.id}>
                      {city.name}
                    </option>
                  ))}
                </SelectFormField>
              )}
              {/* Either the list of places already known, or the address being
               * written in — never both, so what the event is filed under is never
               * a guess between two controls. */}
              {isOnline ? null : addingPlace ? (
                <div className="border-line rounded-card grid gap-4 border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">
                      {copy("events.newPlace")}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        form.setValue("placeId", "", { shouldDirty: true });
                        form.setValue("newPlaceName", "");
                      }}
                    >
                      {copy("events.newPlaceCancel")}
                    </Button>
                  </div>
                  <TextFormField
                    control={form.control}
                    name="newPlaceName"
                    label={copy("events.newPlaceName")}
                    description={copy("events.newPlaceNameHint")}
                    maxLength={150}
                  />
                  <PlaceAddressFields
                    labels={{
                      label: copy("events.newPlaceAddress"),
                      placeholder: readLabel(
                        consoleLabels,
                        "address.placeholder",
                      ),
                      help: readLabel(consoleLabels, "address.help"),
                      loading: readLabel(consoleLabels, "address.loading"),
                      empty: readLabel(consoleLabels, "address.empty"),
                      error: readLabel(consoleLabels, "address.error"),
                      attribution: readLabel(
                        consoleLabels,
                        "address.attribution",
                      ),
                    }}
                    selectedLabel={readLabel(consoleLabels, "address.selected")}
                    names={{
                      addressLine: "newPlaceAddressLine",
                      postalCode: "newPlacePostalCode",
                      lat: "newPlaceLat",
                      lng: "newPlaceLng",
                    }}
                    // The event names its own city, and a place is created in it:
                    // filtering to one town would hide the addresses of every
                    // other city on the platform.
                    filters={undefined}
                  />
                  <p className="text-copy-muted text-xs">
                    {copy("events.newPlaceHint")}
                  </p>
                </div>
              ) : (
                <div className="grid gap-2">
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
                  <div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        form.setValue("placeId", NEW_PLACE, {
                          shouldDirty: true,
                        });
                      }}
                    >
                      <MapPinPlus aria-hidden />
                      {copy("events.newPlaceAdd")}
                    </Button>
                  </div>
                </div>
              )}
              {isOnline ? null : (
                <TextFormField
                  control={form.control}
                  name="locationLabel"
                  label={copy("events.locationLabel")}
                  description={copy("events.locationLabelHint")}
                  maxLength={200}
                />
              )}
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
              {/* Part of "where", not a section of its own: an address a reader
               * cannot reach is only half an answer, so the way in is asked for
               * next to the place rather than at the end of the form. Nothing to
               * ask when there is nowhere to travel to. */}
              {isOnline ? null : (
                <fieldset className="grid gap-2">
                  <legend className="text-sm font-medium">
                    {copy("events.transit")}
                  </legend>
                  <p className="text-copy-muted mb-1 text-xs">
                    {copy("events.transitHint")}
                  </p>
                  <TransitLinkFields
                    links={values.transit}
                    labels={consoleLabels}
                  />
                </fieldset>
              )}
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

          {/* The roster follows the host chosen above: an event handed to
           * another association is answered for by somebody there. */}
          <StewardContactCard
            values={values.steward}
            members={stewardCandidates[hostOrganizationId] ?? []}
            labels={consoleLabels}
          />
        </div>

        {/* The rail: how this event will read, in every language and as a card.
         * It sticks while the form scrolls, so a title being typed on the left
         * can be checked against the rail without losing the field. */}
        <div className="grid min-w-0 content-start gap-5 xl:sticky xl:top-6">
          {translationRail}

          {/* On the create form only, where the files are uploaded as they are
           * chosen and attached when the event is saved — a poster and a flyer
           * are part of announcing an event rather than a second visit to the
           * console.
           *
           * An event that already exists keeps its panel outside this form, on
           * the page: attaching or removing a file there is its own action, and
           * a form cannot be nested inside another one. */}
          {mode === "create" ? (
            <Card
              title={copy("events.media.title")}
              hint={copy("events.media.draftHint")}
            >
              <EventMediaManager
                locale={locale}
                sourceLanguage={sourceLanguage}
                cover={null}
                flyers={[]}
                labels={mediaLabels(copy)}
                onCoverPreview={setCoverPreview}
              />
            </Card>
          ) : null}

          {previewLabels ? (
            <EventFormPreview
              control={form.control}
              locale={locale}
              cities={cities}
              places={places}
              organizations={organizations}
              platformName={copy("events.hostPlatform")}
              coverPreview={coverPreview}
              labels={labels}
              listLabels={previewLabels}
              frame={{
                title: copy("events.preview.title"),
                // What the reach chosen on this form actually means for who is
                // shown the card — the preview would otherwise imply "everyone".
                reach: copy(`events.visibility.${visibility}.hint`),
              }}
            />
          ) : null}
        </div>
      </div>

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

  return editor;
}
