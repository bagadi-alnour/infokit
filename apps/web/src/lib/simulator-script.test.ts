import assert from "node:assert/strict";
import test from "node:test";

import {
  graphToScriptNodes,
  layoutFlow,
  parseFlowScript,
  scriptNodesToGraph,
  serializeFlowScript,
  type EditorNode,
} from "./simulator-script";

const SCRIPT = `# Procédure d'asile
name: Asile en France
summary: Fiche SPADA, vérifiée en juillet 2026
reviewed: 2026-07-25
review-due: 2026-10-25

info arrivee @start
  fr: Arrivée en France
  fr.explanation: Vous venez d'arriver.
  ar: الوصول إلى فرنسا
  -> type_procedure

question type_procedure @required
  fr: Quel type de procédure ?
  - dublin -> refus
    fr: Procédure Dublin
  - normale -> refugie
    fr: Procédure normale
  - inconnu -> refugie @prefer-not-to-say
    fr: Je ne sais pas

result refugie
  fr: Statut de réfugié
  fr.result: Valable 10 ans.
  | Renouvelable.
  fr.disclaimer: Information générale.

result refus
  fr: Demande refusée
  fr.result: Un recours est possible.
  fr.disclaimer: Information générale.
`;

void test("parses metadata, steps, choices and connections", () => {
  const parsed = parseFlowScript(SCRIPT);
  assert.deepEqual(parsed.issues, []);
  assert.equal(parsed.metadata.internalName, "Asile en France");
  assert.equal(parsed.metadata.reviewDueDate, "2026-10-25");
  assert.equal(parsed.nodes.length, 4);

  const arrivee = parsed.nodes[0];
  const procedure = parsed.nodes[1];
  assert.ok(arrivee);
  assert.ok(procedure);
  assert.equal(arrivee.kind, "information");
  assert.equal(arrivee.entry, true);
  assert.equal(arrivee.next, "type_procedure");
  assert.equal(arrivee.translations.ar.prompt, "الوصول إلى فرنسا");
  assert.equal(procedure.optional, false);
  assert.equal(procedure.options.length, 3);
  assert.deepEqual(
    procedure.options.map((option) => option.target),
    ["refus", "refugie", "refugie"],
  );
  assert.equal(procedure.options[2]?.preferNotToSay, true);
});

void test("a “|” line continues the previous text field", () => {
  const parsed = parseFlowScript(SCRIPT);
  const refugie = parsed.nodes.find((node) => node.key === "refugie");
  assert.equal(
    refugie?.translations.fr.resultBody,
    "Valable 10 ans.\nRenouvelable.",
  );
});

void test("serialize then parse keeps the graph identical", () => {
  const parsed = parseFlowScript(SCRIPT);
  const text = serializeFlowScript(
    {
      internalName: parsed.metadata.internalName ?? "",
      sourceSummary: parsed.metadata.sourceSummary ?? "",
      lastReviewedDate: parsed.metadata.lastReviewedDate ?? "",
      reviewDueDate: parsed.metadata.reviewDueDate ?? "",
    },
    parsed.nodes,
  );
  const again = parseFlowScript(text);
  assert.deepEqual(again.issues, []);
  assert.deepEqual(again.nodes, parsed.nodes);
  assert.deepEqual(again.metadata, parsed.metadata);
});

void test("a multi-line summary round-trips", () => {
  const parsed = parseFlowScript(
    `name: A\nsummary: Première ligne\n| Seconde ligne\n\nresult a\n  fr: A\n`,
  );
  assert.deepEqual(parsed.issues, []);
  assert.equal(parsed.metadata.sourceSummary, "Première ligne\nSeconde ligne");
  const again = parseFlowScript(
    serializeFlowScript(
      {
        internalName: parsed.metadata.internalName ?? "",
        sourceSummary: parsed.metadata.sourceSummary ?? "",
        lastReviewedDate: "",
        reviewDueDate: "",
      },
      parsed.nodes,
    ),
  );
  assert.equal(again.metadata.sourceSummary, "Première ligne\nSeconde ligne");
});

void test("review dates must be ISO calendar dates", () => {
  const parsed = parseFlowScript(`reviewed: 25/07/2026\nresult a\n  fr: A\n`);
  assert.ok(
    parsed.issues.some((issue) => issue.message.includes("YYYY-MM-DD")),
  );
  assert.equal(parsed.metadata.lastReviewedDate, undefined);
});

