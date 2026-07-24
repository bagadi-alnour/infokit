"use client";

import { X } from "lucide-react";

import { deleteActivitySchedule } from "~/app/[locale]/dashboard/activities/actions";
import { PendingButton } from "~/components/pending-button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";

type ScheduleRule = {
  id: string;
  weekday: number;
  startTime: string;
  endTime: string;
  timingMode?: "fixed" | "flexible";
  validFrom: string | null;
  validTo: string | null;
};

export function ActivityScheduleRules({
  activityId,
  locale,
  rules,
  labels,
}: {
  activityId: string;
  locale: string;
  rules: readonly ScheduleRule[];
  labels: {
    empty: string;
    remove: string;
    confirmTitle: string;
    confirmDescription: string;
    confirm: string;
    cancel: string;
    weekdays: Record<number, string>;
    oneOff: string;
    recurring: string;
    fixed?: string;
    flexible?: string;
  };
}) {
  if (rules.length === 0) {
    return <p className="text-muted-foreground text-sm">{labels.empty}</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {rules.map((rule) => {
        const isOneOff = Boolean(
          rule.validFrom && rule.validFrom === rule.validTo,
        );
        const weekdayLabel =
          labels.weekdays[rule.weekday] ?? String(rule.weekday);
        const dateLabel = rule.validFrom
          ? new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
              new Date(`${rule.validFrom}T12:00:00Z`),
            )
          : null;
        const timingLabel =
          rule.timingMode === "flexible" ? labels.flexible : labels.fixed;
        const scheduleScope = isOneOff
          ? `${labels.oneOff} · ${dateLabel ?? ""}`
          : `${labels.recurring} · ${weekdayLabel}`;
        const scheduleLabel = `${scheduleScope} · ${rule.startTime.slice(0, 5)}–${rule.endTime.slice(0, 5)}${timingLabel ? ` · ${timingLabel}` : ""}`;
        const removeLabel = labels.remove.replace("{schedule}", scheduleLabel);
        const confirmDescription = labels.confirmDescription.replace(
          "{schedule}",
          scheduleLabel,
        );

        return (
          <AlertDialog key={rule.id}>
            <Badge
              variant="secondary"
              className="h-9 gap-2 rounded-md py-0 pe-1 ps-3"
            >
              <span>{scheduleLabel}</span>
              <AlertDialogTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive -me-0.5 size-7"
                  />
                }
                aria-label={removeLabel}
                title={removeLabel}
              >
                <X aria-hidden />
              </AlertDialogTrigger>
            </Badge>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{labels.confirmTitle}</AlertDialogTitle>
                <AlertDialogDescription>
                  {confirmDescription}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{labels.cancel}</AlertDialogCancel>
                <form action={deleteActivitySchedule}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="activityId" value={activityId} />
                  <input type="hidden" name="scheduleRuleId" value={rule.id} />
                  <PendingButton variant="danger" className="w-full">
                    {labels.confirm}
                  </PendingButton>
                </form>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        );
      })}
    </div>
  );
}
