/**
 * One flat label map for the translation workspace and its per-language menus.
 *
 * Four surfaces mount that workspace — creating an article, creating an
 * activity, editing either — and each arrives with a different page catalogue.
 * The editor's own vocabulary is not one of them: it lives once, in the create
 * catalogue (`dashboard-overview`), namespaced `create.` for the page that owns
 * it. The workspace knows those words without the prefix, so the prefix comes
 * off here rather than in four copies of the same loop.
 *
 * Later bags fill gaps only. A surface's catalogue carries its own `title` and
 * `description` for its own fields, and letting those win would quietly rename
 * the editor's labels on one screen out of four.
 */
export function buildWorkspaceLabels(
  editor: Record<string, string>,
  ...fill: Record<string, string>[]
): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const [key, value] of Object.entries(editor)) {
    if (!key.startsWith("create.")) continue;
    labels[key.slice("create.".length)] = value;
  }
  for (const bag of fill) {
    for (const [key, value] of Object.entries(bag)) {
      labels[key] ??= value;
    }
  }
  return labels;
}
