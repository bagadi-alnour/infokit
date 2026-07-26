import { Card, Field, TextInput } from "~/components/admin/workspace";
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
}: {
  values: StewardContactValues;
  labels: Record<string, string>;
  /** Phone and email side by side; off in a narrow column. */
  columns?: boolean;
}) {
  return (
    <div className="grid gap-4">
      <Field
        label={label(labels, "steward.name")}
        hint={label(labels, "steward.nameHint")}
      >
        <TextInput
          name="stewardName"
          defaultValue={values.stewardName ?? ""}
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
            type="tel"
            inputMode="tel"
            defaultValue={values.stewardPhone ?? ""}
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
            type="email"
            defaultValue={values.stewardEmail ?? ""}
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

/** The same fieldset as its own form section. */
export function StewardContactCard({
  values,
  labels,
}: {
  values: StewardContactValues;
  labels: Record<string, string>;
}) {
  return (
    <Card
      title={label(labels, "steward.title")}
      hint={label(labels, "steward.hint")}
    >
      <StewardContactFields values={values} labels={labels} />
    </Card>
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
