"use client";

import { useId, type ComponentProps, type ReactNode } from "react";
import {
  Controller,
  useFormState,
  type Control,
  type ControllerFieldState,
  type ControllerRenderProps,
  type FieldPath,
  type FieldPathByValue,
  type FieldValues,
} from "react-hook-form";

import {
  SearchableMultiSelect,
  SearchableSelect,
  type SearchableOption,
} from "~/components/admin/searchable-select";
import {
  Select,
  TextArea,
  TextInput,
  type WorkspaceButtonVariant,
} from "~/components/admin/workspace";
import { PendingButton } from "~/components/pending-button";
import { TimePicker } from "~/components/shadcn-studio/date-picker/date-picker-09";
import { Checkbox } from "~/components/ui/checkbox";
import { DatePicker } from "~/components/ui/date-picker";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "~/components/ui/field";
import { cn } from "~/lib/utils";

/**
 * One field row, wired to React Hook Form.
 *
 * Every row is the same shape — label, control, hint, error — so a form reads as
 * a list of fields rather than a list of state plumbing, and an error appears in
 * the one place the editor is already looking. `Field` takes `data-invalid` and
 * the control takes `aria-invalid`, which is the pairing the shadcn field
 * pattern expects: the row turns to the destructive tint and assistive
 * technology hears the same thing.
 *
 * Each control keeps its `name`, because the workspace posts `FormData` to a
 * server action. React Hook Form owns the value; the control's own (often
 * hidden) input is what the browser serializes.
 */

/** What every wrapper below accepts, on top of its control's own props. */
type FieldRowProps = {
  label?: ReactNode;
  /** Guidance under the control, in the muted workspace hint size. */
  description?: ReactNode;
  className?: string;
  /** Overrides the generated control id, for a label rendered elsewhere. */
  id?: string;
};

/**
 * For a control whose posted key is not its React Hook Form path.
 *
 * A repeated row is held as an array — `scheduleRows.0.startTime` — while the
 * action reads the rows index-aligned from one repeated key. The path stays the
 * typed address of the value; this is the name the browser posts it under.
 */
type PostedNameProps = { inputName?: string };

/** For a choice that resets other fields, which the schema then re-checks. */
type ChoiceEchoProps = {
  /** Runs after the form value changes, with the new value. */
  onValueChange?: (value: string) => void;
};

type FieldRenderArgs<
  TValues extends FieldValues,
  TName extends FieldPath<TValues>,
> = {
  field: ControllerRenderProps<TValues, TName>;
  fieldState: ControllerFieldState;
  /** Id the row's label points at. */
  id: string;
  /** Ids of the hint and the error, for `aria-describedby`. */
  describedBy: string | undefined;
};

/**
 * The generic row: use it for a control the wrappers below do not cover.
 *
 * `FieldPathByValue` keeps the wrappers honest about which fields they can
 * address, but a deep path lookup cannot be reduced to `string` while the form's
 * value type is still generic, so each wrapper reads the value through the
 * narrowing helpers below rather than asserting a type.
 */
export function FormField<
  TValues extends FieldValues,
  TName extends FieldPath<TValues>,
>({
  control,
  name,
  label,
  description,
  className,
  id,
  children,
}: FieldRowProps & {
  control: Control<TValues>;
  name: TName;
  children: (args: FieldRenderArgs<TValues, TName>) => ReactNode;
}) {
  const generatedId = useId();
  const controlId = id ?? `${generatedId}field`;
  const descriptionId = `${controlId}-description`;
  const errorId = `${controlId}-error`;

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field
          className={cn("gap-1", className)}
          data-invalid={fieldState.invalid}
        >
          {label === undefined ? null : (
            <FieldLabel htmlFor={controlId} className="leading-normal">
              {label}
            </FieldLabel>
          )}
          {children({
            field,
            fieldState,
            id: controlId,
            describedBy:
              [
                description === undefined ? null : descriptionId,
                fieldState.error ? errorId : null,
              ]
                .filter((value) => value !== null)
                .join(" ") || undefined,
          })}
          {description === undefined ? null : (
            <FieldDescription
              id={descriptionId}
              className="text-copy-muted text-xs"
            >
              {description}
            </FieldDescription>
          )}
          <FieldError
            id={errorId}
            errors={fieldState.error ? [fieldState.error] : undefined}
          />
        </Field>
      )}
    />
  );
}

