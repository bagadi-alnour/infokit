"use client";

import { Archive, Pencil, Plus, RotateCcw, Save } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  archiveReusableService,
  createAndAssignService,
  replaceActivityServices,
  restoreReusableService,
  updateReusableService,
} from "~/app/[locale]/dashboard/activities/actions";
import {
  isPermissionDeniedError,
  useActionErrorToast,
} from "~/components/admin/admin-ui-provider";
import {
  SearchableMultiSelect,
  SearchableSelect,
  type SearchableOption,
} from "~/components/admin/searchable-select";
import { PendingButton } from "~/components/pending-button";
import { TaxonomyIcon } from "~/components/taxonomy-icon";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import {
  NativeSelect,
  NativeSelectOption,
} from "~/components/ui/native-select";

export type ManagedService = {
  id: string;
  organizationId: string | null;
  categoryId: string;
  category: string;
  icon: string;
  active: boolean;
  archived: boolean;
  sourceNote: string | null;
  names: Partial<Record<"fr" | "en" | "ar", string>>;
  descriptions: Partial<Record<"fr" | "en" | "ar", string>>;
  displayName: string;
};

const languageSuffix = { fr: "Fr", en: "En", ar: "Ar" } as const;

type AssignmentSaveState = {
  result: "idle" | "success" | "error" | "forbidden";
  revision: number;
};

const initialAssignmentSaveState: AssignmentSaveState = {
  result: "idle",
  revision: 0,
};

async function saveActivityServices(
  previousState: AssignmentSaveState,
  formData: FormData,
): Promise<AssignmentSaveState> {
  try {
    await replaceActivityServices(formData);
    return { result: "success", revision: previousState.revision + 1 };
  } catch (error) {
    return {
      result: isPermissionDeniedError(error) ? "forbidden" : "error",
      revision: previousState.revision + 1,
    };
  }
}

function ServiceFields({
  service,
  categories,
  labels,
}: {
  service?: ManagedService;
  categories: readonly SearchableOption[];
  labels: Record<string, string>;
}) {
  const [categoryId, setCategoryId] = useState(
    service?.categoryId ?? categories[0]?.value ?? "",
  );
  const copy = (key: string) => labels[key] ?? key;

  return (
    <>
      <Field className="sm:col-span-2">
        <FieldLabel>{copy("category")}</FieldLabel>
        <SearchableSelect
          name="categoryId"
          options={categories}
          value={categoryId}
          onValueChange={setCategoryId}
          label={copy("category")}
          placeholder={copy("categoryPlaceholder")}
          emptyLabel={copy("noOptions")}
          required
        />
      </Field>
      <Field className="sm:col-span-2">
        <FieldLabel htmlFor={`service-${service?.id ?? "new"}-icon`}>
          {copy("icon")}
        </FieldLabel>
        <Input
          id={`service-${service?.id ?? "new"}-icon`}
          name="icon"
          defaultValue={service?.icon ?? "help"}
          maxLength={50}
          required
        />
        <FieldDescription>{copy("iconHint")}</FieldDescription>
      </Field>
      {(["fr", "en", "ar"] as const).map((language) => (
        <div
          key={language}
          className="border-line grid gap-3 rounded-lg border p-3 sm:col-span-2 sm:grid-cols-2"
          dir={language === "ar" ? "rtl" : "ltr"}
        >
          <Field>
            <FieldLabel htmlFor={`service-${service?.id ?? "new"}-${language}`}>
              {copy(`name.${language}`)}
            </FieldLabel>
            <Input
              id={`service-${service?.id ?? "new"}-${language}`}
              name={`name${languageSuffix[language]}`}
              defaultValue={service?.names[language] ?? ""}
              required={language === "fr"}
              minLength={language === "fr" ? 2 : undefined}
            />
          </Field>
          <Field>
            <FieldLabel>{copy(`description.${language}`)}</FieldLabel>
            <Textarea
              name={`description${languageSuffix[language]}`}
              defaultValue={service?.descriptions[language] ?? ""}
              rows={2}
            />
          </Field>
        </div>
      ))}
      <Field className="sm:col-span-2">
        <FieldLabel>{copy("sourceNote")}</FieldLabel>
        <Input name="sourceNote" defaultValue={service?.sourceNote ?? ""} />
        <FieldDescription>{copy("sourceHint")}</FieldDescription>
      </Field>
    </>
  );
}

