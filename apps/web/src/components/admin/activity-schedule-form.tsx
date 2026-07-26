"use client";

import { Plus } from "lucide-react";
import { useActionState, useEffect, useState } from "react";

import {
  addActivitySchedule,
  type AddActivityScheduleResult,
} from "~/app/[locale]/dashboard/activities/actions";
import { PendingButton } from "~/components/pending-button";
import { TimePicker } from "~/components/shadcn-studio/date-picker/date-picker-09";
import { Button } from "~/components/ui/button";
import { DatePicker } from "~/components/ui/date-picker";
import { Field, FieldError, FieldLabel } from "~/components/ui/field";
import { SelectField } from "~/components/ui/select-field";
import { hasScheduleRuleOverlap } from "~/lib/schedule-overlap";

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
  invalidRange: string;
  overlap: string;
  invalid: string;
  weekdays: Record<number, string>;
};

const initialState: AddActivityScheduleResult = { result: "idle" };

async function submitSchedule(
  _previousState: AddActivityScheduleResult,
  formData: FormData,
): Promise<AddActivityScheduleResult> {
  return addActivitySchedule(formData);
}

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
  const [state, formAction] = useActionState(submitSchedule, initialState);
  const [open, setOpen] = useState(false);
  const [scheduleType, setScheduleType] = useState<"recurring" | "one_off">(
    "recurring",
  );
  const [weekday, setWeekday] = useState("1");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const errorId = `activity-${activityId}-schedule-error`;

  const candidate = {
    weekday: Number(weekday),
    startTime,
    endTime,
    endsNextDay: false,
  };
  const clientError =
    startTime && endTime && startTime >= endTime
      ? "invalidRange"
      : scheduleType === "recurring" &&
          startTime &&
          endTime &&
          hasScheduleRuleOverlap(
            candidate,
            schedules.filter(
              (schedule) =>
                !schedule.validFrom || schedule.validFrom !== schedule.validTo,
            ),
          )
        ? "overlap"
        : null;
  const serverError =
    state.result === "error" &&
    (!state.values || state.values.scheduleType === scheduleType)
      ? state.error
      : null;
  const errorKey = clientError ?? serverError;
  const errorMessage = errorKey ? labels[errorKey] : null;

  useEffect(() => {
    if (state.result === "success") {
      setStartTime("09:00");
      setEndTime("17:00");
      setOpen(false);
    }
  }, [state]);

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
    <form
      action={formAction}
      className="grid gap-3"
      onSubmit={(event) => {
        if (clientError) event.preventDefault();
      }}
    >
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="activityId" value={activityId} />
      <input type="hidden" name="scheduleType" value={scheduleType} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5 xl:items-end">
        <Field>
          <FieldLabel htmlFor={`activity-${activityId}-schedule-type`}>
            {labels.scheduleType}
          </FieldLabel>
          <SelectField
            id={`activity-${activityId}-schedule-type`}
            value={scheduleType}
            onValueChange={(next) => {
              setScheduleType(next as "recurring" | "one_off");
            }}
          >
            <option value="recurring">{labels.recurring}</option>
            <option value="one_off">{labels.oneOff}</option>
          </SelectField>
        </Field>
        {scheduleType === "one_off" ? (
          <Field data-invalid={Boolean(errorMessage)}>
            <FieldLabel>{labels.date}</FieldLabel>
            <DatePicker
              key={`activity-${activityId}-one-off-date`}
              name="occurrenceDate"
              locale={locale}
              placeholder={labels.selectDate}
              clearLabel={labels.clearDate}
              required
            />
          </Field>
        ) : (
          <Field data-invalid={Boolean(errorMessage)}>
            <FieldLabel htmlFor={`activity-${activityId}-weekday`}>
              {labels.weekday}
            </FieldLabel>
            <SelectField
              id={`activity-${activityId}-weekday`}
              name="weekday"
              value={weekday}
              onValueChange={setWeekday}
              aria-invalid={Boolean(errorMessage)}
              aria-describedby={errorMessage ? errorId : undefined}
            >
              {Object.entries(labels.weekdays).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectField>
          </Field>
        )}
        <Field>
          <FieldLabel htmlFor={`activity-${activityId}-timing-mode`}>
            {labels.timingMode}
          </FieldLabel>
          <SelectField
            id={`activity-${activityId}-timing-mode`}
            name="timingMode"
            defaultValue="fixed"
          >
            <option value="fixed">{labels.fixed}</option>
            <option value="flexible">{labels.flexible}</option>
          </SelectField>
        </Field>
        <Field data-invalid={Boolean(errorMessage)}>
          <FieldLabel htmlFor={`activity-${activityId}-start-time`}>
            {labels.startTime}
          </FieldLabel>
          <TimePicker
            id={`activity-${activityId}-start-time`}
            name="startTime"
            value={startTime}
            onChange={(event) => {
              setStartTime(event.target.value);
            }}
            required
            aria-invalid={Boolean(errorMessage)}
            aria-describedby={errorMessage ? errorId : undefined}
          />
        </Field>
        <Field data-invalid={Boolean(errorMessage)}>
          <FieldLabel htmlFor={`activity-${activityId}-end-time`}>
            {labels.endTime}
          </FieldLabel>
          <TimePicker
            id={`activity-${activityId}-end-time`}
            name="endTime"
            value={endTime}
            onChange={(event) => {
              setEndTime(event.target.value);
            }}
            required
            aria-invalid={Boolean(errorMessage)}
            aria-describedby={errorMessage ? errorId : undefined}
          />
        </Field>
      </div>
      <div className="flex items-center gap-2">
        <PendingButton>{labels.addHours}</PendingButton>
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
      {errorMessage ? (
        <FieldError id={errorId}>{errorMessage}</FieldError>
      ) : null}
    </form>
  );
}
