/**
 * Plain-text authoring format for simulator flows.
 *
 * The canvas editor and this format are two views of the same draft graph:
 * `parseFlowScript` turns text into the graph the editor already saves, and
 * `serializeFlowScript` writes the graph back out. Round-tripping is lossless
 * for everything the format covers (steps, choices, connections, the three
 * source texts per language, review metadata) — canvas positions are kept by
 * step key rather than written into the text.
 *
 * Grammar (line oriented, comments start with `#`):
 *
 *   name: Asile en France — procédure
 *   summary: Fiche SPADA/OFII, vérifiée en juillet 2026
 *   reviewed: 2026-07-25
 *   review-due: 2026-10-25
 *
 *   info arrivee @start
 *     fr: Arrivée en France
 *     fr.explanation: Vous venez d'arriver et souhaitez demander l'asile.
 *     -> spada
 *
 *   question type_procedure @required
 *     fr: Quel type de procédure figure sur votre attestation ?
 *     - dublin -> fiche_dublin
 *       fr: Procédure Dublin
 *     - normale -> entretien_ofpra
 *       fr: Procédure normale
 *
 *   result refugie
 *     fr: Statut de réfugié
 *     fr.result: Le statut de réfugié est délivré pour 10 ans.
 *     | Il est renouvelable.
 *     fr.disclaimer: Information générale, pas un conseil juridique.
 */

export type ScriptLanguage = "fr" | "en" | "ar";
export type ScriptNodeKind = "question" | "information" | "result";

const LANGUAGES: readonly ScriptLanguage[] = ["fr", "en", "ar"];
const KEY_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

export interface ScriptTranslation {
  prompt: string;
  explanation: string;
  resultBody: string;
  disclaimer: string;
}

export interface ScriptOption {
  key: string;
  preferNotToSay: boolean;
  labels: Record<ScriptLanguage, string>;
  target: string | null;
}

export interface ScriptNode {
  key: string;
  kind: ScriptNodeKind;
  optional: boolean;
  entry: boolean;
  translations: Record<ScriptLanguage, ScriptTranslation>;
  options: ScriptOption[];
  /** Onward step for an information node. */
  next: string | null;
}

export interface ScriptMetadata {
  internalName: string;
  sourceSummary: string;
  lastReviewedDate: string;
  reviewDueDate: string;
}

export interface ScriptIssue {
  line: number;
  message: string;
}

export interface ParsedFlowScript {
  metadata: Partial<ScriptMetadata>;
  nodes: ScriptNode[];
  issues: ScriptIssue[];
}

const emptyTranslation = (): ScriptTranslation => ({
  prompt: "",
  explanation: "",
  resultBody: "",
  disclaimer: "",
});

const emptyTranslations = (): Record<ScriptLanguage, ScriptTranslation> => ({
  fr: emptyTranslation(),
  en: emptyTranslation(),
  ar: emptyTranslation(),
});

const FIELD_ALIASES: Record<string, keyof ScriptTranslation> = {
  prompt: "prompt",
  explanation: "explanation",
  result: "resultBody",
  resultbody: "resultBody",
  disclaimer: "disclaimer",
};

const KIND_ALIASES: Record<string, ScriptNodeKind> = {
  question: "question",
  info: "information",
  information: "information",
  result: "result",
};

interface FieldCursor {
  /** Where a `|` continuation line appends text. */
  apply: (value: string) => void;
  read: () => string;
}

