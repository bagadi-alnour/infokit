"use client";

import { Archive, Pencil, Plus, RotateCcw, Save } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { z } from "zod";

import {
  archiveReusableService,
  createAndAssignService,
  replaceActivityServices,
  restoreReusableService,
  updateReusableService,
} from "~/app/[locale]/dashboard/activities/actions";
import { ActionFeedbackForm } from "~/components/admin/action-feedback-form";
import {
  FormSubmitButton,
  SearchableMultiSelectFormField,
  SearchableSelectFormField,
  TextAreaFormField,
  TextFormField,
} from "~/components/admin/form-field";
import type { SearchableOption } from "~/components/admin/searchable-select";
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
import { Field, FieldLabel } from "~/components/ui/field";
import { SelectField } from "~/components/ui/select-field";
import {
  useFormMessages,
  useServerFormAction,
  useWorkspaceForm,
  type ServerFormAction,
} from "~/hooks/use-workspace-form";
import { editorialTextDirection } from "~/lib/editorial-languages";
import { readLabel, type FormMessages, type Labels } from "~/lib/form-messages";

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

const editorialLanguages = ["fr", "en", "ar"] as const;
type EditorialLanguage = (typeof editorialLanguages)[number];

/** Which services this activity offers. One hidden input per assignment. */
const assignmentSchema = z.object({
  serviceId: z.array(z.string().uuid()),
});

/**
 * A reusable service, as its two forms hold it.
 *
 * Field names are the `FormData` keys the actions read, so the form and the post
 * cannot drift apart. French is the editorial source language — a service with
 * no French name has nothing to translate from — while the other two languages
 * stay optional and are filled in as translators get to them.
 */
function serviceFormSchema(messages: FormMessages) {
  const optional = z.string();
  return z.object({
    categoryId: z.string().uuid(messages.required),
    icon: z.string().trim().min(1, messages.required).max(50, messages.tooLong),
    nameFr: z.string().trim().min(2, messages.tooShort),
    nameEn: optional,
    nameAr: optional,
    descriptionFr: optional,
    descriptionEn: optional,
    descriptionAr: optional,
    sourceNote: optional,
  });
}

type ServiceFormValues = z.infer<ReturnType<typeof serviceFormSchema>>;

const languageFields = {
  fr: { name: "nameFr", description: "descriptionFr" },
  en: { name: "nameEn", description: "descriptionEn" },
  ar: { name: "nameAr", description: "descriptionAr" },
} as const satisfies Record<
  EditorialLanguage,
  { name: keyof ServiceFormValues; description: keyof ServiceFormValues }
>;

function serviceDefaults(
  service: ManagedService | undefined,
  categories: readonly SearchableOption[],
): ServiceFormValues {
  return {
    categoryId: service?.categoryId ?? categories[0]?.value ?? "",
    icon: service?.icon ?? "help",
    nameFr: service?.names.fr ?? "",
    nameEn: service?.names.en ?? "",
    nameAr: service?.names.ar ?? "",
    descriptionFr: service?.descriptions.fr ?? "",
    descriptionEn: service?.descriptions.en ?? "",
    descriptionAr: service?.descriptions.ar ?? "",
    sourceNote: service?.sourceNote ?? "",
  };
}

/**
 * Create or edit a reusable service.
 *
 * Both actions read the same fields, so both dialogs render this: only the
 * identifiers they post and their submit wording differ, and those arrive as
 * `hidden` and `submitLabel`.
 */
function ReusableServiceForm({
  action,
  service,
  categories,
  labels,
  submitLabel,
  hidden,
  scopeControl,
}: {
  action: ServerFormAction<void>;
  service?: ManagedService;
  categories: readonly SearchableOption[];
  labels: Labels;
  submitLabel: string;
  /** The identifiers this action needs, as the inputs it reads them from. */
  hidden: ReactNode;
  /** Creation only: which organisation ends up owning the new service. */
  scopeControl?: ReactNode;
}) {
  const messages = useFormMessages(labels);
  const schema = useMemo(() => serviceFormSchema(messages), [messages]);
  const form = useWorkspaceForm({
    schema,
    defaultValues: serviceDefaults(service, categories),
  });
  const { formProps } = useServerFormAction({
    form,
    action,
    errorMessage: messages.saveFailed,
    // The dialog scrolls, so an invalid field can sit out of view.
    invalidMessage: messages.reviewFields,
  });
  const copy = (key: string) => readLabel(labels, key);

  return (
    <form {...formProps} className="grid gap-4 sm:grid-cols-2">
      {hidden}
      {scopeControl}
      <SearchableSelectFormField
        control={form.control}
        name="categoryId"
        label={copy("category")}
        options={categories}
        placeholder={copy("categoryPlaceholder")}
        emptyLabel={copy("noOptions")}
        className="sm:col-span-2"
        required
      />
      <TextFormField
        control={form.control}
        name="icon"
        label={copy("icon")}
        description={copy("iconHint")}
        maxLength={50}
        className="sm:col-span-2"
      />
      {editorialLanguages.map((language) => (
        <div
          key={language}
          className="border-line grid gap-3 rounded-lg border p-3 sm:col-span-2 sm:grid-cols-2"
          dir={editorialTextDirection(language)}
        >
          <TextFormField
            control={form.control}
            name={languageFields[language].name}
            label={copy(`name.${language}`)}
          />
          <TextAreaFormField
            control={form.control}
            name={languageFields[language].description}
            label={copy(`description.${language}`)}
            rows={2}
          />
        </div>
      ))}
      <TextFormField
        control={form.control}
        name="sourceNote"
        label={copy("sourceNote")}
        description={copy("sourceHint")}
        className="sm:col-span-2"
      />
      <FormSubmitButton
        control={form.control}
        className="sm:col-span-2 sm:justify-self-end"
      >
        {submitLabel}
      </FormSubmitButton>
    </form>
  );
}

