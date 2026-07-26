"use client";

import type { Locale } from "@infokit/shared/i18n";
import { useState } from "react";

import { TimePicker } from "~/components/shadcn-studio/date-picker/date-picker-09";
import { DatePicker } from "~/components/ui/date-picker";
import { Field, FieldDescription, FieldLabel } from "~/components/ui/field";
import { SelectField } from "~/components/ui/select-field";

export type PublicationMode = "draft" | "now" | "scheduled";

export function PublicationChoice({
  locale,
  labels,
  defaultMode = "draft",
}: {
  locale: Locale;
  labels: {
    heading: string;
    hint: string;
    draft: string;
    now: string;
    scheduled: string;
    date: string;
    time: string;
    selectDate: string;
    clearDate: string;
    dateHint: string;
  };
  defaultMode?: PublicationMode;
}) {
  const [mode, setMode] = useState<PublicationMode>(defaultMode);
  const [publicationDate, setPublicationDate] = useState("");
  const [publicationTime, setPublicationTime] = useState("");
  const publishAt =
    publicationDate && publicationTime
      ? new Date(`${publicationDate}T${publicationTime}:00`).toISOString()
      : "";

  return (
    <div className="grid gap-4">
      <Field>
        <FieldLabel htmlFor="publication-mode">{labels.heading}</FieldLabel>
        <SelectField
          id="publication-mode"
          name="publicationMode"
          value={mode}
          onValueChange={(next) => {
            setMode(next as PublicationMode);
          }}
        >
          <option value="draft">{labels.draft}</option>
          <option value="now">{labels.now}</option>
          <option value="scheduled">{labels.scheduled}</option>
        </SelectField>
        <FieldDescription>{labels.hint}</FieldDescription>
      </Field>
      {mode === "scheduled" ? (
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem]">
          <Field>
            <FieldLabel htmlFor="publication-date">{labels.date}</FieldLabel>
            <DatePicker
              id="publication-date"
              name="publicationDate"
              locale={locale}
              placeholder={labels.selectDate}
              clearLabel={labels.clearDate}
              fromYear={new Date().getFullYear()}
              required
              onValueChange={setPublicationDate}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="publication-time">{labels.time}</FieldLabel>
            <TimePicker
              id="publication-time"
              name="publicationTime"
              value={publicationTime}
              required
              onChange={(event) => {
                setPublicationTime(event.target.value);
              }}
            />
          </Field>
          <input type="hidden" name="publishAt" value={publishAt} />
          <FieldDescription className="sm:col-span-2">
            {labels.dateHint}
          </FieldDescription>
        </div>
      ) : (
        <input type="hidden" name="publishAt" value="" />
      )}
    </div>
  );
}
