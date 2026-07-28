import type { StructuredData } from "~/seo/structured-data";

/**
 * Emits one or more schema.org nodes for the page.
 *
 * `<` is escaped because the payload carries editor-authored text: without it a
 * title containing `</script>` would end the block early and the rest of the
 * JSON would be parsed as markup. Nothing else in the payload needs escaping,
 * since `JSON.stringify` already handles quotes and newlines.
 */
export function JsonLd({ data }: { data: StructuredData | StructuredData[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replaceAll("<", "\\u003c"),
      }}
    />
  );
}
