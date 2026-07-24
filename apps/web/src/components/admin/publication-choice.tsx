"use client";

import type { Locale } from "@calais/shared/i18n";
import { useState } from "react";

import { DatePicker } from "~/components/ui/date-picker";
import { Field, FieldDescription, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "~/components/ui/native-select";

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
        <NativeSelect
          id="publication-mode"
          name="publicationMode"
          value={mode}
          onChange={(event) => {
            setMode(event.target.value as PublicationMode);
          }}
        >
          <NativeSelectOption value="draft">{labels.draft}</NativeSelectOption>
          <NativeSelectOption value="now">{labels.now}</NativeSelectOption>
          <NativeSelectOption value="scheduled">
            {labels.scheduled}
          </NativeSelectOption>
        </NativeSelect>
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
            <Input
              id="publication-time"
              name="publicationTime"
              type="time"
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
