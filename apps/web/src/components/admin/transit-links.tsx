"use client";

import { Plus, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { useActionErrorToast } from "~/components/admin/admin-ui-provider";
import { TooltipHint } from "~/components/admin/tooltip-hint";
import { Field, Select, TextInput } from "~/components/admin/workspace";
import { PendingButton } from "~/components/pending-button";
import { Button } from "~/components/ui/button";
import {
  EMPTY_TRANSIT_LINK,
  MAX_TRANSIT_LINKS,
  MAX_WALK_MINUTES,
  TRANSIT_CARRIED_FIELD,
  TRANSIT_FIELDS,
  transitLinkValues,
  transitModes,
  type TransitLink,
  type TransitLinkValues,
  type TransitMode,
} from "~/lib/transit-links";

function label(labels: Record<string, string>, key: string) {
  return labels[key] ?? key;
}

/** A row plus the key React needs to keep it still while its neighbours move. */
interface Row {
  key: number;
  values: TransitLinkValues;
}

/**
 * The "how do people get here without a car" fieldset: one row per useful line,
 * each naming the mode, the line as the network prints it, the stop to get off
 * at, and how long the walk is from there.
 *
 * Identical on an activity and on an event, because the question is identical —
 * an editor learns it once. Drop it inside an existing `<form>`: it renders
 * inputs and nothing else, and the matching server action reads them back with
 * `parseTransitLinks`. The words come from the shared console catalogue, so both
 * hosts name the fields the same way while each keeps its own section heading.
 *
 * Every row posts under the same four names and is read index-aligned, the way
 * the opening hours already travel. The hidden marker goes with them so that an
 * editor who deletes the last row is saying something — "there are none" —
 * rather than nothing at all.
 *
 * The rows are held here rather than in React Hook Form: nothing else on either
 * page reads them, and staying out of the form's value type is what lets one
 * component serve two forms that share no shape.
 */
export function TransitLinkFields({
  links,
  labels,
  formId,
}: {
  links: readonly TransitLink[];
  labels: Record<string, string>;
  /** Associate these inputs with a form elsewhere on the page. */
  formId?: string;
}) {
  // Keys are handed out, never derived from the index: a removed row must not
  // pass its state to the row that takes its place.
  const nextKey = useRef(links.length);
  const [rows, setRows] = useState<Row[]>(() =>
    links.map((link, index) => ({
      key: index,
      values: transitLinkValues(link),
    })),
  );

  const addRow = () => {
    const key = nextKey.current;
    nextKey.current += 1;
    setRows((current) => [...current, { key, values: EMPTY_TRANSIT_LINK }]);
  };

  const patchRow = (key: number, patch: Partial<TransitLinkValues>) => {
    setRows((current) =>
      current.map((row) =>
        row.key === key ? { ...row, values: { ...row.values, ...patch } } : row,
      ),
    );
  };

  const removeRow = (key: number) => {
    setRows((current) => current.filter((row) => row.key !== key));
  };

  return (
    <div className="@container grid min-w-0 gap-3">
      <input
        type="hidden"
        name={TRANSIT_CARRIED_FIELD}
        value="1"
        form={formId}
      />

      {rows.length === 0 ? (
        <p className="text-copy-muted text-sm">
          {label(labels, "transit.empty")}
        </p>
      ) : null}

      {rows.map((row) => (
        <div
          key={row.key}
          className="border-line bg-subtle @2xl:grid-cols-2 @4xl:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1.35fr)_minmax(0,0.8fr)_auto] @2xl:items-end grid min-w-0 gap-3 rounded-lg border p-3"
        >
          <div className="min-w-0">
            <Field label={label(labels, "transit.mode")}>
              <Select
                name={TRANSIT_FIELDS.mode}
                form={formId}
                value={row.values.mode}
                onValueChange={(next) => {
                  patchRow(row.key, { mode: next as TransitMode });
                }}
              >
                {transitModes.map((mode) => (
                  <option key={mode} value={mode}>
                    {label(labels, `transit.mode.${mode}`)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="min-w-0">
            <Field label={label(labels, "transit.line")}>
              <TextInput
                name={TRANSIT_FIELDS.line}
                form={formId}
                value={row.values.line}
                onChange={(event) => {
                  patchRow(row.key, { line: event.target.value });
                }}
                maxLength={40}
                autoComplete="off"
              />
            </Field>
          </div>
          <div className="@2xl:col-span-2 @4xl:col-span-1 min-w-0">
            <Field label={label(labels, "transit.stop")}>
              <TextInput
                name={TRANSIT_FIELDS.stopName}
                form={formId}
                value={row.values.stopName}
                onChange={(event) => {
                  patchRow(row.key, { stopName: event.target.value });
                }}
                maxLength={120}
                autoComplete="off"
              />
            </Field>
          </div>
          <div className="min-w-0">
            <Field label={label(labels, "transit.walk")}>
              <TextInput
                name={TRANSIT_FIELDS.walkMinutes}
                form={formId}
                value={row.values.walkMinutes}
                onChange={(event) => {
                  patchRow(row.key, { walkMinutes: event.target.value });
                }}
                type="number"
                inputMode="numeric"
                min={0}
                max={MAX_WALK_MINUTES}
                autoComplete="off"
              />
            </Field>
          </div>
          <div className="@2xl:justify-self-end @4xl:justify-self-auto">
            <TooltipHint label={label(labels, "transit.remove")}>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={label(labels, "transit.remove")}
                onClick={() => {
                  removeRow(row.key);
                }}
              >
                <X aria-hidden />
              </Button>
            </TooltipHint>
          </div>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        className="justify-self-start"
        onClick={addRow}
        disabled={rows.length >= MAX_TRANSIT_LINKS}
      >
        <Plus aria-hidden />
        {label(labels, "transit.add")}
      </Button>
      <p className="text-copy-muted text-xs">
        {label(labels, "transit.detailHint")}
      </p>
    </div>
  );
}

/**
 * The same fieldset as a form that saves nothing but itself, for a record whose
 * editor is spread over several cards — the activity console. Recording that the
 * 5 stops outside is then a save of its own, not a re-submission of the whole
 * activity.
 *
 * The action is passed in so each content type keeps its own permission gate,
 * and the record travels as `recordId`, the name the small console actions read.
 */
export function TransitLinkForm({
  action,
  locale,
  recordId,
  links,
  labels,
}: {
  action: (formData: FormData) => Promise<void>;
  locale: string;
  recordId: string;
  links: readonly TransitLink[];
  /** The shared console catalogue — the wording is the same everywhere. */
  labels: Record<string, string>;
}) {
  const showActionError = useActionErrorToast();
  const submit = async (formData: FormData) => {
    try {
      await action(formData);
      toast.success(label(labels, "transit.saved"));
    } catch (error) {
      showActionError(error, label(labels, "transit.saveError"));
    }
  };
  return (
    <form action={submit} className="grid gap-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="recordId" value={recordId} />
      <TransitLinkFields links={links} labels={labels} />
      <div>
        <PendingButton>{label(labels, "transit.save")}</PendingButton>
      </div>
    </form>
  );
}

/**
 * The same links on a read-only record page. Shown only when somebody recorded
 * one: an empty list would read as "you cannot get here on public transport",
 * which is a different and worse statement than saying nothing.
 */
export function TransitLinkSummary({
  links,
  labels,
  className,
}: {
  links: readonly TransitLink[];
  labels: Record<string, string>;
  className?: string;
}) {
  if (links.length === 0) return null;
  return (
    <ul className={className ?? "grid gap-1 text-sm"}>
      {links.map((link, index) => (
        <li key={index} className="flex flex-wrap gap-x-2">
          <span className="text-copy-muted">
            {label(labels, `transit.mode.${link.mode}`)}
          </span>
          <span>
            {[
              link.line,
              link.stopName,
              link.walkMinutes === null
                ? null
                : label(labels, "transit.walkShort").replace(
                    "{minutes}",
                    String(link.walkMinutes),
                  ),
            ]
              .filter((part) => part !== null)
              .join(" · ")}
          </span>
        </li>
      ))}
    </ul>
  );
}
