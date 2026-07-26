/**
 * Data contract for a published simulator (guided flow), shared by the web and
 * mobile readers. The server resolves the display language and flattens the
 * graph; the client only walks it.
 */

export type PublicSimulatorLanguage =
  "fr" | "en" | "ar" | "fa" | "prs" | "ps" | "ckb" | "ti" | "am" | "om" | "so";

export type PublicSimulatorSourceLanguage = "fr" | "en" | "ar";

export type PublicSimulatorNodeKind = "question" | "information" | "result";

export interface PublicSimulatorOption {
  id: string;
  key: string;
  label: string;
  preferNotToSay: boolean;
  nextNodeId: string | null;
}

export interface PublicSimulatorNode {
  id: string;
  key: string;
  kind: PublicSimulatorNodeKind;
  optional: boolean;
  prompt: string;
  explanation: string;
  resultBody: string;
  disclaimer: string;
  options: PublicSimulatorOption[];
  nextNodeId: string | null;
}

export interface PublicSimulatorDocument {
  flowId: string;
  versionId: string;
  slug: string;
  title: string;
  summary: string;
  sourceLanguage: PublicSimulatorSourceLanguage;
  displayLanguage: PublicSimulatorLanguage;
  fallbackUsed: boolean;
  versionNumber: number;
  lastReviewedAt: string | null;
  reviewDueAt: string | null;
  publishedAt: string | null;
  entryNodeId: string;
  nodes: PublicSimulatorNode[];
}

export interface PublicSimulatorLabels {
  brand: string;
  privacy: string;
  privacyDetail: string;
  source: string;
  lastReviewed: string;
  reviewDue: string;
  notAvailable: string;
  fallback: string;
  preview: string;
  previewDetail: string;
  begin: string;
  continue: string;
  back: string;
  startAgain: string;
  step: string;
  question: string;
  information: string;
  result: string;
  disclaimer: string;
}
