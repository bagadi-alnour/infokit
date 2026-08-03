"use client";

import { useMemo, useState } from "react";

import { PlaceAddressFields } from "~/components/address/place-address-fields";
import {
  SearchableSelect,
  type SearchableOption,
} from "~/components/admin/searchable-select";
import { Field, FieldDescription, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { SelectField } from "~/components/ui/select-field";
import {
  activityLocationModes,
  activityScopes,
  placePrecisions,
  type ActivityLocationMode,
  type ActivityScope,
} from "~/lib/activity-rules";

type Labels = Record<string, string>;

function readLabel(labels: Labels, key: string): string {
  return labels[key] ?? key;
}

export interface ActivityLocationValues {
  scope: ActivityScope;
  cityId: string;
  placeId: string;
  /** The place's current address, so an edit starts from what is there. */
  addressLine: string;
}

/**
 * Where an activity happens, after it exists.
 *
 * A service moves: a drop-in changes premises, a city entry turns out to be the
 * wrong city, an address was guessed on the day the record was made. Until now
 * the only screen that could say any of this was the one that created the
 * record, which left the correction to a re-creation — and the translations,
 * schedule and photo do not come along.
 *
 * The same three answers the creation form asks, in the same order, so an editor
 * who has made an activity recognises this: which city, then whether the place
 * already exists, is being described now, or does not apply.
 */
export function ActivityLocationForm({
  formId,
  cities,
  places,
  initial,
  labels,
}: {
  /** The page-level Save these fields belong to. */
  formId: string;
  cities: SearchableOption[];
  /** Every place, with its city, so the list narrows as the city changes. */
  places: (SearchableOption & { cityId: string })[];
  initial: ActivityLocationValues;
  labels: Labels;
}) {
  const [scope, setScope] = useState<ActivityScope>(initial.scope);
  const [cityId, setCityId] = useState(initial.cityId);
  const [mode, setMode] = useState<ActivityLocationMode>(
    initial.placeId ? "existing" : "mobile",
  );
  const [placeId, setPlaceId] = useState(initial.placeId);
  const copy = (key: string) => readLabel(labels, key);

  /** A place belongs to one city, so only that city's places can be chosen. */
  const placeOptions = useMemo(
    () => places.filter((place) => place.cityId === cityId),
    [cityId, places],
  );

  /**
   * A global activity is nowhere in particular: it carries no city and no
   * place, and the server reads it that way whatever these fields hold.
   */
  const posted = {
    scope,
    cityId: scope === "global" ? "" : cityId,
    locationMode: scope === "global" ? "mobile" : mode,
    placeId: scope === "global" || mode !== "existing" ? "" : placeId,
  };

  return (
    <div className="grid min-w-0 gap-4">
      <input type="hidden" name="scope" form={formId} value={posted.scope} />
      <input type="hidden" name="cityId" form={formId} value={posted.cityId} />
      <input
        type="hidden"
        name="locationMode"
        form={formId}
        value={posted.locationMode}
      />
      <input
        type="hidden"
        name="placeId"
        form={formId}
        value={posted.placeId}
      />

      <div className="@md:grid-cols-2 grid min-w-0 gap-4">
        <Field>
          <FieldLabel htmlFor="activity-scope">
            {copy("activity.create.scope")}
          </FieldLabel>
          <SelectField
            id="activity-scope"
            value={scope}
            onValueChange={(next) => {
              setScope(next as ActivityScope);
            }}
          >
            {activityScopes.map((value) => (
              <option key={value} value={value}>
                {copy(
                  value === "global"
                    ? "activity.create.scopeGlobal"
                    : "activity.create.scopeCity",
                )}
              </option>
            ))}
          </SelectField>
          <FieldDescription>
            {copy(
              scope === "global"
                ? "activity.create.scopeGlobalHint"
                : "activity.create.scopeCityHint",
            )}
          </FieldDescription>
        </Field>
        {scope === "city" ? (
          <Field>
            <FieldLabel htmlFor="activity-city">
              {copy("activity.create.city")}
            </FieldLabel>
            <SearchableSelect
              id="activity-city"
              /* The value travels in the hidden input above: the city and the
               * place have to be cleared together, and only this component
               * knows that. */
              name="cityIdChoice"
              options={cities}
              value={cityId}
              onValueChange={(next) => {
                setCityId(next);
                setPlaceId("");
              }}
              label={copy("activity.create.city")}
              placeholder={copy("activity.create.chooseCity")}
              emptyLabel={copy("activity.create.noMatch")}
            />
          </Field>
        ) : null}
      </div>

      {scope === "global" ? (
        <p className="border-line bg-subtle rounded-lg border p-4 text-sm">
          {copy("activity.create.globalLocationHint")}
        </p>
      ) : (
        <>
          <Field>
            <FieldLabel htmlFor="activity-location-mode">
              {copy("activity.create.locationType")}
            </FieldLabel>
            <SelectField
              id="activity-location-mode"
              value={mode}
              onValueChange={(next) => {
                setMode(next as ActivityLocationMode);
              }}
            >
              {activityLocationModes.map((value) => (
                <option key={value} value={value}>
                  {copy(
                    value === "existing"
                      ? "activity.create.existingPlace"
                      : value === "new"
                        ? "activity.create.newPlace"
                        : "activity.create.mobile",
                  )}
                </option>
              ))}
            </SelectField>
          </Field>
          {mode === "existing" ? (
            <Field>
              <FieldLabel htmlFor="activity-place">
                {copy("activity.create.place")}
              </FieldLabel>
              <SearchableSelect
                id="activity-place"
                name="placeIdChoice"
                options={placeOptions}
                value={placeId}
                onValueChange={setPlaceId}
                label={copy("activity.create.place")}
                placeholder={copy("activity.create.choosePlace")}
                emptyLabel={copy("activity.create.noPlaces")}
              />
            </Field>
          ) : mode === "new" ? (
            <div className="border-line grid gap-4 rounded-lg border p-4">
              <Field>
                <FieldLabel htmlFor="activity-place-name">
                  {copy("activity.create.placeName")}
                </FieldLabel>
                <Input
                  id="activity-place-name"
                  name="placeName"
                  form={formId}
                  minLength={2}
                  maxLength={200}
                />
              </Field>
              <PlaceAddressFields
                form={formId}
                defaultAddressLine={initial.addressLine}
                labels={{
                  label: copy("activity.create.address"),
                  placeholder: copy("activity.create.addressPlaceholder"),
                  help: copy("activity.create.addressHelp"),
                  loading: copy("activity.create.addressLoading"),
                  empty: copy("activity.create.addressEmpty"),
                  error: copy("activity.create.addressError"),
                  attribution: copy("activity.create.addressAttribution"),
                }}
                selectedLabel={copy("activity.create.addressSelected")}
                /* Any city may be searched: this form can move an activity
                 * from one to another. */
                filters={undefined}
              />
              <Field>
                <FieldLabel htmlFor="activity-place-precision">
                  {copy("field.precision")}
                </FieldLabel>
                <SelectField
                  id="activity-place-precision"
                  name="precision"
                  form={formId}
                  defaultValue="exact"
                >
                  {placePrecisions.map((value) => (
                    <option key={value} value={value}>
                      {copy(`precision.${value}`)}
                    </option>
                  ))}
                </SelectField>
                <FieldDescription>{copy("precision.hint")}</FieldDescription>
              </Field>
            </div>
          ) : (
            <p className="border-line bg-subtle rounded-lg border p-4 text-sm">
              {copy("activity.create.mobileHint")}
            </p>
          )}
        </>
      )}
    </div>
  );
}
