"use client";

import type { Locale } from "@infokit/shared/i18n";
import { CalendarClock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useActionErrorToast } from "~/components/admin/admin-ui-provider";
import { PendingButton } from "~/components/pending-button";
import { TimePicker } from "~/components/shadcn-studio/date-picker/date-picker-09";
import { Button } from "~/components/ui/button";
import { DatePicker } from "~/components/ui/date-picker";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Field, FieldLabel } from "~/components/ui/field";

type ScheduleAction = (formData: FormData) => Promise<void>;

export function SchedulePublicationDialog({
  locale,
  fields,
  action,
  disabled,
  labels,
}: {
  locale: Locale;
  fields: Record<string, string>;
  action: ScheduleAction;
  disabled: boolean;
  labels: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const [publicationDate, setPublicationDate] = useState("");
  const [publicationTime, setPublicationTime] = useState("");
  const showActionError = useActionErrorToast();
  const canSubmit = Boolean(publicationDate && publicationTime);
  const fieldSuffix = fields.languageCode ?? "language";

  const schedule = async (formData: FormData) => {
    const localDateTime = new Date(`${publicationDate}T${publicationTime}:00`);
    if (!canSubmit || Number.isNaN(localDateTime.getTime())) return;

    formData.set("publishAt", localDateTime.toISOString());
    try {
      await action(formData);
      toast.success(labels["toast.scheduled"]);
      setOpen(false);
      setPublicationDate("");
      setPublicationTime("");
    } catch (error) {
      showActionError(
        error,
        labels["toast.publishError"] ?? labels["toast.actionError"] ?? "",
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className="min-h-10 w-full min-w-0 whitespace-normal"
          />
        }
      >
        <CalendarClock aria-hidden />
        {labels["publication.scheduleAction"]}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{labels["publication.scheduleAction"]}</DialogTitle>
          <DialogDescription>
            {labels["publication.dateHint"]}
          </DialogDescription>
        </DialogHeader>
        <form action={schedule} className="grid gap-4">
          {Object.entries(fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem]">
            <Field>
              <FieldLabel htmlFor={`publication-date-${fieldSuffix}`}>
                {labels["publication.dateOnly"]}
              </FieldLabel>
              <DatePicker
                id={`publication-date-${fieldSuffix}`}
                name="publicationDate"
                locale={locale}
                placeholder={labels["publication.selectDate"] ?? ""}
                clearLabel={labels["publication.clearDate"] ?? ""}
                fromYear={new Date().getFullYear()}
                required
                onValueChange={setPublicationDate}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`publication-time-${fieldSuffix}`}>
                {labels["publication.time"]}
              </FieldLabel>
              <TimePicker
                id={`publication-time-${fieldSuffix}`}
                name="publicationTime"
                value={publicationTime}
                required
                onChange={(event) => {
                  setPublicationTime(event.target.value);
                }}
              />
            </Field>
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {labels["publication.cancelAction"]}
            </DialogClose>
            <PendingButton disabled={!canSubmit}>
              <CalendarClock aria-hidden />
              {labels["publication.scheduleAction"]}
            </PendingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
