"use client";

import { Archive, Pencil, RotateCcw, Tags } from "lucide-react";

import {
  setGlobalTagActive,
  updateGlobalTag,
} from "~/app/[locale]/dashboard/articles/tag-actions";
import { ActionFeedbackForm } from "~/components/admin/action-feedback-form";
import { PendingButton } from "~/components/pending-button";
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
import { Input } from "~/components/ui/input";

export function GlobalTagManager({
  locale,
  tags,
  labels,
}: {
  locale: string;
  tags: { id: string; label: string; active: boolean }[];
  labels: Record<string, string>;
}) {
  const copy = (key: string) => labels[key] ?? key;
  return (
    <Dialog>
      <DialogTrigger render={<Button type="button" variant="outline" />}>
        <Tags aria-hidden />
        {copy("tag.manageGlobal")}
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{copy("tag.manageGlobalTitle")}</DialogTitle>
          <DialogDescription>{copy("tag.manageGlobalHint")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {tags.map((tag) => (
            <div
              key={tag.id}
              className="border-line grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_auto]"
            >
              <ActionFeedbackForm
                action={updateGlobalTag}
                successMessage={copy("tag.updated")}
                errorMessage={copy("toast.actionError")}
                className="flex min-w-0 gap-2"
              >
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="tagId" value={tag.id} />
                <Input
                  name="label"
                  defaultValue={tag.label}
                  maxLength={120}
                  required
                  disabled={!tag.active}
                  aria-label={copy("tag.update")}
                />
                {tag.active ? (
                  <PendingButton variant="ghost" className="size-9 px-0">
                    <Pencil aria-hidden />
                    <span className="sr-only">{copy("tag.update")}</span>
                  </PendingButton>
                ) : null}
              </ActionFeedbackForm>
              <ActionFeedbackForm
                action={setGlobalTagActive}
                successMessage={copy(
                  tag.active ? "tag.archiveDone" : "tag.restoreDone",
                )}
                errorMessage={copy("toast.actionError")}
                className="flex items-center gap-2"
              >
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="tagId" value={tag.id} />
                <input
                  type="hidden"
                  name="active"
                  value={tag.active ? "false" : "true"}
                />
                {!tag.active ? (
                  <Badge variant="secondary">{copy("tag.archived")}</Badge>
                ) : null}
                <PendingButton variant="ghost" className="min-h-9 px-3 text-sm">
                  {tag.active ? (
                    <Archive aria-hidden />
                  ) : (
                    <RotateCcw aria-hidden />
                  )}
                  {copy(tag.active ? "tag.archive" : "tag.restore")}
                </PendingButton>
              </ActionFeedbackForm>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
