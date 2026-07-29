"use client";

import { useState } from "react";

import {
  SearchableMultiSelect,
  type SearchableOption,
} from "~/components/admin/searchable-select";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Field, FieldDescription } from "~/components/ui/field";
import { SelectField } from "~/components/ui/select-field";
import { readLabel, type Labels } from "~/lib/form-messages";

/**
 * The four short record-level choices that are understood as one editorial
 * decision. Their inputs belong to the activity editor's external form so the
 * page has one save action without nesting forms.
 */
export function ActivityDetailsForm({
  formId,
  categories,
  audiences,
  tags,
  services,
  initialCategoryId,
  initialAudienceId,
  initialTagIds,
  initialServiceIds,
  labels,
}: {
  formId: string;
  categories: SearchableOption[];
  audiences: SearchableOption[];
  tags: SearchableOption[];
  services: SearchableOption[];
  initialCategoryId: string;
  initialAudienceId: string;
  initialTagIds: string[];
  initialServiceIds: string[];
  labels: Labels;
}) {
  const [selectedTagIds, setSelectedTagIds] = useState(initialTagIds);
  const [selectedServiceIds, setSelectedServiceIds] =
    useState(initialServiceIds);

  return (
    <>
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle className="text-base">
            {readLabel(labels, "table.category")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Field>
            <SelectField
              id="activity-category"
              name="categoryId"
              form={formId}
              defaultValue={initialCategoryId}
              aria-label={readLabel(labels, "table.category")}
              required
            >
              {categories.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectField>
          </Field>
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle className="text-base">
            {readLabel(labels, "table.audience")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Field>
            <SelectField
              id="activity-audience"
              name="audienceCategoryId"
              form={formId}
              defaultValue={initialAudienceId}
              aria-label={readLabel(labels, "table.audience")}
              required
            >
              {audiences.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectField>
          </Field>
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle className="text-base">
            {readLabel(labels, "activity.create.tags")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Field>
            {tags.length > 0 ? (
              <SearchableMultiSelect
                name="tagId"
                form={formId}
                maxSelections={3}
                options={tags}
                value={selectedTagIds}
                onValueChange={setSelectedTagIds}
                label={readLabel(labels, "activity.create.tags")}
                placeholder={readLabel(labels, "activity.create.chooseTags")}
                emptyLabel={readLabel(labels, "activity.create.noMatch")}
              />
            ) : (
              <p className="text-copy-muted text-sm">
                {readLabel(labels, "editor.tagsEmpty")}
              </p>
            )}
            <FieldDescription>
              {readLabel(labels, "editor.tagsHint")}
            </FieldDescription>
          </Field>
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle className="text-base">
            {readLabel(labels, "activity.services")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {services.length > 0 ? (
            <SearchableMultiSelect
              name="serviceId"
              form={formId}
              options={services}
              value={selectedServiceIds}
              onValueChange={setSelectedServiceIds}
              label={readLabel(labels, "activity.services")}
              placeholder={readLabel(
                labels,
                "serviceManager.assignmentPlaceholder",
              )}
              emptyLabel={readLabel(labels, "serviceManager.empty")}
            />
          ) : (
            <p className="text-copy-muted text-sm">
              {readLabel(labels, "serviceManager.empty")}
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
