"use client";

import { Plus } from "lucide-react";
import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";

import { useActionErrorToast } from "~/components/admin/admin-ui-provider";
import { Chip, Field, Select } from "~/components/admin/workspace";
import { PendingButton } from "~/components/pending-button";
import { Button } from "~/components/ui/button";
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
import { Switch } from "~/components/ui/switch";

import type { CatalogueLabels, CatalogueRights } from "./catalogue-rows";
import { SelectControl } from "./select-control";

/**
 * Row controls the three catalogue tables share: where a row lives, whether
 * it is offered to editors, and the dialog that adds a new one.
 */

type Action = (formData: FormData) => Promise<void>;

/**
 * A server action that redirects is telling the destination page to explain
 * itself (duplicate name, still in use, permission denied). Toasting here as
 * well would say the same thing twice, in vaguer words.
 */
function isRedirectError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof error.digest === "string" &&
    error.digest.startsWith("NEXT_REDIRECT")
  );
}

/** Hidden fields every catalogue mutation needs to resolve its permission. */
function scopeFields(locale: string, organizationId: string | null) {
  return (
    <>
      <input type="hidden" name="locale" value={locale} />
      <input
        type="hidden"
        name="scope"
        value={organizationId === null ? "global" : "org"}
      />
      {organizationId ? (
        <input type="hidden" name="organizationId" value={organizationId} />
      ) : null}
    </>
  );
}

export function ScopeChip({
  organizationId,
  labels,
}: {
  organizationId: string | null;
  labels: CatalogueLabels;
}) {
  return organizationId === null ? (
    <Chip tone="neutral">{labels["catalogue.scope.chip.global"]}</Chip>
  ) : (
    <Chip tone="accent">{labels["catalogue.scope.chip.org"]}</Chip>
  );
}

/**
 * On/off for a catalogue row, flipped in place: turning a service off is the
 * everyday moderation move, so it costs one tap and reports its own outcome
 * rather than a page reload. Without the right to edit the row, the same state
 * is stated as a chip.
 */
export function ActiveToggle({
  action,
  idName,
  id,
  active,
  activeField = "active",
  organizationId,
  canEdit,
  locale,
  labels,
  onLabel,
  offLabel,
}: {
  action: Action;
  idName: string;
  id: string;
  active: boolean;
  /** `enabled` for categories, `active` everywhere else. */
  activeField?: "active" | "enabled";
  organizationId: string | null;
  canEdit: boolean;
  locale: string;
  labels: CatalogueLabels;
  /** State words for this row type: active/inactive or enabled/disabled. */
  onLabel: string;
  offLabel: string;
}) {
  const [pending, startTransition] = useTransition();
  const showActionError = useActionErrorToast();
  const state = active ? onLabel : offLabel;

  if (!canEdit) {
    return <Chip tone={active ? "ok" : "neutral"}>{state}</Chip>;
  }

  return (
    <span className="inline-flex items-center gap-2">
      <Switch
        checked={active}
        disabled={pending}
        aria-label={state}
        onCheckedChange={(next) => {
          startTransition(async () => {
            const formData = new FormData();
            formData.set("locale", locale);
            formData.set(idName, id);
            formData.set(activeField, String(next));
            formData.set("scope", organizationId === null ? "global" : "org");
            if (organizationId) {
              formData.set("organizationId", organizationId);
            }
            try {
              await action(formData);
            } catch (error) {
              if (!isRedirectError(error)) {
                showActionError(error, labels["catalogue.actionError"]);
              }
            }
          });
        }}
      />
      <span className="text-copy-muted text-xs">{state}</span>
    </span>
  );
}

/**
 * "New service / category / tag". The dialog keeps the list in view while the
 * form is open — the old page put a permanent form beside every table, which
 * read as five columns of work rather than one list plus one button.
 */
export function CatalogueCreateDialog({
  action,
  trigger,
  title,
  hint,
  submitLabel,
  createdMessage,
  labels,
  children,
  disabled = false,
}: {
  action: Action;
  trigger: string;
  title: string;
  hint: string;
  submitLabel: string;
  createdMessage: string;
  labels: CatalogueLabels;
  children: ReactNode;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const showActionError = useActionErrorToast();

  const submit = async (formData: FormData) => {
    try {
      await action(formData);
      toast.success(createdMessage);
      setOpen(false);
    } catch (error) {
      if (!isRedirectError(error)) {
        showActionError(error, labels["catalogue.actionError"]);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button className="min-h-9 gap-2" disabled={disabled} />}
      >
        <Plus className="size-4" aria-hidden />
        {trigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{hint}</DialogDescription>
        </DialogHeader>
        <form action={submit} className="grid gap-4">
          {children}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              {labels["catalogue.cancel"]}
            </DialogClose>
            <PendingButton>{submitLabel}</PendingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Platform rows, this association's rows, or both. */
export function ScopeFilter({
  scope,
  onChange,
  labels,
}: {
  scope: string;
  onChange: (value: string) => void;
  labels: CatalogueLabels;
}) {
  return (
    <SelectControl
      label={labels["catalogue.services.scope"]}
      value={scope}
      onValueChange={onChange}
      options={[
        { value: "", label: labels["catalogue.filter.anyScope"] },
        { value: "global", label: labels["catalogue.scope.chip.global"] },
        { value: "org", label: labels["catalogue.scope.chip.org"] },
      ]}
      className="w-40"
    />
  );
}

/**
 * On, off, or both. The state words differ by row type — a category is
 * enabled, a service is active — so the caller passes them in.
 */
export function StateFilter({
  state,
  onChange,
  labels,
  onLabel,
  offLabel,
}: {
  state: string;
  onChange: (value: string) => void;
  labels: CatalogueLabels;
  onLabel: string;
  offLabel: string;
}) {
  return (
    <SelectControl
      label={onLabel}
      value={state}
      onValueChange={onChange}
      options={[
        { value: "", label: labels["catalogue.filter.anyState"] },
        { value: "true", label: onLabel },
        { value: "false", label: offLabel },
      ]}
      className="w-40"
    />
  );
}

/**
 * Where a new row will live. A scope choice only appears for someone who may
 * write both scopes; otherwise the one scope they may write is a hidden field,
 * because a disabled dropdown asks a question with a single answer.
 */
export function NewRowScopeFields({
  rights,
  locale,
  labels,
}: {
  rights: CatalogueRights;
  locale: string;
  labels: CatalogueLabels;
}) {
  const { canManageGlobal, canManageOrg, scopeOrgId, scopeOrgName } = rights;
  if (canManageGlobal && canManageOrg && scopeOrgId) {
    return (
      <>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="organizationId" value={scopeOrgId} />
        <Field label={labels["catalogue.services.scope"]}>
          <Select name="scope" defaultValue="org">
            <option value="org">{scopeOrgName}</option>
            <option value="global">{labels["catalogue.scope.global"]}</option>
          </Select>
        </Field>
      </>
    );
  }
  return scopeFields(locale, canManageOrg ? scopeOrgId : null);
}