/**
 * Read a field the path type proved is a string.
 *
 * `undefined` reads as `""` so a control never flips between controlled and
 * uncontrolled when a form starts from a partial default.
 */
function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function stringListValue(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function booleanValue(value: unknown): boolean {
  return value === true;
}

type ControlProps<TElement extends keyof React.JSX.IntrinsicElements> = Omit<
  React.ComponentProps<TElement>,
  "name" | "value" | "onChange" | "onBlur" | "id" | "ref" | "children"
>;

/** A single-line text field. */
export function TextFormField<TValues extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  id,
  ...input
}: FieldRowProps &
  ControlProps<"input"> & {
    control: Control<TValues>;
    name: FieldPathByValue<TValues, string>;
  }) {
  return (
    <FormField
      control={control}
      name={name}
      label={label}
      description={description}
      className={className}
      id={id}
    >
      {({ field, fieldState, id: controlId, describedBy }) => (
        <TextInput
          {...input}
          id={controlId}
          name={field.name}
          value={stringValue(field.value)}
          onChange={field.onChange}
          onBlur={field.onBlur}
          ref={field.ref}
          disabled={field.disabled ?? input.disabled}
          aria-invalid={fieldState.invalid}
          aria-describedby={describedBy}
        />
      )}
    </FormField>
  );
}

/** A multi-line text field. */
export function TextAreaFormField<TValues extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  id,
  ...textarea
}: FieldRowProps &
  ControlProps<"textarea"> & {
    control: Control<TValues>;
    name: FieldPathByValue<TValues, string>;
  }) {
  return (
    <FormField
      control={control}
      name={name}
      label={label}
      description={description}
      className={className}
      id={id}
    >
      {({ field, fieldState, id: controlId, describedBy }) => (
        <TextArea
          {...textarea}
          id={controlId}
          name={field.name}
          value={stringValue(field.value)}
          onChange={field.onChange}
          onBlur={field.onBlur}
          ref={field.ref}
          disabled={field.disabled ?? textarea.disabled}
          aria-invalid={fieldState.invalid}
          aria-describedby={describedBy}
        />
      )}
    </FormField>
  );
}

/** The workspace dropdown, taking the `<option>` children a `<select>` takes. */
export function SelectFormField<TValues extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  id,
  inputName,
  onValueChange,
  children,
  disabled,
  required,
}: FieldRowProps &
  PostedNameProps &
  ChoiceEchoProps & {
    control: Control<TValues>;
    name: FieldPathByValue<TValues, string>;
    children: ReactNode;
    disabled?: boolean;
    required?: boolean;
  }) {
  return (
    <FormField
      control={control}
      name={name}
      label={label}
      description={description}
      className={className}
      id={id}
    >
      {({ field, fieldState, id: controlId, describedBy }) => (
        <Select
          id={controlId}
          name={inputName ?? field.name}
          value={stringValue(field.value)}
          onValueChange={(next) => {
            field.onChange(next);
            onValueChange?.(next);
          }}
          disabled={field.disabled ?? disabled}
          required={required}
          aria-invalid={fieldState.invalid}
          aria-describedby={describedBy}
        >
          {children}
        </Select>
      )}
    </FormField>
  );
}

/** The popover date picker, holding `YYYY-MM-DD`. */
export function DateFormField<TValues extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  id,
  ...picker
}: FieldRowProps &
  Omit<
    ComponentProps<typeof DatePicker>,
    "name" | "value" | "onValueChange" | "id" | "defaultValue"
  > & {
    control: Control<TValues>;
    name: FieldPathByValue<TValues, string>;
  }) {
  return (
    <FormField
      control={control}
      name={name}
      label={label}
      description={description}
      className={className}
      id={id}
    >
      {({ field, id: controlId }) => (
        <DatePicker
          {...picker}
          id={controlId}
          name={field.name}
          value={stringValue(field.value)}
          onValueChange={field.onChange}
          disabled={field.disabled ?? picker.disabled}
        />
      )}
    </FormField>
  );
}

/** The time field, holding `HH:MM`. */
export function TimeFormField<TValues extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  id,
  inputName,
  ...picker
}: FieldRowProps &
  PostedNameProps &
  ControlProps<"input"> & {
    control: Control<TValues>;
    name: FieldPathByValue<TValues, string>;
  }) {
  return (
    <FormField
      control={control}
      name={name}
      label={label}
      description={description}
      className={className}
      id={id}
    >
      {({ field, fieldState, id: controlId, describedBy }) => (
        <TimePicker
          {...picker}
          id={controlId}
          name={inputName ?? field.name}
          value={stringValue(field.value)}
          onChange={field.onChange}
          onBlur={field.onBlur}
          ref={field.ref}
          disabled={field.disabled ?? picker.disabled}
          aria-invalid={fieldState.invalid}
          aria-describedby={describedBy}
        />
      )}
    </FormField>
  );
}

