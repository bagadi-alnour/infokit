import type { ChangeEvent } from "react";

import { Field, TextInput } from "~/components/admin/workspace";
import { contactLink } from "~/lib/contact-link";
import {
  hasStewardContact,
  type StewardContactValues,
} from "~/lib/steward-contact";

function label(labels: Record<string, string>, key: string) {
  return labels[key] ?? key;
}

/**
 * The "who to ask about this record" fieldset, identical on every content type
 * so an editor learns it once. It is not part of what gets published: it is the
 * line back to the people who know, for the editor in another organisation who
 * spots something wrong.
 *
 * Drop it inside an existing `<form>` — it renders inputs and nothing else, and
 * the matching server action reads them with `parseStewardContact`. Use
 * `StewardContactCard` where the form is laid out in cards; use this directly
 * inside a narrow panel that is already one.
 */
export function StewardContactFields({
  values,
  labels,
  columns = true,
  onChange,
  formId,
}: {
  values: StewardContactValues;
  labels: Record<string, string>;
  /** Phone and email side by side; off in a narrow column. */
  columns?: boolean;
  /**
   * Set when something else on the page writes these fields too — a list of the
   * organisation's members, say. Without it the inputs stay uncontrolled, which
   * is what a plain server form wants.
   */
  onChange?: (patch: Partial<StewardContactValues>) => void;
  /** Associate these inputs with a form elsewhere on the page. */
  formId?: string;
}) {
  /** Controlled only when somebody else may set these values. */
  const bind = (field: keyof StewardContactValues) =>
    onChange
      ? {
          value: values[field] ?? "",
          onChange: (event: ChangeEvent<HTMLInputElement>) => {
            onChange({ [field]: event.target.value });
          },
        }
      : { defaultValue: values[field] ?? "" };

  return (
    <div className="grid gap-4">
      <Field
        label={label(labels, "steward.name")}
        hint={label(labels, "steward.nameHint")}
      >
        <TextInput
          name="stewardName"
          form={formId}
          {...bind("stewardName")}
          maxLength={120}
          autoComplete="off"
        />
      </Field>
      <div className={columns ? "grid gap-4 sm:grid-cols-2" : "grid gap-4"}>
        <Field
          label={label(labels, "steward.phone")}
          hint={label(labels, "steward.phoneHint")}
        >
          <TextInput
            name="stewardPhone"
            form={formId}
            type="tel"
            inputMode="tel"
            {...bind("stewardPhone")}
            maxLength={40}
            autoComplete="off"
          />
        </Field>
        <Field
          label={label(labels, "steward.email")}
          hint={label(labels, "steward.emailHint")}
        >
          <TextInput
            name="stewardEmail"
            form={formId}
            type="email"
            {...bind("stewardEmail")}
            maxLength={255}
            autoComplete="off"
          />
        </Field>
      </div>
      <p className="text-copy-muted text-xs">
        {label(labels, "steward.privacy")}
      </p>
    </div>
  );
}

function Line({ value }: { value: string }) {
  const link = contactLink(value);
  if (link.href === undefined) return <span>{value}</span>;
  return (
    <a href={link.href} className="text-brand font-medium hover:underline">
      {value}
    </a>
  );
}

/**
 * The same contact on a read-only record page: one tap to call or write. Shown
 * only when a steward was recorded — an empty card would read as "nobody to
 * ask", which is a different and worse statement than saying nothing.
 */
export function StewardContactSummary({
  values,
  labels,
  className,
}: {
  values: StewardContactValues;
  labels: Record<string, string>;
  className?: string;
}) {
  if (!hasStewardContact(values)) return null;
  return (
    <dl className={className ?? "grid gap-2 text-sm"}>
      {values.stewardName ? (
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-copy-muted">{label(labels, "steward.name")}</dt>
          <dd>{values.stewardName}</dd>
        </div>
      ) : null}
      {values.stewardPhone ? (
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-copy-muted">{label(labels, "steward.phone")}</dt>
          <dd>
            <Line value={values.stewardPhone} />
          </dd>
        </div>
      ) : null}
      {values.stewardEmail ? (
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-copy-muted">{label(labels, "steward.email")}</dt>
          <dd>
            <Line value={values.stewardEmail} />
          </dd>
        </div>
      ) : null}
    </dl>
  );
}