/** Parses the authoring text. Never throws: problems come back as issues. */
export function parseFlowScript(text: string): ParsedFlowScript {
  const metadata: Partial<ScriptMetadata> = {};
  const nodes: ScriptNode[] = [];
  const issues: ScriptIssue[] = [];
  const seenKeys = new Set<string>();

  let node: ScriptNode | null = null;
  let option: ScriptOption | null = null;
  let cursor: FieldCursor | null = null;

  const lines = text.split(/\r?\n/);
  for (const [index, raw] of lines.entries()) {
    const line = index + 1;
    const content = raw.trim();
    if (!content || content.startsWith("#")) continue;

    const header = /^(question|info|information|result)\s+(\S+)(.*)$/i.exec(
      content,
    );
    if (header) {
      const kindWord = header[1] ?? "question";
      const key = header[2] ?? "";
      const flagText = header[3] ?? "";
      const kind = KIND_ALIASES[kindWord.toLowerCase()] ?? "question";
      if (!KEY_PATTERN.test(key)) {
        issues.push({
          line,
          message: `Step key “${key}” must be lowercase letters, digits, - or _`,
        });
      }
      if (seenKeys.has(key)) {
        issues.push({ line, message: `Duplicate step key “${key}”` });
      }
      seenKeys.add(key);

      const flags = flagText.trim().split(/\s+/).filter(Boolean);
      let entry = false;
      let optional = kind === "question";
      for (const flag of flags) {
        const name = flag.toLowerCase();
        if (name === "@start") entry = true;
        else if (name === "@required") optional = false;
        else if (name === "@optional") optional = true;
        else issues.push({ line, message: `Unknown flag “${flag}”` });
      }

      const created: ScriptNode = {
        key,
        kind,
        optional,
        entry,
        translations: emptyTranslations(),
        options: [],
        next: null,
      };
      nodes.push(created);
      node = created;
      option = null;
      cursor = null;
      continue;
    }

    if (content.startsWith("|")) {
      if (!cursor) {
        issues.push({
          line,
          message: "A “|” continuation must follow a text line",
        });
        continue;
      }
      cursor.apply(`${cursor.read()}\n${content.slice(1).trim()}`);
      continue;
    }

    if (!node) {
      const meta = /^([a-z-]+)\s*:\s*(.*)$/i.exec(content);
      const field = meta?.[1]?.toLowerCase();
      const value = meta?.[2]?.trim() ?? "";
      cursor = null;
      if (field === "name") metadata.internalName = value;
      else if (field === "summary") {
        metadata.sourceSummary = value;
        cursor = {
          apply: (next) => {
            metadata.sourceSummary = next;
          },
          read: () => metadata.sourceSummary ?? "",
        };
      } else if (field === "reviewed" || field === "review-due") {
        if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
          issues.push({ line, message: `Write ${field} as YYYY-MM-DD` });
        } else if (field === "reviewed") metadata.lastReviewedDate = value;
        else metadata.reviewDueDate = value;
      } else {
        issues.push({
          line,
          message: `Expected a step (question, info, result) or a name/summary/reviewed/review-due line`,
        });
      }
      continue;
    }

    const optionLine = /^-\s+(\S+)(.*)$/.exec(content);
    if (optionLine) {
      const key = optionLine[1] ?? "";
      const rest = optionLine[2] ?? "";
      if (node.kind !== "question") {
        issues.push({
          line,
          message: `Only a question step can list choices (“${node.key}” is ${node.kind})`,
        });
      }
      if (!KEY_PATTERN.test(key)) {
        issues.push({
          line,
          message: `Choice key “${key}” must be lowercase letters, digits, - or _`,
        });
      }
      if (node.options.some((existing) => existing.key === key)) {
        issues.push({
          line,
          message: `Duplicate choice key “${key}” in step “${node.key}”`,
        });
      }
      let target: string | null = null;
      let preferNotToSay = false;
      const arrow = /->\s*(\S+)/.exec(rest);
      if (arrow?.[1]) target = arrow[1];
      for (const flag of rest
        .replace(/->\s*\S+/, "")
        .trim()
        .split(/\s+/)) {
        if (!flag) continue;
        if (flag.toLowerCase() === "@prefer-not-to-say") preferNotToSay = true;
        else issues.push({ line, message: `Unknown flag “${flag}”` });
      }
      const choice: ScriptOption = {
        key,
        preferNotToSay,
        labels: { fr: "", en: "", ar: "" },
        target,
      };
      node.options.push(choice);
      option = choice;
      cursor = null;
      continue;
    }

    if (content.startsWith("->")) {
      const target = content.slice(2).trim();
      if (node.kind !== "information") {
        issues.push({
          line,
          message:
            node.kind === "question"
              ? "In a question step, connect each choice with “- key -> step”"
              : "A result step cannot continue to another step",
        });
      } else if (!target) {
        issues.push({ line, message: "“->” needs a step key" });
      } else {
        node.next = target;
      }
      option = null;
      cursor = null;
      continue;
    }

    const textLine = /^([a-z]{2})(?:\.([a-z]+))?\s*:\s*(.*)$/i.exec(content);
    if (!textLine) {
      issues.push({ line, message: `Could not read “${content}”` });
      continue;
    }
    const languageWord = textLine[1] ?? "";
    const language = languageWord.toLowerCase() as ScriptLanguage;
    const fieldWord = textLine[2]?.toLowerCase();
    const value = (textLine[3] ?? "").trim();
    if (!LANGUAGES.includes(language)) {
      issues.push({
        line,
        message: `Unknown language “${languageWord}” (use fr, en or ar)`,
      });
      continue;
    }
    if (option) {
      if (fieldWord) {
        issues.push({
          line,
          message: `A choice only takes a label, so write “${language}: …”`,
        });
        continue;
      }
      const current = option;
      current.labels[language] = value;
      cursor = {
        apply: (next) => {
          current.labels[language] = next;
        },
        read: () => current.labels[language],
      };
      continue;
    }
    const field = FIELD_ALIASES[fieldWord ?? "prompt"];
    if (!field) {
      issues.push({
        line,
        message: `Unknown text field “${fieldWord ?? ""}” (use explanation, result or disclaimer)`,
      });
      continue;
    }
    if (
      field !== "prompt" &&
      field !== "explanation" &&
      node.kind !== "result"
    ) {
      issues.push({
        line,
        message: `Only a result step has ${field === "resultBody" ? "result guidance" : "a disclaimer"}`,
      });
      continue;
    }
    const current = node;
    current.translations[language][field] = value;
    cursor = {
      apply: (next) => {
        current.translations[language][field] = next;
      },
      read: () => current.translations[language][field],
    };
  }

  if (nodes.length === 0) {
    issues.push({ line: 1, message: "Add at least one step" });
    return { metadata, nodes, issues };
  }

  const keys = new Set(nodes.map((item) => item.key));
  for (const item of nodes) {
    if (item.next && !keys.has(item.next)) {
      issues.push({
        line: 1,
        message: `Step “${item.key}” continues to unknown step “${item.next}”`,
      });
    }
    for (const choice of item.options) {
      if (choice.target && !keys.has(choice.target)) {
        issues.push({
          line: 1,
          message: `Choice “${item.key}.${choice.key}” points to unknown step “${choice.target}”`,
        });
      }
    }
  }
  const entries = nodes.filter((item) => item.entry);
  if (entries.length > 1) {
    issues.push({ line: 1, message: "Only one step can be marked @start" });
  }
  if (entries.length === 0 && nodes[0]) nodes[0].entry = true;

  return { metadata, nodes, issues };
}

