/**
 * How a recipient is written down in the delivery ledger.
 *
 * The console has to show enough for a person to say "yes, that is the address
 * I invited" while the table itself never becomes a list of addresses somebody
 * could export (`notifications.endpoints` owns verified addresses, encrypted).
 * So the ledger keeps a masked form for reading and a hash for searching, and
 * this is the only place that decides what "masked" means.
 */

const MASK = "•••";

function maskLocalPart(local: string): string {
  if (local.length <= 2) return MASK;
  return `${local.slice(0, 1)}${MASK}${local.slice(-1)}`;
}

/**
 * `bagadi@example.com` → `b•••i@example.com`, `+33612345678` → `+336•••78`.
 *
 * The email domain survives whole because that is the half a delivery problem
 * usually lives in — a whole association on one mail host is a pattern worth
 * seeing. Phone numbers keep the country and operator prefix and the last two
 * digits: enough to recognise a number you already know, not enough to dial one
 * you do not.
 *
 * Masks the normalised form, so one recipient reads the same in every row they
 * appear in: `Bagadi@Example.ORG` and `bagadi@example.org` already hash alike,
 * and two different masked strings for one address would make the ledger look
 * like two people.
 */
export function redactRecipient(value: string): string {
  const normalised = normaliseRecipient(value);
  if (normalised === "") return MASK;

  const at = normalised.lastIndexOf("@");
  if (at > 0) {
    const local = normalised.slice(0, at);
    const domain = normalised.slice(at + 1);
    return `${maskLocalPart(local)}@${domain}`;
  }

  const digits = normalised.replace(/[^\d]/g, "");
  if (digits.length >= 6) {
    const prefix = normalised.startsWith("+") ? "+" : "";
    return `${prefix}${digits.slice(0, 3)}${MASK}${digits.slice(-2)}`;
  }
  return MASK;
}

/**
 * The form both the mask and the hash are computed from, so the same address
 * typed with different capitalisation or spacing is one recipient.
 */
export function normaliseRecipient(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}
