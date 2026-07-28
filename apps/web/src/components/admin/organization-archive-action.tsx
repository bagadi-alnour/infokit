"use client";

import { Archive, Undo2 } from "lucide-react";

import { Button } from "~/components/admin/workspace";
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

type ArchiveAction = (formData: FormData) => Promise<void>;

export function OrganizationArchiveAction({
  action,
  locale,
  organizationId,
  archived,
  labels,
}: {
  action: ArchiveAction;
  locale: string;
  organizationId: string;
  archived: boolean;
  labels: {
    archive: string;
    restore: string;
    cancel: string;
    confirmTitle: string;
    confirmBody: string;
  };
}) {
  const fields = (
    <>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="organizationId" value={organizationId} />
    </>
  );

  if (archived) {
    return (
      <form action={action}>
        {fields}
        <input type="hidden" name="archive" value="false" />
        <PendingButton variant="secondary">
          <Undo2 aria-hidden />
          {labels.restore}
        </PendingButton>
      </form>
    );
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button type="button" variant="danger" />}>
        <Archive aria-hidden />
        {labels.archive}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{labels.confirmTitle}</AlertDialogTitle>
          <AlertDialogDescription>{labels.confirmBody}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{labels.cancel}</AlertDialogCancel>
          <form action={action}>
            {fields}
            <input type="hidden" name="archive" value="true" />
            <PendingButton variant="danger" className="w-full">
              <Archive aria-hidden />
              {labels.archive}
            </PendingButton>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
