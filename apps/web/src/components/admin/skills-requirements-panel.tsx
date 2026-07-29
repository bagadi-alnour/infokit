"use client";

import { formatMessage, type Locale } from "@infokit/shared/i18n";
import { useState } from "react";

import {
  addRequirementItem,
  createRequirementSet,
  deleteRequirementSet,
  removeRequirementItem,
} from "~/app/[locale]/dashboard/skills/actions";
import {
  Card,
  Chip,
  EmptyState,
  Field,
  Notice,
  Select,
  Table,
  TableBody,
  TableHeader,
  TableRow,
  TD,
  TextArea,
  TextInput,
  TH,
} from "~/components/admin/workspace";

import { CatalogueCreateDialog } from "./catalogue-row-controls";
import { DeleteButton } from "./delete-button";
import { SearchableSelect } from "./searchable-select";
import { CheckboxField } from "./skills-fields";
import {
  minimumCountText,
  necessityText,
  targetGroupText,
  type RequirementItemRow,
  type RequirementSetRow,
  type RequirementTargetOption,
  type SkillsLabels,
} from "./skills-rows";

/**
 * Requirement sets — what a kind of mission asks of the people carrying it,
 * written down before the mission exists. Nothing points at a set yet: planning
 * will, and until then this is the association reading its own conditions back.
 *
 * A set is a card and its conditions are its rows, rather than one flat table of
 * conditions: the set is the unit somebody thinks in ("what does a maraude
 * need?"), and a condition on its own says very little.
 */

/**
 * One condition. The target is a single picker over three lists — skills,
 * courses, languages — because the person adding it is looking for a name, not
 * deciding which of our tables it lives in. The group travels in the value
 * (`skill:<uuid>`) and shows under the option, since `SelectField` drops
 * `<optgroup>` labels.
 */
function AddConditionDialog({
  setId,
  organizationId,
  targets,
  locale,
  labels,
}: {
  setId: string;
  organizationId: string;
  targets: RequirementTargetOption[];
  locale: Locale;
  labels: SkillsLabels;
}) {
  const [target, setTarget] = useState("");

  return (
    <CatalogueCreateDialog
      action={async (formData) => {
        await addRequirementItem(formData);
        setTarget("");
      }}
      trigger={labels["skills.requirements.addItem"]}
      title={labels["skills.requirements.addItem"]}
      hint={labels["skills.requirements.addItemHint"]}
      submitLabel={labels["skills.add"]}
      createdMessage={labels["skills.requirements.itemAdded"]}
      labels={labels}
    >
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="setId" value={setId} />
      <Field label={labels["skills.requirements.target"]}>
        <SearchableSelect
          name="target"
          options={targets}
          value={target}
          onValueChange={setTarget}
          label={labels["skills.requirements.target"]}
          placeholder={labels["skills.requirements.addItemHint"]}
          emptyLabel={labels.table.noMatch}
          required
        />
      </Field>
      <Field label={labels["skills.requirements.necessity"]}>
        <Select name="necessity" defaultValue="required">
          <option value="required">{necessityText(labels, "required")}</option>
          <option value="preferred">
            {necessityText(labels, "preferred")}
          </option>
        </Select>
      </Field>
      <Field
        label={labels["skills.requirements.minimumCount"]}
        hint={labels["skills.requirements.minimumCountHint"]}
      >
        <TextInput name="minimumCount" type="number" min={1} max={100} />
      </Field>
      <CheckboxField
        name="mustBeVerified"
        label={labels["skills.requirements.mustBeVerified"]}
      />
      <CheckboxField
        name="mustBeCurrent"
        label={labels["skills.requirements.mustBeCurrent"]}
      />
      <details className="text-copy-muted text-sm">
        <summary className="cursor-pointer">
          {labels["catalogue.optional"]}
        </summary>
        <div className="mt-2 grid gap-3">
          <Field label={labels["skills.requirements.note"]}>
            <TextArea name="note" rows={2} />
          </Field>
        </div>
      </details>
    </CatalogueCreateDialog>
  );
}

/** The group, the flags and the note read as one muted line under the name. */
function conditionDetail(
  item: RequirementItemRow,
  labels: SkillsLabels,
): string {
  const parts = [
    targetGroupText(labels, item.group),
    minimumCountText(labels, item.minimumCount),
  ];
  if (item.mustBeVerified) {
    parts.push(labels["skills.requirements.mustBeVerified"]);
  }
  if (item.mustBeCurrent) {
    parts.push(labels["skills.requirements.mustBeCurrent"]);
  }
  if (item.note) parts.push(item.note);
  return parts.join(" · ");
}

