"use client";

import { Pencil, Plus, type LucideIcon } from "lucide-react";
import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";

import { useActionErrorToast } from "~/components/admin/admin-ui-provider";
import { TooltipHint } from "~/components/admin/tooltip-hint";
import {
  Button as FormButton,
  Chip,
  Field,
  Select,
} from "~/components/admin/workspace";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Switch } from "~/components/ui/switch";
import { cn } from "~/lib/utils";

import {
  stateWords,
  type CatalogueLabels,
  type CatalogueRights,
  type StateKind,
} from "./catalogue-rows";
import { SelectControl } from "./select-control";

/**
 * Row controls the three catalogue tables share: where a row lives, whether
 * it is offered to editors, how it is edited in place, and the dialog that adds
 * a new one.
 */

type Action = (formData: FormData) => Promise<void>;

/**
 * A server action that redirects is telling the destination page to explain
 * itself (duplicate name, still in use, permission denied). Toasting here as
 * well would say the same thing twice, in vaguer words.
 */
export function isRedirectError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof error.digest === "string" &&
    error.digest.startsWith("NEXT_REDIRECT")
  );
}

/**
 * The hidden fields a catalogue mutation needs to resolve its permission.
 * Leaving `organizationId` out says the row has no scope to post at all —
 * categories are platform-wide by design.
 */
export function RowScopeFields({
  locale,
  organizationId,
}: {
  locale: string;
  organizationId?: string | null;
}) {
  return (
    <>
      <input type="hidden" name="locale" value={locale} />
      {organizationId === undefined ? null : (
        <>
          <input
            type="hidden"
            name="scope"
            value={organizationId === null ? "global" : "org"}
          />
          {organizationId ? (
            <input type="hidden" name="organizationId" value={organizationId} />
          ) : null}
        </>
      )}
    </>
  );
}

/**
 * The glyph that opens a row's popover. Rows are dense enough that only an icon
 * fits, so the name lives in the tooltip and in `aria-label`; deleting is the
 * same control in a warning tone.
 */
export function RowActionTrigger({
  label,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  icon: LucideIcon;
  tone?: "default" | "danger";
}) {
  return (
    <TooltipHint label={label}>
      <PopoverTrigger
        aria-label={label}
        className={cn(
          "text-copy-muted inline-flex size-8 items-center justify-center rounded-md outline-none focus-visible:ring-2",
          tone === "danger"
            ? "hover:bg-danger-soft hover:text-danger focus-visible:ring-danger/50"
            : "hover:bg-subtle hover:text-ink focus-visible:ring-brand/50",
        )}
      >
        <Icon className="size-4" aria-hidden />
      </PopoverTrigger>
    </TooltipHint>
  );
}

/**
 * The editor behind a row's pencil: a small form beside the row rather than a
 * trip to another screen, because the everyday correction is one field. Every
 * catalogue row is edited the same way — the row's id and its scope travel as
 * hidden fields so the action applies the matching permission — so only the
 * fields inside differ.
 */
export function RowEditPopover({
  action,
  label,
  save,
  locale,
  idName,
  id,
  organizationId,
  children,
}: {
  action: Action;
  /** Names the pencil, for the tooltip and for screen readers. */
  label: string;
  save: string;
  locale: string;
  /** The field the row id is posted as: `serviceId`, `categoryId`, `tagId`. */
  idName: string;
  id: string;
  /** Left out for a platform-only row, which has no scope to post. */
  organizationId?: string | null;
  children: ReactNode;
}) {
  return (
    <Popover>
      <RowActionTrigger label={label} icon={Pencil} />
      <PopoverContent align="end" className="w-80">
        <form action={action} className="grid gap-3 text-start">
          <RowScopeFields locale={locale} organizationId={organizationId} />
          <input type="hidden" name={idName} value={id} />
          {children}
          <FormButton>{save}</FormButton>
        </form>
      </PopoverContent>
    </Popover>
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
  kind = "active",
  organizationId,
  canEdit,
  locale,
  labels,
}: {
  action: Action;
  idName: string;
  id: string;
  active: boolean;
  /** Names the field posted and the words shown; `enabled` for categories. */
  kind?: StateKind;
  organizationId: string | null;
  canEdit: boolean;
  locale: string;
  labels: CatalogueLabels;
}) {
  const [pending, startTransition] = useTransition();
  const showActionError = useActionErrorToast();
  const words = stateWords(labels, kind);
  const state = active ? words.on : words.off;

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
            formData.set(kind, String(next));
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

/** On, off, or both — in this row type's own words. */
export function StateFilter({
  state,
  onChange,
  labels,
  kind = "active",
}: {
  state: string;
  onChange: (value: string) => void;
  labels: CatalogueLabels;
  kind?: StateKind;
}) {
  const { on, off } = stateWords(labels, kind);
  return (
    <SelectControl
      label={on}
      value={state}
      onValueChange={onChange}
      options={[
        { value: "", label: labels["catalogue.filter.anyState"] },
        { value: "true", label: on },
        { value: "false", label: off },
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
  return (
    <RowScopeFields
      locale={locale}
      organizationId={canManageOrg ? scopeOrgId : null}
    />
  );
}
