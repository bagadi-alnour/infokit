"use client";

import { Field, Select } from "~/components/admin/workspace";
import { Checkbox } from "~/components/ui/checkbox";

import { reachText, type ReachValue, type SkillsLabels } from "./skills-rows";

/**
 * The three fields every skills form repeats: a yes/no, how far the row
 * reaches, and how long a declaration lasts. Written once so the create dialog
 * and the row editor cannot drift — a field missing from the editor would post
 * as blank and quietly clear the column.
 */

/**
 * A checkbox posts its value only when it is on, so `value="true"` is what the
 * actions read; an absent field is a plain "off".
 */
export function CheckboxField({
  name,
  label,
  hint,
  defaultChecked = false,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultChecked?: boolean;
}) {
  return (
    <div className="grid gap-1">
      <label className="border-line bg-subtle flex items-center gap-3 rounded-lg border p-3 text-sm">
        <Checkbox name={name} value="true" defaultChecked={defaultChecked} />
        <span className="font-medium">{label}</span>
      </label>
      {hint ? <p className="text-copy-muted text-xs">{hint}</p> : null}
    </div>
  );
}

/**
 * How far an association's row reaches. Only offered for a row that has an
 * owner: a platform row is network wide by definition, so there would be one
 * option to choose from.
 */
export function ReachField({
  labels,
  defaultValue = "organization",
  hint,
}: {
  labels: SkillsLabels;
  defaultValue?: ReachValue;
  hint?: string;
}) {
  return (
    <Field label={labels["skills.reach"]} hint={hint}>
      <Select name="visibility" defaultValue={defaultValue}>
        <option value="organization">
          {reachText(labels, "organization")}
        </option>
        <option value="all_organizations">
          {reachText(labels, "all_organizations")}
        </option>
        <option value="all_organizations_and_translators">
          {reachText(labels, "all_organizations_and_translators")}
        </option>
      </Select>
    </Field>
  );
}
