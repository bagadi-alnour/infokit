import { AtSign, Info, Phone } from "lucide-react";

import { inlineLinkClass } from "~/components/public/primitives";
import { contactLink } from "~/lib/contact-link";

/** The glyph that matches what tapping the contact will do. */
export function contactIcon(value: string) {
  const { kind } = contactLink(value);
  const Glyph = kind === "email" ? AtSign : kind === "phone" ? Phone : Info;
  return <Glyph className="size-3.5" aria-hidden />;
}

/**
 * A published contact, tappable when it can be. The label stays plain text next
 * to it: only the number or address is a link, so it is obvious what tapping
 * will do — start a call, or open a mail app.
 */
export function ContactValue({
  label,
  value,
}: {
  label?: string | null;
  value: string;
}) {
  const link = contactLink(value);
  const target =
    link.href === undefined ? (
      <span>{value}</span>
    ) : (
      // A phone number is often read aloud or dialled from a screenshot, so the
      // visible text stays exactly what the editor typed.
      <a href={link.href} className={inlineLinkClass}>
        {value}
      </a>
    );
  if (!label) return target;
  return (
    <>
      {label} — {target}
    </>
  );
}
