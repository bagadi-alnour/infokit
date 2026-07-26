/**
 * Turns a free-text contact value into something a phone can act on.
 *
 * Editors type contacts by hand, so the value is whatever they wrote: a number
 * with spaces, a service address, sometimes a sentence. Someone reading a
 * public page is often on a cheap phone with little data and little patience —
 * a number they can tap beats a number they have to copy out. When the value is
 * neither a number nor an address it stays plain text rather than becoming a
 * broken link.
 */
export type ContactLinkKind = "phone" | "email" | "text";

export interface ContactLink {
  kind: ContactLinkKind;
  /** Absent for `text`: there is nothing safe to dial or write to. */
  href?: string;
}

/** Digits, and the punctuation people write between them. */
const phoneShape = /^[+(]?[\d\s().\-/]+$/;
const emailShape = /^[^\s@]+@[^\s@.]+\.[^\s@]+$/;

export function contactLink(value: string): ContactLink {
  const trimmed = value.trim();
  if (emailShape.test(trimmed)) {
    return { kind: "email", href: `mailto:${trimmed}` };
  }
  // Six digits is the shortest real service number here (a French short code
  // is four, but four loose digits in a sentence are not a number to dial).
  const digits = trimmed.replace(/\D/g, "");
  if (phoneShape.test(trimmed) && digits.length >= 6) {
    const dialable = trimmed.startsWith("+") ? `+${digits}` : digits;
    return { kind: "phone", href: `tel:${dialable}` };
  }
  return { kind: "text" };
}