/** The picker that says which reusable services this activity offers. */
function ServiceAssignmentForm({
  activityId,
  locale,
  assignedIds,
  options,
  labels,
}: {
  activityId: string;
  locale: string;
  assignedIds: readonly string[];
  options: readonly SearchableOption[];
  labels: Labels;
}) {
  const form = useWorkspaceForm({
    schema: assignmentSchema,
    defaultValues: { serviceId: [...assignedIds] },
  });
  const { formProps } = useServerFormAction({
    form,
    action: replaceActivityServices,
    errorMessage: readLabel(labels, "assignmentSaveError"),
    onSuccess: () => {
      toast.success(readLabel(labels, "assignmentSaved"));
    },
  });

  return (
    <form {...formProps} className="grid gap-3">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="activityId" value={activityId} />
      <SearchableMultiSelectFormField
        control={form.control}
        name="serviceId"
        options={options}
        label={readLabel(labels, "assignment")}
        placeholder={readLabel(labels, "assignmentPlaceholder")}
        emptyLabel={readLabel(labels, "empty")}
      />
      <FormSubmitButton
        control={form.control}
        variant="secondary"
        className="justify-self-end"
      >
        <Save aria-hidden />
        {readLabel(labels, "saveAssignment")}
      </FormSubmitButton>
    </form>
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
  /** Null when the platform holds the activity itself, rather than a custodian. */
  organizationId: string | null;
  locale: string;
  assignedIds: string[];
  services: ManagedService[];
  categories: SearchableOption[];
  labels: Labels;
  canManageGlobal?: boolean;
  /** Show the reusable-service catalogue management list below the picker. */
  showCatalogue?: boolean;
}) {
  const [createScope, setCreateScope] = useState<"organization" | "global">(
    "organization",
  );
  const copy = (key: string) => readLabel(labels, key);
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
      // A platform-held activity has no organisation catalogue, so the shared
      // entries are the only ones its editor could be managing here.
      (organizationId !== null && service.organizationId === organizationId) ||
      (canManageGlobal && service.organizationId === null),
  );

  return (
    <div className="grid gap-5">
      <ServiceAssignmentForm
        activityId={activityId}
        locale={locale}
        assignedIds={assignedIds}
        options={options}
        labels={labels}
      />

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
                <ReusableServiceForm
                  action={createAndAssignService}
                  categories={categories}
                  labels={labels}
                  submitLabel={copy("createAndAssign")}
                  hidden={
                    <>
                      <input type="hidden" name="locale" value={locale} />
                      <input
                        type="hidden"
                        name="activityId"
                        value={activityId}
                      />
                      <input
                        type="hidden"
                        name="organizationId"
                        value={
                          createScope === "global" ? "" : (organizationId ?? "")
                        }
                      />
                    </>
                  }
                  scopeControl={
                    canManageGlobal ? (
                      <Field className="sm:col-span-2">
                        <FieldLabel htmlFor="new-service-scope">
                          {copy("scope")}
                        </FieldLabel>
                        <SelectField
                          id="new-service-scope"
                          value={createScope}
                          onValueChange={(next) => {
                            setCreateScope(next as typeof createScope);
                          }}
                        >
                          <option value="organization">
                            {copy("scopeOrganization")}
                          </option>
                          <option value="global">{copy("scopeGlobal")}</option>
                        </SelectField>
                      </Field>
                    ) : null
                  }
                />
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
                    <ActionFeedbackForm
                      action={restoreReusableService}
                      successMessage={copy("restoreSuccess")}
                      errorMessage={readLabel(labels, "toast.actionError")}
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
                      <PendingButton variant="secondary">
                        <RotateCcw aria-hidden />
                        {copy("restore")}
                      </PendingButton>
                    </ActionFeedbackForm>
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
                          <ReusableServiceForm
                            action={updateReusableService}
                            service={service}
                            categories={categories}
                            labels={labels}
                            submitLabel={copy("save")}
                            hidden={
                              <>
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
                              </>
                            }
                          />
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
                            <ActionFeedbackForm
                              action={archiveReusableService}
                              successMessage={copy("archiveSuccess")}
                              errorMessage={readLabel(
                                labels,
                                "toast.actionError",
                              )}
                            >
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
                            </ActionFeedbackForm>
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
