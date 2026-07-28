/**
 * The numbers a person calls when something is happening right now.
 *
 * These are territory facts, not interface text: France answers 15 for a doctor
 * and 17 for the police, and a deployment for another city or country arrives
 * with its own list (docs/PRODUCT.md §2 — emergency numbers are configuration,
 * never woven into a screen). They live here rather than in a page so that both
 * surfaces read one list, and so that changing a number is one edit.
 *
 * The words that explain each number are not here: they belong to the interface
 * catalogues, translated into the eleven languages like everything else
 * (`basics.number.*` in `public-content`). This file holds only what a translator
 * must not touch — the digits, and which icon stands for them.
 *
 * When the editorial basic-information kind opens for authoring, these entries
 * become published entries with a review date and a named owner like any other
 * content, and this table goes away.
 */
export const emergencyNumberCodes = [
  "emergency",
  "ambulance",
  "police",
  "fire",
  "shelter",
  "deaf",
] as const;

export type EmergencyNumberCode = (typeof emergencyNumberCodes)[number];

export interface EmergencyNumber {
  code: EmergencyNumberCode;
  /** The digits, exactly as they are dialled. */
  dial: string;
  /** A catalogue icon name, drawn by each surface's own icon set. */
  icon: string;
  /**
   * False where the number is not answered by voice — 114 is written to, not
   * called — so a surface never offers a call that cannot connect.
   */
  callable: boolean;
}

/** France, which is where Calais is. Ordered widest reach first. */
export const emergencyNumbers: EmergencyNumber[] = [
  { code: "emergency", dial: "112", icon: "siren", callable: true },
  { code: "ambulance", dial: "15", icon: "ambulance", callable: true },
  { code: "police", dial: "17", icon: "shield", callable: true },
  { code: "fire", dial: "18", icon: "flame", callable: true },
  { code: "shelter", dial: "115", icon: "bed", callable: true },
  { code: "deaf", dial: "114", icon: "message-square", callable: false },
];