/* ------------------------------------------------------------------ */
/* Serialization                                                       */
/* ------------------------------------------------------------------ */

const KIND_WORD: Record<ScriptNodeKind, string> = {
  question: "question",
  information: "info",
  result: "result",
};

function textLines(prefix: string, value: string, indent: string): string[] {
  if (!value.trim()) return [];
  const [first = "", ...rest] = value.split("\n");
  return [
    `${indent}${prefix}: ${first}`,
    ...rest.map((line) => `${indent}| ${line}`.trimEnd()),
  ];
}

export function serializeFlowScript(
  metadata: ScriptMetadata,
  nodes: ScriptNode[],
): string {
  const out: string[] = [];
  if (metadata.internalName) out.push(`name: ${metadata.internalName}`);
  if (metadata.sourceSummary) {
    out.push(...textLines("summary", metadata.sourceSummary, ""));
  }
  if (metadata.lastReviewedDate) {
    out.push(`reviewed: ${metadata.lastReviewedDate}`);
  }
  if (metadata.reviewDueDate) out.push(`review-due: ${metadata.reviewDueDate}`);

  for (const node of nodes) {
    out.push("");
    const flags = [
      node.entry ? "@start" : "",
      node.kind === "question" && !node.optional ? "@required" : "",
    ].filter(Boolean);
    out.push(
      [KIND_WORD[node.kind], node.key, ...flags].filter(Boolean).join(" "),
    );
    for (const language of LANGUAGES) {
      const translation = node.translations[language];
      out.push(...textLines(language, translation.prompt, "  "));
      out.push(
        ...textLines(`${language}.explanation`, translation.explanation, "  "),
      );
      out.push(
        ...textLines(`${language}.result`, translation.resultBody, "  "),
      );
      out.push(
        ...textLines(`${language}.disclaimer`, translation.disclaimer, "  "),
      );
    }
    if (node.next) out.push(`  -> ${node.next}`);
    for (const option of node.options) {
      const suffix = [
        option.target ? `-> ${option.target}` : "",
        option.preferNotToSay ? "@prefer-not-to-say" : "",
      ]
        .filter(Boolean)
        .join(" ");
      out.push(`  - ${option.key}${suffix ? ` ${suffix}` : ""}`);
      for (const language of LANGUAGES) {
        out.push(...textLines(language, option.labels[language], "    "));
      }
    }
  }
  return `${out.join("\n").trim()}\n`;
}

/* ------------------------------------------------------------------ */
/* Bridge to the canvas editor graph                                   */
/* ------------------------------------------------------------------ */

export interface EditorOption {
  id: string;
  key: string;
  preferNotToSay: boolean;
  labels: Record<ScriptLanguage, string>;
}

export interface EditorNode {
  id: string;
  key: string;
  kind: ScriptNodeKind;
  optional: boolean;
  entry: boolean;
  translations: Record<ScriptLanguage, ScriptTranslation>;
  options: EditorOption[];
}

export interface EditorEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle: string | null;
}