export function SkillsRequirementsPanel({
  sets,
  targets,
  organizationId,
  canManage,
  locale,
  labels,
}: {
  sets: RequirementSetRow[];
  targets: RequirementTargetOption[];
  /** Null when no association is in scope — then there is nothing to write to. */
  organizationId: string | null;
  canManage: boolean;
  locale: Locale;
  labels: SkillsLabels;
}) {
  const canWrite = canManage && organizationId !== null;

  return (
    <div className="grid gap-4">
      <Notice title={labels["skills.requirements.title"]}>
        {labels["skills.requirements.note"]}
      </Notice>
      {canWrite ? null : (
        <Notice tone="warn" title={labels["skills.requirements.title"]}>
          {labels["skills.requirements.readonly"]}
        </Notice>
      )}
      {canWrite && organizationId ? (
        <div className="flex justify-end">
          <CatalogueCreateDialog
            action={createRequirementSet}
            trigger={labels["skills.requirements.new"]}
            title={labels["skills.requirements.new"]}
            hint={labels["skills.requirements.newHint"]}
            submitLabel={labels["skills.add"]}
            createdMessage={labels["skills.requirements.created"]}
            labels={labels}
          >
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="organizationId" value={organizationId} />
            <Field label={labels["skills.requirements.name"]}>
              <TextInput
                name="name"
                required
                minLength={2}
                autoComplete="off"
                placeholder="Maraude"
              />
            </Field>
            <Field
              label={labels["skills.requirements.code"]}
              hint={labels["skills.codeHint"]}
            >
              <TextInput name="code" placeholder="maraude" required />
            </Field>
            <details className="text-copy-muted text-sm">
              <summary className="cursor-pointer">
                {labels["catalogue.optional"]}
              </summary>
              <div className="mt-2 grid gap-3">
                <Field label={labels["skills.requirements.description"]}>
                  <TextArea name="description" rows={2} />
                </Field>
              </div>
            </details>
          </CatalogueCreateDialog>
        </div>
      ) : null}
      {sets.length === 0 ? (
        <EmptyState>{labels["skills.requirements.empty"]}</EmptyState>
      ) : (
        <div className="grid gap-4">
          {sets.map((set) => (
            <Card
              key={set.id}
              title={set.name}
              hint={set.description || undefined}
              action={
                canWrite && organizationId ? (
                  <span className="inline-flex items-center gap-1">
                    <AddConditionDialog
                      setId={set.id}
                      organizationId={organizationId}
                      targets={targets}
                      locale={locale}
                      labels={labels}
                    />
                    <DeleteButton
                      action={deleteRequirementSet}
                      idName="setId"
                      id={set.id}
                      organizationId={organizationId}
                      locale={locale}
                      labels={{
                        delete: labels["skills.requirements.deleteSet"],
                        confirm: labels["catalogue.deleteConfirm"],
                        hint: labels["catalogue.deleteHint"],
                        cancel: labels["catalogue.cancel"],
                      }}
                    />
                  </span>
                ) : null
              }
            >
              <p className="text-copy-muted mb-3 text-xs">
                <span className="font-mono">{set.code}</span>
                {" · "}
                {formatMessage(labels["skills.requirements.itemCount"], {
                  count: String(set.items.length),
                })}
              </p>
              {set.items.length === 0 ? (
                <p className="text-copy-muted text-sm">
                  {labels["skills.requirements.noItems"]}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TH>{labels["skills.requirements.target"]}</TH>
                        <TH>{labels["skills.requirements.necessity"]}</TH>
                        <TH className="text-end">
                          {labels["catalogue.column.actions"]}
                        </TH>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {set.items.map((item) => (
                        <TableRow key={item.id}>
                          <TD>
                            <span className="font-medium">{item.label}</span>
                            <p className="text-copy-muted text-xs">
                              {conditionDetail(item, labels)}
                            </p>
                          </TD>
                          <TD>
                            <Chip
                              tone={
                                item.necessity === "required"
                                  ? "accent"
                                  : "neutral"
                              }
                            >
                              {necessityText(labels, item.necessity)}
                            </Chip>
                          </TD>
                          <TD className="text-end">
                            {canWrite && organizationId ? (
                              <DeleteButton
                                action={removeRequirementItem}
                                idName="itemId"
                                id={item.id}
                                organizationId={organizationId}
                                locale={locale}
                                labels={{
                                  delete:
                                    labels["skills.requirements.removeItem"],
                                  confirm: labels["catalogue.deleteConfirm"],
                                  hint: labels["catalogue.deleteHint"],
                                  cancel: labels["catalogue.cancel"],
                                }}
                              />
                            ) : null}
                          </TD>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