/** A type-to-filter single choice over a long list. */
export function SearchableSelectFormField<TValues extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  id,
  options,
  placeholder,
  emptyLabel,
  required,
  disabled,
  onValueChange,
}: FieldRowProps &
  ChoiceEchoProps & {
    control: Control<TValues>;
    name: FieldPathByValue<TValues, string>;
    options: readonly SearchableOption[];
    placeholder?: string;
    emptyLabel?: string;
    required?: boolean;
    disabled?: boolean;
  }) {
  return (
    <FormField
      control={control}
      name={name}
      label={label}
      description={description}
      className={className}
      id={id}
    >
      {({ field, id: controlId }) => (
        <SearchableSelect
          id={controlId}
          name={field.name}
          options={options}
          value={stringValue(field.value)}
          onValueChange={(next) => {
            field.onChange(next);
            onValueChange?.(next);
          }}
          placeholder={placeholder}
          emptyLabel={emptyLabel}
          required={required}
          disabled={field.disabled ?? disabled}
        />
      )}
    </FormField>
  );
}

/**
 * The same list, several choices. One hidden input per selection, so the action
 * keeps reading `formData.getAll(name)`.
 */
export function SearchableMultiSelectFormField<TValues extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  options,
  placeholder,
  emptyLabel,
  maxSelections,
}: Omit<FieldRowProps, "label" | "id"> & {
  control: Control<TValues>;
  name: FieldPathByValue<TValues, string[]>;
  /** Also the control's accessible name: chips input takes no visible label. */
  label: string;
  options: readonly SearchableOption[];
  placeholder?: string;
  emptyLabel?: string;
  maxSelections?: number;
}) {
  return (
    <FormField
      control={control}
      name={name}
      label={label}
      description={description}
      className={className}
    >
      {({ field }) => (
        <SearchableMultiSelect
          name={field.name}
          options={options}
          value={stringListValue(field.value)}
          onValueChange={field.onChange}
          label={label}
          placeholder={placeholder}
          emptyLabel={emptyLabel}
          maxSelections={maxSelections}
        />
      )}
    </FormField>
  );
}

/**
 * A checkbox row: control first, then the label, as the shadcn field pattern
 * lays out a choice.
 */
export function CheckboxFormField<TValues extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  id,
  disabled,
}: FieldRowProps & {
  control: Control<TValues>;
  name: FieldPathByValue<TValues, boolean>;
  label: ReactNode;
  disabled?: boolean;
}) {
  const generatedId = useId();
  const controlId = id ?? `${generatedId}choice`;

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field
          orientation="horizontal"
          className={cn("items-start gap-2", className)}
          data-invalid={fieldState.invalid}
        >
          <Checkbox
            id={controlId}
            name={field.name}
            checked={booleanValue(field.value)}
            onCheckedChange={field.onChange}
            onBlur={field.onBlur}
            disabled={field.disabled ?? disabled}
            aria-invalid={fieldState.invalid}
            className="mt-0.5"
          />
          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor={controlId} className="leading-normal">
              {label}
            </FieldLabel>
            {description === undefined ? null : (
              <FieldDescription className="text-copy-muted text-xs">
                {description}
              </FieldDescription>
            )}
            <FieldError
              errors={fieldState.error ? [fieldState.error] : undefined}
            />
          </div>
        </Field>
      )}
    />
  );
}

/**
 * The form's submit, pending while the action runs.
 *
 * `useFormState` subscribes to just this form's submit state, so a keystroke in
 * a field does not re-render the button.
 */
export function FormSubmitButton<TValues extends FieldValues>({
  control,
  variant,
  className,
  disabled,
  children,
}: {
  control: Control<TValues>;
  variant?: WorkspaceButtonVariant;
  className?: string;
  /** For a form that says up front why it cannot be sent yet. */
  disabled?: boolean;
  children: ReactNode;
}) {
  const { isSubmitting } = useFormState({ control });

  return (
    <PendingButton
      pending={isSubmitting}
      disabled={disabled}
      variant={variant}
      className={className}
    >
      {children}
    </PendingButton>
  );
}
