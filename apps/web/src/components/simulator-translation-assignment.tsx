import { Languages, LockKeyhole } from "lucide-react";

import { saveExternalTranslation } from "~/app/[locale]/translate/assignment/actions";
import { PendingButton } from "~/components/pending-button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Field, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import {
  isRtlEditorialLanguage,
  type EditorialLanguage,
} from "~/lib/editorial-languages";

type NodePayload = {
  key?: unknown;
  kind?: unknown;
  prompt?: unknown;
  explanation?: unknown;
  resultBody?: unknown;
  disclaimer?: unknown;
  options?: Array<{ key?: unknown; label?: unknown }>;
};

type SimulatorPayload = {
  simulator?: { nodes?: NodePayload[] };
};

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function SimulatorTranslationAssignment({
  locale,
  assignment,
  labels,
}: {
  locale: "fr" | "en" | "ar";
  assignment: {
    state: string;
    instructions: string | null;
    expiresAt: Date;
    sourceLanguage: string;
    targetLanguage: string;
    sourceContent: unknown;
    targetContent: unknown;
  };
  labels: Record<string, string>;
}) {
  const sourceNodes =
    (assignment.sourceContent as SimulatorPayload).simulator?.nodes ?? [];
  const targetNodes =
    (assignment.targetContent as SimulatorPayload | null)?.simulator?.nodes ??
    [];
  const editable =
    assignment.state === "requested" || assignment.state === "draft";
  const targetDirection = isRtlEditorialLanguage(
    assignment.targetLanguage as EditorialLanguage,
  )
    ? "rtl"
    : "ltr";

  return (
    <main className="mx-auto min-h-dvh max-w-7xl px-4 py-8 md:px-6">
      <header className="mb-6 flex items-start gap-3">
        <span className="bg-brand-soft text-brand flex size-11 items-center justify-center rounded-xl">
          <Languages aria-hidden />
        </span>
        <div>
          <p className="text-copy-muted flex items-center gap-1.5 text-xs font-medium">
            <LockKeyhole className="size-3.5" aria-hidden />
            {labels["translator.secure"]}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            {(labels["translator.title"] ?? "").replace(
              "{language}",
              labels[`language.${assignment.targetLanguage}`] ??
                assignment.targetLanguage,
            )}
          </h1>
          <p className="text-copy-muted mt-2 text-sm">
            {(labels["translator.expires"] ?? "").replace(
              "{date}",
              new Intl.DateTimeFormat(locale, {
                dateStyle: "long",
                timeStyle: "short",
              }).format(assignment.expiresAt),
            )}
          </p>
        </div>
      </header>

      {assignment.instructions ? (
        <div className="border-line bg-subtle mb-5 rounded-lg border p-3 text-sm">
          <p className="font-medium">{labels["translator.instructions"]}</p>
          <p className="text-copy-muted mt-1 whitespace-pre-wrap">
            {assignment.instructions}
          </p>
        </div>
      ) : null}

      {editable ? (
        <form action={saveExternalTranslation} className="grid gap-5">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="entityKind" value="simulator_flow" />
          {sourceNodes.map((sourceNode, nodeIndex) => {
            const targetNode = targetNodes.find(
              (node) => node.key === sourceNode.key,
            );
            const sourceOptions = sourceNode.options ?? [];
            const targetOptions = targetNode?.options ?? [];
            return (
              <Card key={text(sourceNode.key, String(nodeIndex))}>
                <CardHeader>
                  <p className="text-brand text-xs font-semibold uppercase tracking-wide">
                    {labels[`node.${text(sourceNode.kind, "information")}`] ??
                      text(sourceNode.kind)}
                  </p>
                  <CardTitle>
                    {typeof sourceNode.prompt === "string"
                      ? sourceNode.prompt
                      : labels["node.untitled"]}
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-5 lg:grid-cols-2">
                  <div
                    className="border-line bg-subtle grid content-start gap-4 rounded-xl border p-4"
                    lang={assignment.sourceLanguage}
                    dir={
                      isRtlEditorialLanguage(
                        assignment.sourceLanguage as EditorialLanguage,
                      )
                        ? "rtl"
                        : "ltr"
                    }
                  >
                    {[
                      sourceNode.explanation,
                      sourceNode.resultBody,
                      sourceNode.disclaimer,
                    ].map((value, index) =>
                      typeof value === "string" && value ? (
                        <p key={index} className="whitespace-pre-wrap text-sm">
                          {value}
                        </p>
                      ) : null,
                    )}
                    {sourceOptions.length > 0 ? (
                      <ul className="grid gap-2">
                        {sourceOptions.map((option, optionIndex) => (
                          <li
                            key={text(option.key, String(optionIndex))}
                            className="border-line bg-surface rounded-lg border px-3 py-2 text-sm"
                          >
                            {typeof option.label === "string"
                              ? option.label
                              : text(option.key)}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                  <div className="grid gap-4" dir={targetDirection}>
                    <Field>
                      <FieldLabel>
                        {labels["node.prompt"]} ·{" "}
                        {labels[`language.${assignment.targetLanguage}`]}
                      </FieldLabel>
                      <Textarea
                        name={`simulator_node_${String(nodeIndex)}_prompt`}
                        defaultValue={
                          typeof targetNode?.prompt === "string"
                            ? targetNode.prompt
                            : ""
                        }
                        rows={2}
                        maxLength={2000}
                        required
                      />
                    </Field>
                    <Field>
                      <FieldLabel>{labels["node.explanation"]}</FieldLabel>
                      <Textarea
                        name={`simulator_node_${String(nodeIndex)}_explanation`}
                        defaultValue={
                          typeof targetNode?.explanation === "string"
                            ? targetNode.explanation
                            : ""
                        }
                        rows={3}
                        maxLength={4000}
                      />
                    </Field>
                    {sourceNode.kind === "result" ? (
                      <>
                        <Field>
                          <FieldLabel>{labels["node.resultBody"]}</FieldLabel>
                          <Textarea
                            name={`simulator_node_${String(nodeIndex)}_resultBody`}
                            defaultValue={
                              typeof targetNode?.resultBody === "string"
                                ? targetNode.resultBody
                                : ""
                            }
                            rows={5}
                            maxLength={12000}
                          />
                        </Field>
                        <Field>
                          <FieldLabel>{labels["node.disclaimer"]}</FieldLabel>
                          <Textarea
                            name={`simulator_node_${String(nodeIndex)}_disclaimer`}
                            defaultValue={
                              typeof targetNode?.disclaimer === "string"
                                ? targetNode.disclaimer
                                : ""
                            }
                            rows={3}
                            maxLength={4000}
                          />
                        </Field>
                      </>
                    ) : null}
                    {sourceOptions.map((option, optionIndex) => {
                      const targetOption = targetOptions.find(
                        (candidate) => candidate.key === option.key,
                      );
                      return (
                        <Field key={text(option.key, String(optionIndex))}>
                          <FieldLabel>
                            {labels["node.choiceLabel"]}:{" "}
                            {typeof option.label === "string"
                              ? option.label
                              : text(option.key)}
                          </FieldLabel>
                          <Input
                            name={`simulator_node_${String(nodeIndex)}_option_${String(optionIndex)}`}
                            defaultValue={
                              typeof targetOption?.label === "string"
                                ? targetOption.label
                                : ""
                            }
                            maxLength={200}
                            required
                          />
                        </Field>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
          <div className="border-line bg-surface sticky bottom-0 flex flex-wrap justify-end gap-2 border-t py-4">
            <PendingButton variant="secondary" name="intent" value="draft">
              {labels["translator.saveDraft"]}
            </PendingButton>
            <PendingButton name="intent" value="submit">
              {labels["translator.submit"]}
            </PendingButton>
          </div>
        </form>
      ) : (
        <Card>
          <CardContent className="text-copy-muted py-8 text-sm">
            {labels[`translator.state.${assignment.state}`] ?? assignment.state}
          </CardContent>
        </Card>
      )}
    </main>
  );
}
