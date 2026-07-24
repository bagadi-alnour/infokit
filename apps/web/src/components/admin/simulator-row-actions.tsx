"use client";

import { Eye, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { archiveSimulatorFlow } from "~/app/[locale]/dashboard/simulator/actions";
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

export function SimulatorRowActions({
  locale,
  flowId,
  title,
  viewHref,
  editHref,
  archived,
  labels,
}: {
  locale: "fr" | "en" | "ar";
  flowId: string;
  title: string;
  viewHref: string;
  editHref: string;
  archived: boolean;
  labels: {
    actions: string;
    view: string;
    edit: string;
    delete: string;
    deleteTitle: string;
    deleteDescription: string;
    deleteConfirm: string;
    deleteSuccess: string;
    deleteError: string;
    cancel: string;
  };
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function remove() {
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("locale", locale);
        formData.set("flowId", flowId);
        await archiveSimulatorFlow(formData);
        setConfirmOpen(false);
        toast.success(labels.deleteSuccess);
        router.refresh();
      } catch {
        toast.error(labels.deleteError);
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={labels.actions}
            />
          }
        >
          <MoreHorizontal aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-40">
          <DropdownMenuItem render={<Link href={viewHref} target="_blank" />}>
            <Eye aria-hidden />
            {labels.view}
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href={editHref} />}>
            <Pencil aria-hidden />
            {labels.edit}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            disabled={archived}
            onClick={() => {
              setConfirmOpen(true);
            }}
          >
            <Trash2 aria-hidden />
            {labels.delete}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{labels.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {labels.deleteDescription.replace("{title}", title)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{labels.cancel}</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={remove}
            >
              {labels.deleteConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
