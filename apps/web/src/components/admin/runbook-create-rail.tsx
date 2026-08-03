"use client";

import type { Locale } from "@infokit/shared/i18n";
import {
  CalendarPlus,
  ChevronRight,
  CirclePlus,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";

import { ActionFeedbackForm } from "~/components/admin/action-feedback-form";
import { SearchableSelect } from "~/components/admin/searchable-select";
import { PendingButton } from "~/components/pending-button";
import { Button } from "~/components/ui/button";
import { DatePicker } from "~/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Field, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { SelectField } from "~/components/ui/select-field";
import { Separator } from "~/components/ui/separator";
import { Textarea } from "~/components/ui/textarea";
import {
  addExceptionalClosure,
  assignServiceToActivity,
  createAndAssignService,
} from "~/app/[locale]/dashboard/activities/actions";
import { localizedPath } from "~/i18n/routing";

type Option = { id: string; name: string; icon?: string | null };
type ActivityOption = Option & { organizationId: string; cityId: string };
type ServiceOption = Option & {
  organizationId: string | null;
  category?: string;
};

export function RunbookCreateRail({
  locale,
  categories,
  activities,
  services,
  selectedDate,
  labels,
}: {
  locale: Locale;
  categories: Option[];
  activities: ActivityOption[];
  services: ServiceOption[];
  selectedDate: string;
  labels: Record<string, string>;
}) {
  const [activityId, setActivityId] = useState(activities[0]?.id ?? "");
  const [existingServiceId, setExistingServiceId] = useState("");
  const [newServiceCategoryId, setNewServiceCategoryId] = useState(
    categories[0]?.id ?? "",
  );
  const formId = useId().replace(/:/g, "");
  const fieldId = (name: string) => `${formId}-${name}`;

  const selectedActivity = activities.find((item) => item.id === activityId);
  const availableServices = services.filter(
    (item) =>
      item.organizationId === null ||
      item.organizationId === selectedActivity?.organizationId,
  );
  const categoryOptions = categories.map((item) => ({
    value: item.id,
    label: item.name,
    icon: item.icon,
  }));
  const activityOptions = activities.map((item) => ({
    value: item.id,
    label: item.name,
  }));

  return (
    <section aria-labelledby="runbook-create-heading">
      <h2 id="runbook-create-heading" className="mb-3 text-base font-semibold">
        {labels.create}
      </h2>
      <div className="grid gap-2">
        <Button
          nativeButton={false}
          render={
            <Link href={localizedPath("/dashboard/activities/new", locale)} />
          }
          size="lg"
          className="h-12 w-full justify-start px-4 text-base"
        >
          <CalendarPlus aria-hidden />
          {labels.newActivity}
          <ChevronRight className="ms-auto rtl:rotate-180" aria-hidden />
        </Button>

        <Dialog>
          <DialogTrigger
            render={
              <Button
                variant="outline"
                size="lg"
                className="h-auto min-h-14 w-full justify-start px-4 py-2.5 text-start"
                disabled={activities.length === 0}
              />
            }
          >
            <CirclePlus aria-hidden />
            <span>
              <span className="block">{labels.addServices}</span>
              <span className="text-copy-muted block text-xs font-normal">
                {labels.chooseActivity}
              </span>
            </span>
            <ChevronRight className="ms-auto rtl:rotate-180" aria-hidden />
          </DialogTrigger>
          <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{labels.addServices}</DialogTitle>
              <DialogDescription>{labels.serviceDescription}</DialogDescription>
            </DialogHeader>
            <Field>
              <FieldLabel>{labels.activity}</FieldLabel>
              <SearchableSelect
                name="activityPicker"
                options={activityOptions}
                value={activityId}
                onValueChange={(value) => {
                  setActivityId(value);
                  setExistingServiceId("");
                }}
                label={labels.activity}
                placeholder={labels.activityPlaceholder}
                emptyLabel={labels.noOptions}
                required
              />
            </Field>

            {availableServices.length > 0 ? (
              <ActionFeedbackForm
                action={assignServiceToActivity}
                successMessage={labels["create.feedbackServiceAssigned"] ?? ""}
                errorMessage={labels["create.feedbackActionError"] ?? ""}
                className="grid gap-3"
              >
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="activityId" value={activityId} />
                <Field>
                  <FieldLabel>{labels.existingService}</FieldLabel>
                  <SearchableSelect
                    name="serviceId"
                    options={availableServices.map((item) => ({
                      value: item.id,
                      label: item.name,
                      description: item.category,
                      icon: item.icon,
                    }))}
                    value={existingServiceId}
                    onValueChange={setExistingServiceId}
                    label={labels.existingService}
                    placeholder={labels.serviceSelectionPlaceholder}
                    emptyLabel={labels.noServicesFound}
                    required
                  />
                </Field>
                <PendingButton variant="secondary" className="justify-self-end">
                  {labels.assignService}
                </PendingButton>
              </ActionFeedbackForm>
            ) : null}

            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-copy-muted text-xs">{labels.orCreate}</span>
              <Separator className="flex-1" />
            </div>

            <ActionFeedbackForm
              action={createAndAssignService}
              successMessage={labels["create.feedbackServiceCreated"] ?? ""}
              errorMessage={labels["create.feedbackActionError"] ?? ""}
              className="grid gap-3 sm:grid-cols-2"
            >
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="activityId" value={activityId} />
              <input
                type="hidden"
                name="organizationId"
                value={selectedActivity?.organizationId ?? ""}
              />
              <Field className="sm:col-span-2">
                <FieldLabel>{labels.category}</FieldLabel>
                <SearchableSelect
                  name="categoryId"
                  options={categoryOptions}
                  value={newServiceCategoryId}
                  onValueChange={setNewServiceCategoryId}
                  label={labels.category}
                  placeholder={labels.categoryPlaceholder}
                  emptyLabel={labels.noOptions}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={fieldId("service-name-fr")}>
                  {labels.nameFr}
                </FieldLabel>
                <Input
                  id={fieldId("service-name-fr")}
                  name="nameFr"
                  required
                  minLength={2}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={fieldId("service-name-en")}>
                  {labels.nameEn}
                </FieldLabel>
                <Input id={fieldId("service-name-en")} name="nameEn" />
              </Field>
              <Field>
                <FieldLabel htmlFor={fieldId("service-name-ar")}>
                  {labels.nameAr}
                </FieldLabel>
                <Input
                  id={fieldId("service-name-ar")}
                  name="nameAr"
                  dir="rtl"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={fieldId("service-source")}>
                  {labels.sourceNote}
                </FieldLabel>
                <Input id={fieldId("service-source")} name="sourceNote" />
              </Field>
              <PendingButton className="sm:col-span-2 sm:justify-self-end">
                {labels.createAndAssign}
              </PendingButton>
            </ActionFeedbackForm>
          </DialogContent>
        </Dialog>

        <Dialog>
          <DialogTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="h-12 w-full justify-start px-4"
                disabled={activities.length === 0}
              />
            }
          >
            <TriangleAlert aria-hidden />
            {labels.exceptionalClosure}
            <ChevronRight className="ms-auto rtl:rotate-180" aria-hidden />
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{labels.exceptionalClosure}</DialogTitle>
              <DialogDescription>{labels.closureDescription}</DialogDescription>
            </DialogHeader>
            <ActionFeedbackForm
              action={addExceptionalClosure}
              successMessage={labels["create.feedbackClosureAdded"] ?? ""}
              errorMessage={labels["create.feedbackActionError"] ?? ""}
              className="grid gap-4"
            >
              <input type="hidden" name="locale" value={locale} />
              <Field>
                <FieldLabel htmlFor={fieldId("closure-activity")}>
                  {labels.activity}
                </FieldLabel>
                <SelectField
                  id={fieldId("closure-activity")}
                  name="activityId"
                  required
                  defaultValue={activityId}
                >
                  {activities.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </SelectField>
              </Field>
              <Field>
                <FieldLabel htmlFor={fieldId("closure-date")}>
                  {labels.date}
                </FieldLabel>
                <DatePicker
                  // Remount when the runbook day changes so the field follows
                  // the calendar instead of holding the first day opened.
                  key={selectedDate}
                  id={fieldId("closure-date")}
                  name="date"
                  locale={locale}
                  defaultValue={selectedDate}
                  placeholder={labels.selectDate ?? ""}
                  clearLabel={labels.clearDate ?? ""}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={fieldId("closure-reason-fr")}>
                  {labels.publicReasonFr}
                </FieldLabel>
                <Textarea
                  id={fieldId("closure-reason-fr")}
                  name="reasonFr"
                  rows={3}
                />
              </Field>
              <PendingButton className="justify-self-end">
                {labels.addClosure}
              </PendingButton>
            </ActionFeedbackForm>
          </DialogContent>
        </Dialog>
      </div>
    </section>
  );
}