export function ActivityServiceManager({
  activityId,
  organizationId,
  locale,
  assignedIds,
  services,
  categories,
  labels,
  canManageGlobal = false,
  showCatalogue = true,
}: {
  activityId: string;
  organizationId: string;
  locale: string;
  assignedIds: string[];
  services: ManagedService[];
  categories: SearchableOption[];
  labels: Record<string, string>;
  canManageGlobal?: boolean;
  /** Show the reusable-service catalogue management list below the picker. */
  showCatalogue?: boolean;
}) {
  const [selectedIds, setSelectedIds] = useState(assignedIds);
  const [createScope, setCreateScope] = useState<"organization" | "global">(
    "organization",
  );
  const [saveState, saveAction] = useActionState(
    saveActivityServices,
    initialAssignmentSaveState,
  );
  const showActionError = useActionErrorToast();
  const copy = (key: string) => labels[key] ?? key;
  const activeServices = services.filter(
    (service) => service.active && !service.archived,
  );
  const options = activeServices.map((service) => ({
    value: service.id,
    label: service.displayName,
    description: service.category,
    icon: service.icon,
  }));
  const manageableServices = services.filter(
    (service) =>
      service.organizationId === organizationId ||
      (canManageGlobal && service.organizationId === null),
  );

  useEffect(() => {
    if (saveState.result === "success") {
      toast.success(labels.assignmentSaved);
    }
    if (saveState.result === "error") {
      toast.error(labels.assignmentSaveError);
    }
    if (saveState.result === "forbidden") {
      showActionError(new Error("Forbidden"), labels.assignmentSaveError ?? "");
    }
  }, [
    labels.assignmentSaveError,
    labels.assignmentSaved,
    saveState,
    showActionError,
  ]);

  return (
    <div className="grid gap-5">
      <form action={saveAction} className="grid gap-3">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="activityId" value={activityId} />
        <SearchableMultiSelect
          name="serviceId"
          options={options}
          value={selectedIds}
          onValueChange={setSelectedIds}
          label={copy("assignment")}
          placeholder={copy("assignmentPlaceholder")}
          emptyLabel={copy("empty")}
        />
        <PendingButton variant="secondary" className="justify-self-end">
          <Save aria-hidden />
          {copy("saveAssignment")}
        </PendingButton>
      </form>

      {showCatalogue ? (
        <div className="border-line border-t pt-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">{copy("catalogue")}</h3>
              <p className="text-copy-muted mt-1 text-xs">
                {copy("catalogueHint")}
              </p>
            </div>
            <Dialog>
              <DialogTrigger
                render={<Button type="button" size="sm" variant="outline" />}
              >
                <Plus aria-hidden />
                {copy("create")}
              </DialogTrigger>
              <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{copy("createTitle")}</DialogTitle>
                  <DialogDescription>{copy("createHint")}</DialogDescription>
                </DialogHeader>
                <form
                  action={createAndAssignService}
                  className="grid gap-4 sm:grid-cols-2"
                >
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="activityId" value={activityId} />
                  <input
                    type="hidden"
                    name="organizationId"
                    value={createScope === "global" ? "" : organizationId}
                  />
                  {canManageGlobal ? (
                    <Field className="sm:col-span-2">
                      <FieldLabel htmlFor="new-service-scope">
                        {copy("scope")}
                      </FieldLabel>
                      <NativeSelect
                        id="new-service-scope"
                        value={createScope}
                        onChange={(event) => {
                          setCreateScope(
                            event.target.value as typeof createScope,
                          );
                        }}
                      >
                        <NativeSelectOption value="organization">
                          {copy("scopeOrganization")}
                        </NativeSelectOption>
                        <NativeSelectOption value="global">
                          {copy("scopeGlobal")}
                        </NativeSelectOption>
                      </NativeSelect>
                    </Field>
                  ) : null}
                  <ServiceFields categories={categories} labels={labels} />
                  <PendingButton className="sm:col-span-2 sm:justify-self-end">
                    {copy("createAndAssign")}
                  </PendingButton>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {manageableServices.length > 0 ? (
            <div className="grid gap-2">
              {manageableServices.map((service) => (
                <div
                  key={service.id}
                  className="border-line flex flex-wrap items-center gap-3 rounded-lg border p-3"
                >
                  <span className="bg-brand-soft text-brand flex size-9 shrink-0 items-center justify-center rounded-md">
                    <TaxonomyIcon name={service.icon} size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {service.displayName}
                    </span>
                    <span className="text-copy-muted block truncate text-xs">
                      {service.category}
                    </span>
                  </span>
                  {service.archived ? (
                    <Badge variant="secondary">{copy("archived")}</Badge>
                  ) : null}
                  <Badge variant="outline">
                    {service.organizationId
                      ? copy("scopeOrganization")
                      : copy("scopeGlobal")}
                  </Badge>

                  {service.archived ? (
                    <form action={restoreReusableService}>
                      <input type="hidden" name="locale" value={locale} />
                      <input
                        type="hidden"
                        name="organizationId"
                        value={service.organizationId ?? ""}
                      />
                      <input
                        type="hidden"
                        name="serviceId"
                        value={service.id}
                      />
                      <PendingButton variant="secondary">
                        <RotateCcw aria-hidden />
                        {copy("restore")}
                      </PendingButton>
                    </form>
                  ) : (
                    <>
                      <Dialog>
                        <DialogTrigger
                          render={
                            <Button type="button" size="sm" variant="ghost" />
                          }
                        >
                          <Pencil aria-hidden />
                          {copy("edit")}
                        </DialogTrigger>
                        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>{copy("editTitle")}</DialogTitle>
                            <DialogDescription>
                              {copy("editHint")}
                            </DialogDescription>
                          </DialogHeader>
                          <form
                            action={updateReusableService}
                            className="grid gap-4 sm:grid-cols-2"
                          >
                            <input type="hidden" name="locale" value={locale} />
                            <input
                              type="hidden"
                              name="organizationId"
                              value={service.organizationId ?? ""}
                            />
                            <input
                              type="hidden"
                              name="serviceId"
                              value={service.id}
                            />
                            <ServiceFields
                              service={service}
                              categories={categories}
                              labels={labels}
                            />
                            <PendingButton className="sm:col-span-2 sm:justify-self-end">
                              {copy("save")}
                            </PendingButton>
                          </form>
                        </DialogContent>
                      </Dialog>

                      <AlertDialog>
                        <AlertDialogTrigger
                          render={
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="text-danger"
                            />
                          }
                        >
                          <Archive aria-hidden />
                          {copy("archive")}
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              {copy("archiveTitle")}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              {copy("archiveHint")}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>
                              {copy("cancel")}
                            </AlertDialogCancel>
                            <form action={archiveReusableService}>
                              <input
                                type="hidden"
                                name="locale"
                                value={locale}
                              />
                              <input
                                type="hidden"
                                name="organizationId"
                                value={service.organizationId ?? ""}
                              />
                              <input
                                type="hidden"
                                name="serviceId"
                                value={service.id}
                              />
                              <PendingButton
                                variant="danger"
                                className="w-full"
                              >
                                {copy("archiveConfirm")}
                              </PendingButton>
                            </form>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-copy-muted text-sm">{copy("catalogueEmpty")}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
