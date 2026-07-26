"use client";

import type { Locale } from "@infokit/shared/i18n";
import {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import {
  AlertCircle,
  ArrowRight,
  Check,
  CircleHelp,
  Code2,
  FileText,
  Flag,
  GitBranch,
  Globe2,
  GripVertical,
  Info,
  LayoutGrid,
  LockKeyhole,
  Network,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  publishSimulatorVersion,
  saveSimulatorDraft,
  unpublishSimulatorVersion,
} from "~/app/[locale]/dashboard/simulator/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { SimulatorScriptView } from "~/components/admin/simulator-script-view";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { DatePicker } from "~/components/ui/date-picker";
import { Field, FieldDescription, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { SelectField } from "~/components/ui/select-field";
import { Textarea } from "~/components/ui/textarea";
import {
  graphToScriptNodes,
  layoutFlow,
  parseFlowScript,
  serializeFlowScript,
  scriptNodesToGraph,
  type EditorNode,
} from "~/lib/simulator-script";
import { cn } from "~/lib/utils";

export type SimulatorLanguage = "fr" | "en" | "ar";
export type SimulatorNodeKind = "question" | "information" | "result";

export interface SimulatorTranslation {
  prompt: string;
  explanation: string;
  resultBody: string;
  disclaimer: string;
}

export interface SimulatorChoice {
  id: string;
  key: string;
  preferNotToSay: boolean;
  labels: Record<SimulatorLanguage, string>;
}

export interface SimulatorNodeData extends Record<string, unknown> {
  key: string;
  kind: SimulatorNodeKind;
  optional: boolean;
  translations: Record<SimulatorLanguage, SimulatorTranslation>;
  options: SimulatorChoice[];
  entry: boolean;
  interfaceLanguage: SimulatorLanguage;
  messages: Record<string, string>;
}

export type SimulatorFlowNode = Node<
  SimulatorNodeData,
  "simulator-question" | "simulator-information" | "simulator-result"
>;

export interface SimulatorEditorMetadata {
  internalName: string;
  sourceSummary: string;
  lastReviewedDate: string;
  reviewDueDate: string;
}

const emptyTranslation = (): SimulatorTranslation => ({
  prompt: "",
  explanation: "",
  resultBody: "",
  disclaimer: "",
});

function nodeType(kind: SimulatorNodeKind): SimulatorFlowNode["type"] {
  if (kind === "question") return "simulator-question";
  if (kind === "information") return "simulator-information";
  return "simulator-result";
}

function kindIcon(kind: SimulatorNodeKind) {
  if (kind === "question") return CircleHelp;
  if (kind === "information") return Info;
  return Flag;
}

function FlowNodeCard({ data, selected }: NodeProps<SimulatorFlowNode>) {
  const Icon = kindIcon(data.kind);
  const translation = data.translations[data.interfaceLanguage];
  const heading = translation.prompt.trim() || data.messages["node.untitled"];

  return (
    <div
      className={cn(
        "border-line-strong bg-surface relative w-64 rounded-xl border shadow-sm transition",
        selected && "border-brand ring-brand/20 ring-4",
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="simulator-handle"
      />
      <div className="border-line flex items-center gap-2 border-b px-3 py-2.5">
        <span className="bg-brand-soft text-brand flex size-7 items-center justify-center rounded-lg">
          <Icon className="size-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1 truncate text-xs font-semibold uppercase tracking-wide">
          {data.messages[`node.${data.kind}`]}
        </span>
        {data.entry ? (
          <Badge variant="secondary" className="text-brand">
            {data.messages["editor.start"]}
          </Badge>
        ) : null}
      </div>
      <div className="px-3 py-3">
        <p className="line-clamp-2 text-sm font-medium leading-snug">
          {heading}
        </p>
        <p className="text-copy-muted mt-1 font-mono text-[11px]">{data.key}</p>
      </div>
      {data.kind === "question" ? (
        <div className="border-line divide-line border-t">
          {data.options.length === 0 ? (
            <p className="text-copy-muted px-3 py-2 text-xs">
              {data.messages["node.noChoices"]}
            </p>
          ) : (
            data.options.map((option) => (
              <div
                key={option.id}
                className="relative flex min-h-9 items-center border-b px-3 pe-7 text-xs last:border-b-0"
              >
                <span className="truncate">
                  {option.labels[data.interfaceLanguage].trim() || option.key}
                </span>
                <Handle
                  id={`option:${option.id}`}
                  type="source"
                  position={Position.Right}
                  className="simulator-handle"
                />
              </div>
            ))
          )}
        </div>
      ) : data.kind === "information" ? (
        <div className="border-line relative flex min-h-9 items-center border-t px-3 text-xs">
          {data.messages["node.next"]}
          <Handle
            id="next"
            type="source"
            position={Position.Right}
            className="simulator-handle"
          />
        </div>
      ) : null}
    </div>
  );
}

const nodeTypes = {
  "simulator-question": FlowNodeCard,
  "simulator-information": FlowNodeCard,
  "simulator-result": FlowNodeCard,
};

function dateToIso(value: string): string | null {
  return value ? `${value}T12:00:00.000Z` : null;
}

function uniqueKey(prefix: string, nodes: SimulatorFlowNode[]): string {
  const keys = new Set(nodes.map((node) => node.data.key));
  if (!keys.has(prefix)) return prefix;
  let number = 2;
  while (keys.has(`${prefix}_${String(number)}`)) number += 1;
  return `${prefix}_${String(number)}`;
}

/** Canvas nodes reduced to the shape the script format works with. */
function toEditorNodes(nodes: SimulatorFlowNode[]): EditorNode[] {
  return nodes.map((node) => ({
    id: node.id,
    key: node.data.key,
    kind: node.data.kind,
    optional: node.data.optional,
    entry: node.data.entry,
    translations: node.data.translations,
    options: node.data.options,
  }));
}

function toEditorEdges(edges: Edge[]) {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle ?? null,
  }));
}

function canvasEdge(
  source: string,
  target: string,
  sourceHandle: string | null,
): Edge {
  return {
    id: crypto.randomUUID(),
    source,
    target,
    sourceHandle,
    type: "smoothstep",
    markerEnd: { type: MarkerType.ArrowClosed },
  };
}

export function SimulatorFlowEditor({
  locale,
  flowId,
  versionId,
  versionNumber,
  status,
  sourceLanguage,
  initialNodes,
  initialEdges,
  initialMetadata,
  previewUrl,
  publicUrl,
  demoContent,
  translationPanel,
  stewardPanel,
  messages,
}: {
  locale: SimulatorLanguage;
  flowId: string;
  versionId: string;
  versionNumber: number;
  status: "draft" | "published" | "retired" | "archived";
  sourceLanguage: SimulatorLanguage;
  initialNodes: SimulatorFlowNode[];
  initialEdges: Edge[];
  initialMetadata: SimulatorEditorMetadata;
  previewUrl: string;
  publicUrl: string;
  demoContent: boolean;
  translationPanel?: ReactNode;
  /**
   * "Who to ask about this flow" — the workspace-only steward contact, brought
   * in with its own heading so its wording stays in the shared catalogue.
   */
  stewardPanel?: ReactNode;
  messages: Record<string, string>;
}) {
  const router = useRouter();
  const hydratedNodes = useMemo(
    () =>
      initialNodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          interfaceLanguage: sourceLanguage,
          messages,
        },
      })),
    [initialNodes, messages, sourceLanguage],
  );
  const [nodes, setNodes, onNodesChange] =
    useNodesState<SimulatorFlowNode>(hydratedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState(
    hydratedNodes[0]?.id ?? "",
  );
  const [metadata, setMetadata] = useState(initialMetadata);
  const [view, setView] = useState<"canvas" | "script">("canvas");
  const [scriptDraft, setScriptDraft] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [isSaving, startSaving] = useTransition();
  const [isPublicationPending, startPublication] = useTransition();
  const readOnly = status !== "draft";
  const language = sourceLanguage;

  const markDirty = useCallback(() => {
    setDirty(true);
  }, []);
  const selectedNode = nodes.find((node) => node.id === selectedNodeId);

  const updateNodeData = useCallback(
    (
      nodeId: string,
      update: (data: SimulatorNodeData) => SimulatorNodeData,
    ) => {
      setNodes((current) =>
        current.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: update(node.data),
              }
            : node,
        ),
      );
      markDirty();
    },
    [markDirty, setNodes],
  );

  const addNode = useCallback(
    (kind: SimulatorNodeKind) => {
      if (readOnly) return;
      const id = crypto.randomUUID();
      const key = uniqueKey(kind, nodes);
      const offset = nodes.length * 36;
      const nextNode: SimulatorFlowNode = {
        id,
        type: nodeType(kind),
        position: { x: 90 + offset, y: 90 + offset },
        data: {
          key,
          kind,
          optional: kind === "question",
          translations: {
            fr: emptyTranslation(),
            en: emptyTranslation(),
            ar: emptyTranslation(),
          },
          options: [],
          entry: nodes.length === 0,
          interfaceLanguage: language,
          messages,
        },
      };
      setNodes((current) => [...current, nextNode]);
      setSelectedNodeId(id);
      markDirty();
    },
    [language, markDirty, messages, nodes, readOnly, setNodes],
  );

  const removeSelectedNode = useCallback(() => {
    if (!selectedNode || readOnly || nodes.length === 1) return;
    const nextNodes = nodes.filter((node) => node.id !== selectedNode.id);
    const wasEntry = selectedNode.data.entry;
    if (wasEntry && nextNodes[0]) {
      nextNodes[0] = {
        ...nextNodes[0],
        data: { ...nextNodes[0].data, entry: true },
      };
    }
    setNodes(nextNodes);
    setEdges((current) =>
      current.filter(
        (edge) =>
          edge.source !== selectedNode.id && edge.target !== selectedNode.id,
      ),
    );
    setSelectedNodeId(nextNodes[0]?.id ?? "");
    markDirty();
  }, [markDirty, nodes, readOnly, selectedNode, setEdges, setNodes]);

  const makeStart = useCallback(() => {
    if (!selectedNode || readOnly) return;
    setNodes((current) =>
      current.map((node) => ({
        ...node,
        data: { ...node.data, entry: node.id === selectedNode.id },
      })),
    );
    markDirty();
  }, [markDirty, readOnly, selectedNode, setNodes]);

  const onConnect = useCallback(
    (connection: Connection) => {
      if (readOnly || !connection.source || !connection.target) return;
      setEdges((current) => {
        const withoutExistingBranch = current.filter(
          (edge) =>
            !(
              edge.source === connection.source &&
              (edge.sourceHandle ?? null) === (connection.sourceHandle ?? null)
            ),
        );
        return addEdge(
          {
            ...connection,
            id: crypto.randomUUID(),
            type: "smoothstep",
            markerEnd: { type: MarkerType.ArrowClosed },
          },
          withoutExistingBranch,
        );
      });
      markDirty();
    },
    [markDirty, readOnly, setEdges],
  );

  /** Connects a choice (or an information step) without dragging on the canvas. */
  const connectBranch = useCallback(
    (sourceId: string, handle: string, choice: string) => {
      if (readOnly) return;
      let targetId = choice;
      if (choice.startsWith("create:")) {
        const kind = choice.slice("create:".length) as SimulatorNodeKind;
        const source = nodes.find((node) => node.id === sourceId);
        targetId = crypto.randomUUID();
        const key = uniqueKey(kind, nodes);
        setNodes((current) => [
          ...current,
          {
            id: targetId,
            type: nodeType(kind),
            position: {
              x: (source?.position.x ?? 80) + 340,
              y: (source?.position.y ?? 80) + current.length * 24,
            },
            data: {
              key,
              kind,
              optional: kind === "question",
              translations: {
                fr: emptyTranslation(),
                en: emptyTranslation(),
                ar: emptyTranslation(),
              },
              options: [],
              entry: false,
              interfaceLanguage: language,
              messages,
            },
          },
        ]);
      }
      setEdges((current) => {
        const without = current.filter(
          (edge) =>
            !(
              edge.source === sourceId && (edge.sourceHandle ?? null) === handle
            ),
        );
        return targetId
          ? [...without, canvasEdge(sourceId, targetId, handle)]
          : without;
      });
      markDirty();
    },
    [language, markDirty, messages, nodes, readOnly, setEdges, setNodes],
  );

  const autoArrange = useCallback(() => {
    if (readOnly) return;
    const positions = layoutFlow(
      graphToScriptNodes(toEditorNodes(nodes), toEditorEdges(edges)),
      nodes.find((node) => node.data.entry)?.data.key,
    );
    setNodes((current) =>
      current.map((node) => ({
        ...node,
        position: positions.get(node.data.key) ?? node.position,
      })),
    );
    markDirty();
  }, [edges, markDirty, nodes, readOnly, setNodes]);

  const scriptFromGraph = useMemo(
    () =>
      serializeFlowScript(
        metadata,
        graphToScriptNodes(toEditorNodes(nodes), toEditorEdges(edges)),
      ),
    [edges, metadata, nodes],
  );
  const scriptText = scriptDraft ?? scriptFromGraph;
  const scriptDirty = scriptDraft !== null && scriptDraft !== scriptFromGraph;
  const scriptIssues = useMemo(
    () => (scriptDirty ? parseFlowScript(scriptText).issues : []),
    [scriptDirty, scriptText],
  );

  const applyScript = useCallback(() => {
    if (readOnly) return;
    const parsed = parseFlowScript(scriptText);
    if (parsed.issues.length > 0) return;
    const graph = scriptNodesToGraph(parsed.nodes, toEditorNodes(nodes), () =>
      crypto.randomUUID(),
    );
    const knownPositions = new Map(
      nodes.map((node) => [node.data.key, node.position]),
    );
    const layout = layoutFlow(parsed.nodes);
    setNodes(
      graph.nodes.map((node) => ({
        id: node.id,
        type: nodeType(node.kind),
        position: knownPositions.get(node.key) ??
          layout.get(node.key) ?? { x: 80, y: 80 },
        data: {
          key: node.key,
          kind: node.kind,
          optional: node.optional,
          translations: node.translations,
          options: node.options,
          entry: node.entry,
          interfaceLanguage: language,
          messages,
        },
      })),
    );
    setEdges(
      graph.edges.map((edge) =>
        canvasEdge(edge.source, edge.target, edge.sourceHandle),
      ),
    );
    const scriptName = parsed.metadata.internalName?.trim() ?? "";
    setMetadata((current) => ({
      internalName: scriptName.length > 0 ? scriptName : current.internalName,
      sourceSummary: parsed.metadata.sourceSummary ?? current.sourceSummary,
      lastReviewedDate:
        parsed.metadata.lastReviewedDate ?? current.lastReviewedDate,
      reviewDueDate: parsed.metadata.reviewDueDate ?? current.reviewDueDate,
    }));
    setSelectedNodeId(
      graph.nodes.find((node) => node.entry)?.id ?? graph.nodes[0]?.id ?? "",
    );
    setScriptDraft(null);
    markDirty();
    toast.success(messages["script.applied"]);
  }, [
    language,
    markDirty,
    messages,
    nodes,
    readOnly,
    scriptText,
    setEdges,
    setNodes,
  ]);

  const readiness = useMemo(() => {
    const issues: Array<{ nodeId: string; message: string }> = [];
    for (const node of nodes) {
      if (!node.data.translations[sourceLanguage].prompt.trim()) {
        issues.push({
          nodeId: node.id,
          message: messages["validation.noPrompt"] ?? "",
        });
      }
      if (node.data.kind === "question" && node.data.options.length === 0) {
        issues.push({
          nodeId: node.id,
          message: messages["validation.noChoices"] ?? "",
        });
      }
      if (
        node.data.kind !== "result" &&
        !edges.some((edge) => edge.source === node.id)
      ) {
        issues.push({
          nodeId: node.id,
          message: messages["validation.noConnection"] ?? "",
        });
      }
    }
    return issues;
  }, [edges, messages, nodes, sourceLanguage]);

  const save = useCallback(() => {
    if (readOnly) return;
    const entryNode = nodes.find((node) => node.data.entry) ?? nodes[0];
    if (!entryNode) return;
    startSaving(async () => {
      try {
        const formData = new FormData();
        formData.set("locale", locale);
        formData.set("flowId", flowId);
        formData.set("versionId", versionId);
        formData.set(
          "graph",
          JSON.stringify({
            internalName: metadata.internalName,
            entryNodeId: entryNode.id,
            sourceSummary: metadata.sourceSummary,
            lastReviewedAt: dateToIso(metadata.lastReviewedDate),
            reviewDueAt: dateToIso(metadata.reviewDueDate),
            nodes: nodes.map((node) => ({
              id: node.id,
              key: node.data.key,
              kind: node.data.kind,
              optional: node.data.optional,
              position: node.position,
              translations: node.data.translations,
              options: node.data.options,
            })),
            edges: edges.map((edge) => ({
              id: edge.id,
              source: edge.source,
              target: edge.target,
              sourceHandle: edge.sourceHandle ?? null,
            })),
          }),
        );
        await saveSimulatorDraft(formData);
        setDirty(false);
        toast.success(messages["editor.saved"]);
      } catch {
        toast.error(messages["editor.saveError"]);
      }
    });
  }, [edges, flowId, locale, messages, metadata, nodes, readOnly, versionId]);

  const publish = useCallback(() => {
    startPublication(async () => {
      try {
        const formData = new FormData();
        formData.set("locale", locale);
        formData.set("flowId", flowId);
        formData.set("versionId", versionId);
        formData.set("reviewConfirmed", "confirmed");
        await publishSimulatorVersion(formData);
        toast.success(messages["publication.published"]);
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : messages["publication.publishError"],
        );
      }
    });
  }, [flowId, locale, messages, router, versionId]);

  const unpublish = useCallback(() => {
    startPublication(async () => {
      try {
        const formData = new FormData();
        formData.set("locale", locale);
        formData.set("flowId", flowId);
        formData.set("versionId", versionId);
        await unpublishSimulatorVersion(formData);
        toast.success(messages["publication.unpublished"]);
        router.refresh();
      } catch {
        toast.error(messages["publication.unpublishError"]);
      }
    });
  }, [flowId, locale, messages, router, versionId]);

  return (
    <div className="min-h-0">
      <div className="border-line bg-surface sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="bg-brand-soft text-brand hidden size-9 items-center justify-center rounded-lg sm:flex">
            <GitBranch aria-hidden />
          </span>
          <div className="min-w-0 max-w-4xl">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h1 className="truncate text-base font-semibold">
                {metadata.internalName}
              </h1>
              <Badge variant={status === "draft" ? "outline" : "secondary"}>
                {messages[`status.${status}`]}
              </Badge>
              <span className="text-copy-muted text-xs">
                {messages.sourceLanguage}:{" "}
                <span className="text-ink font-medium">
                  {messages[`language.${sourceLanguage}`]}
                </span>
              </span>
            </div>
            <p
              className="text-copy-muted mt-0.5 truncate text-xs"
              title={metadata.sourceSummary}
            >
              {(messages.version ?? "").replace(
                "{number}",
                String(versionNumber),
              )}
              {dirty ? ` · ${messages["editor.unsaved"] ?? ""}` : ""}
              {metadata.sourceSummary ? ` · ${metadata.sourceSummary}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {status === "draft" ? (
            <Button
              type="button"
              onClick={save}
              disabled={readOnly || isSaving}
            >
              <Save aria-hidden />
              {messages["editor.save"]}
            </Button>
          ) : null}
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={previewUrl} target="_blank" />}
          >
            <Globe2 aria-hidden />
            {messages["publication.preview"]}
          </Button>
          {status === "published" ? (
            <>
              <Button
                nativeButton={false}
                render={<Link href={publicUrl} target="_blank" />}
              >
                <Globe2 aria-hidden />
                {messages["publication.viewPublic"]}
              </Button>
              <AlertDialog>
                <AlertDialogTrigger
                  render={<Button type="button" variant="outline" />}
                >
                  {messages["publication.unpublish"]}
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {messages["publication.unpublishTitle"]}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {messages["publication.unpublishDescription"]}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{messages.cancel}</AlertDialogCancel>
                    <AlertDialogAction
                      type="button"
                      variant="destructive"
                      disabled={isPublicationPending}
                      onClick={unpublish}
                    >
                      {messages["publication.unpublish"]}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          ) : status === "draft" ? (
            <AlertDialog>
              <AlertDialogTrigger
                render={<Button type="button" variant="outline" />}
                disabled={
                  dirty ||
                  readiness.length > 0 ||
                  demoContent ||
                  isPublicationPending
                }
                aria-describedby="simulator-publication-gate"
                title={
                  demoContent
                    ? messages["publication.demoGate"]
                    : messages["publication.publishHint"]
                }
              >
                <LockKeyhole aria-hidden />
                {messages["publication.publish"]}
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {messages["publication.publishTitle"]}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {messages["publication.publishDescription"]}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{messages.cancel}</AlertDialogCancel>
                  <AlertDialogAction
                    type="button"
                    disabled={isPublicationPending}
                    onClick={publish}
                  >
                    {messages["publication.confirm"]}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}
        </div>
      </div>

      <div
        className={cn(
          "grid min-h-[calc(100dvh-12rem)]",
          view === "canvas" && "xl:grid-cols-[minmax(0,1fr)_24rem]",
        )}
      >
        <main className="bg-subtle min-w-0">
          <div className="border-line bg-surface flex flex-wrap items-center gap-2 border-b px-4 py-3">
            <div
              className="border-line bg-subtle me-1 flex gap-1 rounded-lg border p-1"
              role="group"
              aria-label={messages["editor.viewLabel"]}
            >
              <Button
                type="button"
                size="sm"
                variant={view === "canvas" ? "default" : "ghost"}
                onClick={() => {
                  setView("canvas");
                }}
              >
                <Network aria-hidden />
                {messages["editor.viewCanvas"]}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={view === "script" ? "default" : "ghost"}
                onClick={() => {
                  setView("script");
                }}
              >
                <Code2 aria-hidden />
                {messages["editor.viewScript"]}
              </Button>
            </div>
            {view === "canvas" ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    addNode("question");
                  }}
                  disabled={readOnly}
                >
                  <CircleHelp aria-hidden />
                  {messages["editor.addQuestion"]}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    addNode("information");
                  }}
                  disabled={readOnly}
                >
                  <FileText aria-hidden />
                  {messages["editor.addInformation"]}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    addNode("result");
                  }}
                  disabled={readOnly}
                >
                  <Flag aria-hidden />
                  {messages["editor.addResult"]}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={autoArrange}
                  disabled={readOnly}
                >
                  <LayoutGrid aria-hidden />
                  {messages["editor.autoArrange"]}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedNodeId("");
                  }}
                >
                  <FileText aria-hidden />
                  {messages["editor.metadata"]}
                </Button>
                <p className="text-copy-muted ms-auto hidden text-xs md:block">
                  {messages["editor.graphHint"]}
                </p>
              </>
            ) : (
              <p className="text-copy-muted ms-auto hidden text-xs md:block">
                {messages["script.toolbarHint"]}
              </p>
            )}
          </div>

          {view === "script" ? (
            <SimulatorScriptView
              value={scriptText}
              issues={scriptIssues}
              dirty={scriptDirty}
              readOnly={readOnly}
              messages={messages}
              onChange={setScriptDraft}
              onApply={applyScript}
              onReset={() => {
                setScriptDraft(null);
              }}
            />
          ) : (
            <>
              <div className="hidden h-[calc(100dvh-15.2rem)] min-h-[36rem] md:block">
                <ReactFlow<SimulatorFlowNode>
                  nodes={nodes}
                  edges={edges}
                  nodeTypes={nodeTypes}
                  onNodesChange={(changes) => {
                    onNodesChange(changes);
                    if (
                      changes.some(
                        (change) =>
                          change.type === "position" ||
                          change.type === "remove",
                      )
                    ) {
                      markDirty();
                    }
                  }}
                  onEdgesChange={(changes) => {
                    onEdgesChange(changes);
                    if (changes.length > 0) markDirty();
                  }}
                  onConnect={onConnect}
                  onNodeClick={(_, node) => {
                    setSelectedNodeId(node.id);
                  }}
                  onPaneClick={() => {
                    setSelectedNodeId("");
                  }}
                  nodesDraggable={!readOnly}
                  nodesConnectable={!readOnly}
                  edgesReconnectable={!readOnly}
                  deleteKeyCode={readOnly ? null : ["Backspace", "Delete"]}
                  fitView
                  fitViewOptions={{ padding: 0.22 }}
                  minZoom={0.35}
                  maxZoom={1.5}
                  defaultEdgeOptions={{
                    type: "smoothstep",
                    markerEnd: { type: MarkerType.ArrowClosed },
                  }}
                  aria-label={messages["editor.canvas"]}
                >
                  <Background
                    variant={BackgroundVariant.Dots}
                    gap={20}
                    size={1.2}
                  />
                  <Controls showInteractive={false} />
                  <MiniMap
                    pannable
                    zoomable
                    nodeStrokeWidth={2}
                    className="hidden lg:block"
                  />
                </ReactFlow>
              </div>

              <div className="p-4 md:hidden">
                <div className="border-line bg-brand-soft text-brand mb-4 flex gap-3 rounded-xl border p-3 text-sm">
                  <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <p>{messages["mobile.canvasNotice"]}</p>
                </div>
                <div
                  className="space-y-2"
                  aria-label={messages["editor.outline"]}
                >
                  {nodes.map((node, index) => {
                    const Icon = kindIcon(node.data.kind);
                    const prompt =
                      node.data.translations[language].prompt.trim() ||
                      messages["node.untitled"];
                    return (
                      <button
                        key={node.id}
                        type="button"
                        onClick={() => {
                          setSelectedNodeId(node.id);
                        }}
                        className={cn(
                          "border-line bg-surface flex w-full items-center gap-3 rounded-xl border p-3 text-start",
                          selectedNodeId === node.id &&
                            "border-brand ring-brand/20 ring-4",
                        )}
                      >
                        <GripVertical
                          className="text-copy-muted size-4"
                          aria-hidden
                        />
                        <span className="bg-brand-soft text-brand flex size-8 shrink-0 items-center justify-center rounded-lg">
                          <Icon className="size-4" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="text-copy-muted block text-[11px] font-semibold uppercase tracking-wide">
                            {String(index + 1).padStart(2, "0")} ·{" "}
                            {messages[`node.${node.data.kind}`]}
                          </span>
                          <span className="block truncate text-sm font-medium">
                            {prompt}
                          </span>
                        </span>
                        {node.data.entry ? (
                          <Badge variant="secondary">
                            {messages["editor.start"]}
                          </Badge>
                        ) : (
                          <ArrowRight
                            className="text-copy-muted size-4"
                            aria-hidden
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </main>

        {view === "canvas" ? (
          <aside className="border-line bg-surface border-s xl:max-h-[calc(100dvh-8.8rem)] xl:overflow-y-auto xl:border-s">
            <div className="border-line border-b p-4">
              <h2 className="font-semibold">
                {messages["validation.heading"]}
              </h2>
              <p className="text-copy-muted mt-1 text-xs leading-relaxed">
                {messages["validation.hint"]}
              </p>
              <div className="mt-3 space-y-2">
                {readiness.length === 0 ? (
                  <div className="bg-ok-soft text-ok flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium">
                    <Check className="size-4" aria-hidden />
                    {messages["validation.ready"]}
                  </div>
                ) : (
                  readiness.slice(0, 4).map((issue, index) => (
                    <button
                      key={`${issue.nodeId}:${String(index)}`}
                      type="button"
                      onClick={() => {
                        setSelectedNodeId(issue.nodeId);
                      }}
                      className="bg-warn-soft text-warn flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start text-xs font-medium"
                    >
                      <AlertCircle className="size-4 shrink-0" aria-hidden />
                      {issue.message}
                    </button>
                  ))
                )}
              </div>
              <p
                id="simulator-publication-gate"
                className="text-copy-muted mt-3 flex gap-2 text-xs leading-relaxed"
              >
                <LockKeyhole className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                {demoContent
                  ? messages["publication.demoGate"]
                  : dirty
                    ? messages["publication.saveFirst"]
                    : readiness.length > 0
                      ? messages["publication.structureGate"]
                      : messages["publication.publishHint"]}
              </p>
            </div>

            {translationPanel ? (
              <div className="border-line border-b p-4">
                <h2 className="font-semibold">
                  {messages["translation.heading"]}
                </h2>
                <p className="text-copy-muted mt-1 text-xs leading-relaxed">
                  {messages["translation.hint"]}
                </p>
                <div className="mt-4">{translationPanel}</div>
              </div>
            ) : null}

            {stewardPanel ? (
              <div className="border-line border-b p-4">{stewardPanel}</div>
            ) : null}

            {selectedNode ? (
              <NodeInspector
                node={selectedNode}
                language={language}
                readOnly={readOnly}
                messages={messages}
                canRemove={nodes.length > 1}
                steps={nodes
                  .filter((candidate) => candidate.id !== selectedNode.id)
                  .map((candidate) => ({
                    id: candidate.id,
                    key: candidate.data.key,
                    kind: candidate.data.kind,
                    label:
                      candidate.data.translations[language].prompt.trim() ||
                      candidate.data.key,
                  }))}
                outgoing={edges
                  .filter((edge) => edge.source === selectedNode.id)
                  .map((edge) => ({
                    handle: edge.sourceHandle ?? "next",
                    target: edge.target,
                  }))}
                onUpdate={(update) => {
                  updateNodeData(selectedNode.id, update);
                }}
                onRemoveChoice={(choiceId) => {
                  setEdges((current) =>
                    current.filter(
                      (edge) =>
                        !(
                          edge.source === selectedNode.id &&
                          edge.sourceHandle === `option:${choiceId}`
                        ),
                    ),
                  );
                }}
                onConnect={(handle, choice) => {
                  connectBranch(selectedNode.id, handle, choice);
                }}
                onMakeStart={makeStart}
                onRemove={removeSelectedNode}
              />
            ) : (
              <MetadataInspector
                metadata={metadata}
                locale={locale}
                readOnly={readOnly}
                messages={messages}
                onChange={(next) => {
                  setMetadata(next);
                  markDirty();
                }}
              />
            )}
          </aside>
        ) : null}
      </div>
    </div>
  );
}

function MetadataInspector({
  metadata,
  locale,
  readOnly,
  messages,
  onChange,
}: {
  metadata: SimulatorEditorMetadata;
  locale: Locale;
  readOnly: boolean;
  messages: Record<string, string>;
  onChange: (metadata: SimulatorEditorMetadata) => void;
}) {
  return (
    <div className="space-y-5 p-4">
      <div>
        <h2 className="font-semibold">{messages["editor.metadata"]}</h2>
        <p className="text-copy-muted mt-1 text-xs">
          {messages["editor.sourceSummaryHint"]}
        </p>
      </div>
      <Field>
        <FieldLabel htmlFor="simulator-internal-name">
          {messages.internalName}
        </FieldLabel>
        <Input
          id="simulator-internal-name"
          value={metadata.internalName}
          disabled={readOnly}
          onChange={(event) => {
            onChange({ ...metadata, internalName: event.target.value });
          }}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="simulator-source-summary">
          {messages["editor.sourceSummary"]}
        </FieldLabel>
        <Textarea
          id="simulator-source-summary"
          value={metadata.sourceSummary}
          disabled={readOnly}
          rows={5}
          onChange={(event) => {
            onChange({ ...metadata, sourceSummary: event.target.value });
          }}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <FieldLabel htmlFor="simulator-last-reviewed">
            {messages["editor.lastReviewed"]}
          </FieldLabel>
          <DatePicker
            id="simulator-last-reviewed"
            name="lastReviewedDate"
            locale={locale}
            defaultValue={metadata.lastReviewedDate}
            placeholder={messages["date.select"] ?? ""}
            clearLabel={messages["date.clear"] ?? ""}
            disabled={readOnly}
            onValueChange={(value) => {
              onChange({ ...metadata, lastReviewedDate: value });
            }}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="simulator-review-due">
            {messages["editor.reviewDue"]}
          </FieldLabel>
          <DatePicker
            id="simulator-review-due"
            name="reviewDueDate"
            locale={locale}
            defaultValue={metadata.reviewDueDate}
            placeholder={messages["date.select"] ?? ""}
            clearLabel={messages["date.clear"] ?? ""}
            disabled={readOnly}
            onValueChange={(value) => {
              onChange({ ...metadata, reviewDueDate: value });
            }}
          />
        </Field>
      </div>
    </div>
  );
}

interface InspectorStep {
  id: string;
  key: string;
  kind: SimulatorNodeKind;
  label: string;
}

/** Picks (or creates) the next step for one branch, as an alternative to dragging. */
function BranchSelect({
  id,
  value,
  steps,
  readOnly,
  messages,
  onSelect,
}: {
  id: string;
  value: string;
  steps: InspectorStep[];
  readOnly: boolean;
  messages: Record<string, string>;
  onSelect: (choice: string) => void;
}) {
  return (
    <SelectField
      id={id}
      value={value}
      disabled={readOnly}
      aria-label={messages["editor.nextStep"]}
      className="h-8 text-xs"
      onValueChange={onSelect}
    >
      <option value="">{messages["editor.noNextStep"]}</option>
      {steps.map((step) => (
        <option key={step.id} value={step.id}>
          {step.label.length > 48 ? `${step.label.slice(0, 48)}…` : step.label}
        </option>
      ))}
      <option value="create:question">
        {messages["editor.createQuestionStep"]}
      </option>
      <option value="create:information">
        {messages["editor.createInformationStep"]}
      </option>
      <option value="create:result">
        {messages["editor.createResultStep"]}
      </option>
    </SelectField>
  );
}

function NodeInspector({
  node,
  language,
  readOnly,
  messages,
  canRemove,
  steps,
  outgoing,
  onUpdate,
  onRemoveChoice,
  onConnect,
  onMakeStart,
  onRemove,
}: {
  node: SimulatorFlowNode;
  language: SimulatorLanguage;
  readOnly: boolean;
  messages: Record<string, string>;
  canRemove: boolean;
  steps: InspectorStep[];
  outgoing: { handle: string; target: string }[];
  onUpdate: (update: (data: SimulatorNodeData) => SimulatorNodeData) => void;
  onRemoveChoice: (choiceId: string) => void;
  onConnect: (handle: string, choice: string) => void;
  onMakeStart: () => void;
  onRemove: () => void;
}) {
  const translation = node.data.translations[language];
  const targetFor = (handle: string) =>
    outgoing.find((edge) => edge.handle === handle)?.target ?? "";
  const updateTranslation = (
    field: keyof SimulatorTranslation,
    value: string,
  ) => {
    onUpdate((data) => ({
      ...data,
      translations: {
        ...data.translations,
        [language]: { ...data.translations[language], [field]: value },
      },
    }));
  };

  const addChoice = () => {
    const id = crypto.randomUUID();
    const choiceNumber = node.data.options.length + 1;
    onUpdate((data) => ({
      ...data,
      options: [
        ...data.options,
        {
          id,
          key: `choice_${String(choiceNumber)}`,
          preferNotToSay: false,
          labels: { fr: "", en: "", ar: "" },
        },
      ],
    }));
  };

  return (
    <div className="space-y-5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-brand text-xs font-semibold uppercase tracking-wide">
            {messages[`node.${node.data.kind}`]}
          </p>
          <h2 className="mt-1 font-semibold">{messages["editor.inspector"]}</h2>
        </div>
        {!node.data.entry ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onMakeStart}
            disabled={readOnly}
          >
            {messages["editor.makeStart"]}
          </Button>
        ) : (
          <Badge variant="secondary">{messages["editor.startHint"]}</Badge>
        )}
      </div>

      <Field>
        <FieldLabel htmlFor={`node-key-${node.id}`}>
          {messages["node.key"]}
        </FieldLabel>
        <Input
          id={`node-key-${node.id}`}
          value={node.data.key}
          disabled={readOnly}
          dir="ltr"
          className="font-mono"
          onChange={(event) => {
            onUpdate((data) => ({
              ...data,
              key: event.target.value
                .toLowerCase()
                .replaceAll(" ", "_")
                .replace(/[^a-z0-9_-]/g, ""),
            }));
          }}
        />
        <FieldDescription>{messages["node.keyHint"]}</FieldDescription>
      </Field>

      <Field>
        <FieldLabel htmlFor={`node-prompt-${node.id}`}>
          {messages["node.prompt"]} · {messages[`language.${language}`]}
        </FieldLabel>
        <Textarea
          id={`node-prompt-${node.id}`}
          value={translation.prompt}
          disabled={readOnly}
          rows={3}
          dir={language === "ar" ? "rtl" : "ltr"}
          onChange={(event) => {
            updateTranslation("prompt", event.target.value);
          }}
        />
      </Field>

      <Field>
        <FieldLabel htmlFor={`node-explanation-${node.id}`}>
          {messages["node.explanation"]}
        </FieldLabel>
        <Textarea
          id={`node-explanation-${node.id}`}
          value={translation.explanation}
          disabled={readOnly}
          rows={3}
          dir={language === "ar" ? "rtl" : "ltr"}
          onChange={(event) => {
            updateTranslation("explanation", event.target.value);
          }}
        />
      </Field>

      {node.data.kind === "information" ? (
        <Field>
          <FieldLabel htmlFor={`node-next-${node.id}`}>
            {messages["editor.nextStep"]}
          </FieldLabel>
          <BranchSelect
            id={`node-next-${node.id}`}
            value={targetFor("next")}
            steps={steps}
            readOnly={readOnly}
            messages={messages}
            onSelect={(choice) => {
              onConnect("next", choice);
            }}
          />
          <FieldDescription>{messages["editor.nextStepHint"]}</FieldDescription>
        </Field>
      ) : null}

      {node.data.kind === "result" ? (
        <>
          <Field>
            <FieldLabel htmlFor={`node-result-${node.id}`}>
              {messages["node.resultBody"]}
            </FieldLabel>
            <Textarea
              id={`node-result-${node.id}`}
              value={translation.resultBody}
              disabled={readOnly}
              rows={6}
              dir={language === "ar" ? "rtl" : "ltr"}
              onChange={(event) => {
                updateTranslation("resultBody", event.target.value);
              }}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`node-disclaimer-${node.id}`}>
              {messages["node.disclaimer"]}
            </FieldLabel>
            <Textarea
              id={`node-disclaimer-${node.id}`}
              value={translation.disclaimer}
              disabled={readOnly}
              rows={3}
              dir={language === "ar" ? "rtl" : "ltr"}
              onChange={(event) => {
                updateTranslation("disclaimer", event.target.value);
              }}
            />
          </Field>
        </>
      ) : null}

      {node.data.kind === "question" ? (
        <>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={node.data.optional}
              disabled={readOnly}
              onCheckedChange={(checked) => {
                onUpdate((data) => ({ ...data, optional: checked }));
              }}
            />
            {messages["node.optional"]}
          </label>
          <div className="border-line border-t pt-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">
                {messages["node.choices"]}
              </h3>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addChoice}
                disabled={readOnly}
              >
                <Plus aria-hidden />
                {messages["node.addChoice"]}
              </Button>
            </div>
            {node.data.options.length === 0 ? (
              <p className="text-copy-muted mt-3 text-xs leading-relaxed">
                {messages["node.noChoices"]}
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                {node.data.options.map((option, index) => (
                  <div
                    key={option.id}
                    className="border-line bg-subtle rounded-xl border p-3"
                  >
                    <div className="flex items-center gap-2">
                      <Input
                        value={option.labels[language]}
                        disabled={readOnly}
                        aria-label={messages["node.choiceLabel"]}
                        placeholder={messages["node.choiceLabel"]}
                        dir={language === "ar" ? "rtl" : "ltr"}
                        onChange={(event) => {
                          onUpdate((data) => ({
                            ...data,
                            options: data.options.map((item) =>
                              item.id === option.id
                                ? {
                                    ...item,
                                    labels: {
                                      ...item.labels,
                                      [language]: event.target.value,
                                    },
                                  }
                                : item,
                            ),
                          }));
                        }}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={readOnly}
                        onClick={() => {
                          onRemoveChoice(option.id);
                          onUpdate((data) => ({
                            ...data,
                            options: data.options.filter(
                              (item) => item.id !== option.id,
                            ),
                          }));
                        }}
                      >
                        <Trash2 aria-hidden />
                        <span className="sr-only">
                          {messages["node.removeChoice"]}
                        </span>
                      </Button>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Input
                        value={option.key}
                        disabled={readOnly}
                        aria-label={messages["node.choiceKey"]}
                        className="h-8 flex-1 font-mono text-xs"
                        dir="ltr"
                        onChange={(event) => {
                          onUpdate((data) => ({
                            ...data,
                            options: data.options.map((item) =>
                              item.id === option.id
                                ? {
                                    ...item,
                                    key: event.target.value
                                      .toLowerCase()
                                      .replaceAll(" ", "_")
                                      .replace(/[^a-z0-9_-]/g, ""),
                                  }
                                : item,
                            ),
                          }));
                        }}
                      />
                      <label className="text-copy-muted flex items-center gap-2 text-xs">
                        <Checkbox
                          checked={option.preferNotToSay}
                          disabled={readOnly}
                          onCheckedChange={(checked) => {
                            onUpdate((data) => ({
                              ...data,
                              options: data.options.map((item) =>
                                item.id === option.id
                                  ? { ...item, preferNotToSay: checked }
                                  : item,
                              ),
                            }));
                          }}
                        />
                        {messages["node.preferNotToSay"]}
                      </label>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-copy-muted shrink-0 text-[11px] tabular-nums">
                        {String(index + 1).padStart(2, "0")} →
                      </span>
                      <BranchSelect
                        id={`option-target-${option.id}`}
                        value={targetFor(`option:${option.id}`)}
                        steps={steps}
                        readOnly={readOnly}
                        messages={messages}
                        onSelect={(choice) => {
                          onConnect(`option:${option.id}`, choice);
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}

      <div className="border-line border-t pt-5">
        <Button
          type="button"
          variant="destructive"
          className="w-full"
          onClick={onRemove}
          disabled={readOnly || !canRemove}
        >
          <Trash2 aria-hidden />
          {messages["editor.removeStep"]}
        </Button>
        <p className="text-copy-muted mt-2 text-center text-xs">
          {messages["editor.removeStepHint"]}
        </p>
      </div>
    </div>
  );
}
