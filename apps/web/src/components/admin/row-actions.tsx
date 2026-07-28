"use client";

import { MoreHorizontal, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { useActionErrorToast } from "~/components/admin/admin-ui-provider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

/** Somewhere this record can be opened: the workspace, or the public page. */
export type RowActionLink = {
  kind: "link";
  key: string;
  label: string;
  icon: LucideIcon;
  href: string;
  /** The public site is a different place; it opens beside the workspace. */
  newTab?: boolean;
};

/**
 * One operation on one record, run from the list. `confirm` is for the ones
 * that change what the public can see — everything else applies on click.
 */
export type RowActionCommand = {
  kind: "command";
  key: string;
  label: string;
  icon: LucideIcon;
  action: (formData: FormData) => Promise<void>;
  /** The action's own inputs, exactly as its schema reads them. */
  fields: Record<string, string>;
  /** What to say when it worked, and when it did not. */
  success: string;
  error: string;
  destructive?: boolean;
  confirm?: { title: string; body: string; confirm: string; cancel: string };
};

export type RowAction =
  RowActionLink | RowActionCommand | { kind: "separator"; key: string };

/**
 * The operations a single row carries, behind one menu button. Whether an item
 * is a destination or a server action is the caller's description of it, so
 * every list in the workspace opens the same menu in the same corner and asks
 * for confirmation the same way.
 *
 * Rendering an item is not a permission check: each action re-checks on the
 * server, and a refusal comes back as the toast the workspace uses everywhere.
 */
export function RowActions({
  label,
  actions,
}: {
  label: string;
  actions: RowAction[];
}) {
  const showActionError = useActionErrorToast();
  const [pending, startTransition] = useTransition();
  // Which confirmation is open, by action key — the dialogs are siblings of the
  // menu, because the menu has closed by the time one of them is needed.
  const [confirming, setConfirming] = useState<string | null>(null);

  const commands = actions.filter(
    (action): action is RowActionCommand => action.kind === "command",
  );

  const run = (command: RowActionCommand) => {
    startTransition(async () => {
      try {
        const formData = new FormData();
        for (const [name, value] of Object.entries(command.fields)) {
          formData.set(name, value);
        }
        await command.action(formData);
        setConfirming(null);
        toast.success(command.success);
      } catch (error) {
        showActionError(error, command.error);
      }
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={label}
            />
          }
        >
          <MoreHorizontal aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          {actions.map((action) => {
            if (action.kind === "separator") {
              return <DropdownMenuSeparator key={action.key} />;
            }
            if (action.kind === "link") {
              const Glyph = action.icon;
              return (
                <DropdownMenuItem
                  key={action.key}
                  render={
                    <Link
                      href={action.href}
                      target={action.newTab ? "_blank" : undefined}
                      rel={action.newTab ? "noreferrer" : undefined}
                    />
                  }
                >
                  <Glyph aria-hidden />
                  {action.label}
                </DropdownMenuItem>
              );
            }
            const Glyph = action.icon;
            return (
              <DropdownMenuItem
                key={action.key}
                variant={action.destructive ? "destructive" : undefined}
                disabled={pending}
                onClick={() => {
                  if (action.confirm) {
                    setConfirming(action.key);
                    return;
                  }
                  run(action);
                }}
              >
                <Glyph aria-hidden />
                {action.label}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {commands.map((command) =>
        command.confirm ? (
          <AlertDialog
            key={command.key}
            open={confirming === command.key}
            onOpenChange={(open) => {
              setConfirming(open ? command.key : null);
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{command.confirm.title}</AlertDialogTitle>
                <AlertDialogDescription>
                  {command.confirm.body}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{command.confirm.cancel}</AlertDialogCancel>
                <AlertDialogAction
                  type="button"
                  variant={command.destructive ? "destructive" : "default"}
                  disabled={pending}
                  onClick={() => {
                    run(command);
                  }}
                >
                  {command.confirm.confirm}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null,
      )}
    </>
  );
}
