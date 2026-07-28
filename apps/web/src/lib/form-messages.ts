import type { CommonCatalog } from "@infokit/shared/i18n/catalogs";

/**
 * The wording every form shares for the mistakes every form can make.
 *
 * Validation runs on the client now (React Hook Form + zod), which means
 * validation copy is user-facing copy: it goes through the catalog like every
 * other string, and a schema never carries an English literal. Schemas are
 * therefore factories — they take this object and hand zod the localized
 * message — so the same schema serves fr, en and ar.
 *
 * Field-specific wording stays with the field's own catalog entry; only the
 * generic mistakes live here, so one correction fixes every form.
 */
export type FormMessages = {
  /** A field the form cannot be saved without. */
  required: string;
  /** The value is present but malformed, and the field can say no more. */
  invalid: string;
  /** Toast copy when the save itself failed and nothing was written. */
  saveFailed: string;
  /** Longer than the database column accepts. */
  tooLong: string;
  /** Shorter than the field's minimum, but not empty. */
  tooShort: string;
  /** An end date or time that lands before its start. */
  endBeforeStart: string;
  invalidDate: string;
  invalidTime: string;
  /** Toast copy when a submit is blocked by fields the editor cannot see. */
  reviewFields: string;
};

/**
 * Catalog keys behind `FormMessages`. `satisfies` proves each one exists in the
 * common catalog, so a renamed key fails typecheck instead of silently
 * rendering its own name to an editor.
 */
const formMessageKeys = {
  required: "form.required",
  invalid: "form.invalid",
  saveFailed: "form.saveFailed",
  tooLong: "form.tooLong",
  tooShort: "form.tooShort",
  endBeforeStart: "form.endBeforeStart",
  invalidDate: "form.invalidDate",
  invalidTime: "form.invalidTime",
  reviewFields: "form.reviewFields",
} satisfies Record<keyof FormMessages, keyof CommonCatalog>;

/**
 * A loaded page catalog as a client component receives it: the pages hand the
 * whole namespace down, and the component reads the keys it needs.
 */
export type Labels = Record<string, string>;

/**
 * Read one catalog entry, falling back to its key.
 *
 * A missing string then shows up as `activity.create.title` in review rather
 * than as a blank line nobody notices.
 */
export function readLabel(labels: Labels, key: string): string {
  return labels[key] ?? key;
}

/** Lift the shared validation wording out of any page catalog. */
export function formMessages(labels: Labels): FormMessages {
  return {
    required: readLabel(labels, formMessageKeys.required),
    invalid: readLabel(labels, formMessageKeys.invalid),
    saveFailed: readLabel(labels, formMessageKeys.saveFailed),
    tooLong: readLabel(labels, formMessageKeys.tooLong),
    tooShort: readLabel(labels, formMessageKeys.tooShort),
    endBeforeStart: readLabel(labels, formMessageKeys.endBeforeStart),
    invalidDate: readLabel(labels, formMessageKeys.invalidDate),
    invalidTime: readLabel(labels, formMessageKeys.invalidTime),
    reviewFields: readLabel(labels, formMessageKeys.reviewFields),
  };
}

/**
 * The generic validation entries, ready to spread into a `labels` prop.
 *
 * A page hands a client form the strings it needs one key at a time. Validation
 * copy is the same seven keys on every form, so the page spreads this instead of
 * re-listing them — and a form that later validates one more thing does not send
 * the page back for another label.
 */
export function formMessageLabels(catalog: CommonCatalog): Labels {
  return Object.fromEntries(
    Object.values(formMessageKeys).map((key) => [key, catalog[key]]),
  );
}