void test("reports unknown targets, duplicates and misplaced fields with line numbers", () => {
  const parsed = parseFlowScript(`question a
  fr: Question
  - oui -> nowhere
    fr: Oui
question a
  fr: Duplicate
result b
  fr: Result
  -> a
info c
  fr: Info
  fr.result: not allowed here
`);
  const messages = parsed.issues.map((issue) => issue.message);
  assert.ok(
    messages.some((message) => message.includes("unknown step “nowhere”")),
  );
  assert.ok(
    messages.some((message) => message.includes("Duplicate step key “a”")),
  );
  assert.ok(
    messages.some((message) =>
      message.includes("cannot continue to another step"),
    ),
  );
  assert.ok(messages.some((message) => message.includes("result guidance")));
  const misplaced = parsed.issues.find((issue) =>
    issue.message.includes("result guidance"),
  );
  assert.equal(misplaced?.line, 12);
});

void test("choices on a non-question step are rejected", () => {
  const parsed = parseFlowScript(
    `info a\n  fr: Info\n  - oui -> a\n    fr: Oui\n`,
  );
  assert.ok(
    parsed.issues.some((issue) =>
      issue.message.includes("Only a question step can list choices"),
    ),
  );
});

void test("the first step becomes the start when none is marked", () => {
  const parsed = parseFlowScript(`result a\n  fr: A\nresult b\n  fr: B\n`);
  assert.equal(parsed.nodes[0]?.entry, true);
  assert.equal(parsed.nodes[1]?.entry, false);
});

void test("two start steps are rejected", () => {
  const parsed = parseFlowScript(
    `result a @start\n  fr: A\nresult b @start\n  fr: B\n`,
  );
  assert.ok(parsed.issues.some((issue) => issue.message.includes("@start")));
});

void test("applying a script reuses ids of steps and choices that already exist", () => {
  const parsed = parseFlowScript(SCRIPT);
  let counter = 0;
  const makeId = () => `new-${String(++counter)}`;
  const existing: EditorNode[] = [
    {
      id: "kept-node",
      key: "type_procedure",
      kind: "question",
      optional: true,
      entry: false,
      translations: {
        fr: { prompt: "", explanation: "", resultBody: "", disclaimer: "" },
        en: { prompt: "", explanation: "", resultBody: "", disclaimer: "" },
        ar: { prompt: "", explanation: "", resultBody: "", disclaimer: "" },
      },
      options: [
        {
          id: "kept-option",
          key: "normale",
          preferNotToSay: false,
          labels: { fr: "", en: "", ar: "" },
        },
      ],
    },
  ];
  const graph = scriptNodesToGraph(parsed.nodes, existing, makeId);
  const procedure = graph.nodes.find((node) => node.key === "type_procedure");
  assert.ok(procedure);
  assert.equal(procedure.id, "kept-node");
  assert.equal(
    procedure.options.find((option) => option.key === "normale")?.id,
    "kept-option",
  );
  assert.equal(
    graph.edges.filter((edge) => edge.sourceHandle === "option:kept-option")
      .length,
    1,
  );
  assert.equal(graph.edges.length, 4);
});

void test("graph round-trips through the canvas shape", () => {
  const parsed = parseFlowScript(SCRIPT);
  let counter = 0;
  const graph = scriptNodesToGraph(
    parsed.nodes,
    [],
    () => `id-${String(++counter)}`,
  );
  assert.deepEqual(graphToScriptNodes(graph.nodes, graph.edges), parsed.nodes);
});

void test("layout places steps in journey order and parks unreachable steps last", () => {
  const parsed = parseFlowScript(`${SCRIPT}\nresult orphan\n  fr: Orphan\n`);
  const positions = layoutFlow(parsed.nodes);
  assert.equal(positions.get("arrivee")?.x, 80);
  assert.equal(positions.get("type_procedure")?.x, 420);
  assert.equal(positions.get("refugie")?.x, 760);
  assert.equal(positions.get("refus")?.x, 760);
  assert.notEqual(positions.get("refugie")?.y, positions.get("refus")?.y);
  assert.equal(positions.get("orphan")?.x, 1100);
});
