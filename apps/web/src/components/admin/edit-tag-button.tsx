"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";

import { Button, Field, Select, TextInput } from "~/components/admin/workspace";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";

export type EditTagLabels = {
  edit: string;
  name: string;
  namespace: string;
  color: string;
  visibility: string;
  visibilityPublic: string;
  visibilityWorkspace: string;
  save: string;
};

const COLOR_TOKENS = ["neutral", "accent", "ok", "warn", "danger"];

/** Inline editor for a tag's name, namespace, colour, and visibility. */
export function EditTagButton({
  action,
  locale,
  tagId,
  organizationId,
  name,
  namespace,
  colorToken,
  visibility,
  labels,
}: {
  action: (formData: FormData) => Promise<void>;
  locale: string;
  tagId: string;
  organizationId: string | null;
  name: string;
  namespace: string;
  colorToken: string;
  visibility: "public" | "workspace";
  labels: EditTagLabels;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={labels.edit}
        title={labels.edit}
        className="text-copy-muted hover:bg-subtle hover:text-ink focus-visible:ring-brand/50 inline-flex size-8 items-center justify-center rounded-md outline-none focus-visible:ring-2"
      >
        <Pencil className="size-4" aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <form action={action} className="grid gap-3 text-start">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="tagId" value={tagId} />
          <input
            type="hidden"
            name="scope"
            value={organizationId === null ? "global" : "org"}
          />
          {organizationId ? (
            <input type="hidden" name="organizationId" value={organizationId} />
          ) : null}
          <Field label={labels.name}>
            <TextInput
              name="labelFr"
              defaultValue={name}
              required
              minLength={2}
            />
          </Field>
          <Field label={labels.namespace}>
            <TextInput name="namespace" defaultValue={namespace} />
          </Field>
          <Field label={labels.color}>
            <Select name="colorToken" defaultValue={colorToken}>
              {COLOR_TOKENS.map((tone) => (
                <option key={tone} value={tone}>
                  {tone}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={labels.visibility}>
            <Select name="visibility" defaultValue={visibility}>
              <option value="public">{labels.visibilityPublic}</option>
              <option value="workspace">{labels.visibilityWorkspace}</option>
            </Select>
          </Field>
          <Button>{labels.save}</Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