/** Reads the canvas graph back into script nodes, ready to serialize. */
export function graphToScriptNodes(
  nodes: EditorNode[],
  edges: EditorEdge[],
): ScriptNode[] {
  const keyById = new Map(nodes.map((node) => [node.id, node.key]));
  return nodes.map((node) => {
    const outgoing = edges.filter((edge) => edge.source === node.id);
    const nextEdge = outgoing.find(
      (edge) => !edge.sourceHandle?.startsWith("option:"),
    );
    return {
      key: node.key,
      kind: node.kind,
      optional: node.optional,
      entry: node.entry,
      translations: node.translations,
      next:
        node.kind === "information" && nextEdge
          ? (keyById.get(nextEdge.target) ?? null)
          : null,
      options: node.options.map((option) => {
        const edge = outgoing.find(
          (candidate) => candidate.sourceHandle === `option:${option.id}`,
        );
        return {
          key: option.key,
          preferNotToSay: option.preferNotToSay,
          labels: option.labels,
          target: edge ? (keyById.get(edge.target) ?? null) : null,
        };
      }),
    };
  });
}

/**
 * Turns parsed script nodes into the canvas graph. Client ids are reused when
 * a step or choice key already exists, so canvas positions, the current
 * selection and translation identity survive an edit made in the script view.
 */
export function scriptNodesToGraph(
  scriptNodes: ScriptNode[],
  existing: EditorNode[],
  makeId: () => string,
): { nodes: EditorNode[]; edges: EditorEdge[] } {
  const existingByKey = new Map(existing.map((node) => [node.key, node]));
  const nodes: EditorNode[] = scriptNodes.map((node) => {
    const previous = existingByKey.get(node.key);
    const previousOptionByKey = new Map(
      (previous?.options ?? []).map((option) => [option.key, option]),
    );
    return {
      id: previous?.id ?? makeId(),
      key: node.key,
      kind: node.kind,
      optional: node.optional,
      entry: node.entry,
      translations: node.translations,
      options: node.options.map((option) => ({
        id: previousOptionByKey.get(option.key)?.id ?? makeId(),
        key: option.key,
        preferNotToSay: option.preferNotToSay,
        labels: option.labels,
      })),
    };
  });

  const idByKey = new Map(nodes.map((node) => [node.key, node.id]));
  const edges: EditorEdge[] = [];
  for (const [index, node] of scriptNodes.entries()) {
    const graphNode = nodes[index];
    if (!graphNode) continue;
    if (node.kind === "information" && node.next) {
      const target = idByKey.get(node.next);
      if (target) {
        edges.push({
          id: makeId(),
          source: graphNode.id,
          target,
          sourceHandle: "next",
        });
      }
    }
    for (const [optionIndex, option] of node.options.entries()) {
      const graphOption = graphNode.options[optionIndex];
      const target = option.target ? idByKey.get(option.target) : undefined;
      if (!graphOption || !target) continue;
      edges.push({
        id: makeId(),
        source: graphNode.id,
        target,
        sourceHandle: `option:${graphOption.id}`,
      });
    }
  }
  return { nodes, edges };
}

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */

export interface LayoutPosition {
  x: number;
  y: number;
}

const COLUMN_WIDTH = 340;
const ROW_HEIGHT = 210;

/**
 * Deterministic left-to-right layered layout: depth from the entry step,
 * siblings stacked in declaration order. Unreachable steps land in a final
 * column so they stay visible instead of overlapping the graph.
 */
export function layoutFlow(
  nodes: Pick<ScriptNode, "key" | "options" | "next" | "entry">[],
  startKey?: string,
): Map<string, LayoutPosition> {
  const byKey = new Map(nodes.map((node) => [node.key, node]));
  const entryKey =
    startKey ?? nodes.find((node) => node.entry)?.key ?? nodes[0]?.key;
  const depth = new Map<string, number>();
  const queue: string[] = entryKey ? [entryKey] : [];
  if (entryKey) depth.set(entryKey, 0);
  while (queue.length > 0) {
    const key = queue.shift();
    if (!key) break;
    const node = byKey.get(key);
    if (!node) continue;
    const nextDepth = (depth.get(key) ?? 0) + 1;
    const targets = [
      node.next,
      ...node.options.map((option) => option.target),
    ].filter((target): target is string => Boolean(target));
    for (const target of targets) {
      if (depth.has(target) || !byKey.has(target)) continue;
      depth.set(target, nextDepth);
      queue.push(target);
    }
  }
  const maxDepth = Math.max(0, ...depth.values());
  const rows = new Map<number, number>();
  const positions = new Map<string, LayoutPosition>();
  for (const node of nodes) {
    const column = depth.get(node.key) ?? maxDepth + 1;
    const row = rows.get(column) ?? 0;
    rows.set(column, row + 1);
    positions.set(node.key, {
      x: 80 + column * COLUMN_WIDTH,
      y: 80 + row * ROW_HEIGHT,
    });
  }
  return positions;
}
