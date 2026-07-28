"use client";

import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { z } from "zod";

import { addActivitySchedule } from "~/app/[locale]/dashboard/activities/actions";
import {
  DateFormField,
  FormSubmitButton,
  SelectFormField,
  TimeFormField,
} from "~/components/admin/form-field";
import { Button } from "~/components/ui/button";
import { FieldError } from "~/components/ui/field";
import {
  useServerFormAction,
  useWorkspaceForm,
} from "~/hooks/use-workspace-form";
import {
  scheduleRowsIssue,
  scheduleTimingModeSchema,
  scheduleTypeSchema,
  timeOfDayPattern,
  weekdayValueSchema,
} from "~/lib/schedule-rules";

type ScheduleRow = {
  weekday: number;
  startTime: string;
  endTime: string;
  endsNextDay: boolean;
  validFrom: string | null;
  validTo: string | null;
};

type ScheduleLabels = {
  scheduleType: string;
  recurring: string;
  oneOff: string;
  date: string;
  selectDate: string;
  clearDate: string;
  timingMode: string;
  fixed: string;
  flexible: string;
  weekday: string;
  startTime: string;
  endTime: string;
  addHours: string;
  cancel: string;
  required: string;
  invalidRange: string;
  overlap: string;
  invalid: string;
  weekdays: Record<number, string>;
};

/**
 * The hours an activity keeps, validated before they are posted.
 *
 * Both rules the editor can break are checked here, against the hours this
 * activity already has: an end before its start, and a window that collides
 * with an existing one. The action checks them again on arrival — this pass
 * exists so the answer arrives while the editor is still looking at the field
 * rather than after a round trip.
 *
 * A rule scoped to a single date is a one-off, not a weekly pattern, so it is
 * left out of the collision check: a closure on one Tuesday does not stop the
 * activity from opening on other Tuesdays.
 */
function scheduleFormSchema(
  labels: ScheduleLabels,
  schedules: readonly ScheduleRow[],
) {
  const weeklyRules = schedules.filter(
    (schedule) =>
      !schedule.validFrom || schedule.validFrom !== schedule.validTo,
  );

  return z
    .object({
      scheduleType: scheduleTypeSchema,
      weekday: weekdayValueSchema,
      occurrenceDate: z.string(),
      timingMode: scheduleTimingModeSchema,
      startTime: z.string().regex(timeOfDayPattern, labels.invalid),
      endTime: z.string().regex(timeOfDayPattern, labels.invalid),
    })
    .superRefine((values, context) => {
      if (values.scheduleType === "one_off" && !values.occurrenceDate) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["occurrenceDate"],
          message: labels.required,
        });
        return;
      }

      const issue = scheduleRowsIssue(
        values.scheduleType,
        [
          {
            weekday: Number(values.weekday),
            startTime: values.startTime,
            endTime: values.endTime,
          },
        ],
        weeklyRules,
      );
      if (issue === "invalidRange") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["endTime"],
          message: labels.invalidRange,
        });
      }
      if (issue === "overlap") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["startTime"],
          message: labels.overlap,
        });
      }
    });
}

type ScheduleFormValues = z.infer<ReturnType<typeof scheduleFormSchema>>;

const emptySchedule: ScheduleFormValues = {
  scheduleType: "recurring",
  weekday: "1",
  occurrenceDate: "",
  timingMode: "fixed",
  startTime: "09:00",
  endTime: "17:00",
};

export function ActivityScheduleForm({
  activityId,
  locale,
  schedules,
  labels,
}: {
  activityId: string;
  locale: "fr" | "en" | "ar";
  schedules: readonly ScheduleRow[];
  labels: ScheduleLabels;
}) {
  const [open, setOpen] = useState(false);
  const schema = useMemo(
    () => scheduleFormSchema(labels, schedules),
    [labels, schedules],
  );
  const form = useWorkspaceForm({ schema, defaultValues: emptySchedule });
  const { formProps } = useServerFormAction({
    form,
    action: addActivitySchedule,
    errorMessage: labels.invalid,
    onSuccess: (result) => {
      if (result.result === "success") {
        form.reset(emptySchedule);
        setOpen(false);
        return;
      }
      if (result.result === "error") {
        // The action names the rule that failed; show it where the client
        // checks would have shown the same rule.
        const field =
          result.error === "overlap"
            ? "startTime"
            : result.error === "invalidRange"
              ? "endTime"
              : "root";
        form.setError(field, {
          type: "server",
          message: labels[result.error],
        });
      }
    },
  });

  const scheduleType = form.watch("scheduleType");
  const formError = form.formState.errors.root?.message;

  // Keep the add form out of the way until the editor asks for it.
  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        className="justify-self-start"
        onClick={() => {
          setOpen(true);
        }}
      >
        <Plus aria-hidden />
        {labels.addHours}
      </Button>
    );
  }

  return (
    <form {...formProps} className="grid gap-3">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="activityId" value={activityId} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5 xl:items-end">
        <SelectFormField
          control={form.control}
          name="scheduleType"
          label={labels.scheduleType}
        >
          <option value="recurring">{labels.recurring}</option>
          <option value="one_off">{labels.oneOff}</option>
        </SelectFormField>
        {scheduleType === "one_off" ? (
          <DateFormField
            control={form.control}
            name="occurrenceDate"
            label={labels.date}
            locale={locale}
            placeholder={labels.selectDate}
            clearLabel={labels.clearDate}
            required
          />
        ) : (
          <SelectFormField
            control={form.control}
            name="weekday"
            label={labels.weekday}
          >
            {Object.entries(labels.weekdays).map(([value, weekdayLabel]) => (
              <option key={value} value={value}>
                {weekdayLabel}
              </option>
            ))}
          </SelectFormField>
        )}
        <SelectFormField
          control={form.control}
          name="timingMode"
          label={labels.timingMode}
        >
          <option value="fixed">{labels.fixed}</option>
          <option value="flexible">{labels.flexible}</option>
        </SelectFormField>
        <TimeFormField
          control={form.control}
          name="startTime"
          label={labels.startTime}
          required
        />
        <TimeFormField
          control={form.control}
          name="endTime"
          label={labels.endTime}
          required
        />
      </div>
      <div className="flex items-center gap-2">
        <FormSubmitButton control={form.control}>
          {labels.addHours}
        </FormSubmitButton>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setOpen(false);
          }}
        >
          {labels.cancel}
        </Button>
      </div>
      {formError ? <FieldError>{formError}</FieldError> : null}
    </form>
  );
}
