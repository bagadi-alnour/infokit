import sanitizeHtml from "sanitize-html";

const allowedTags = [
  "p",
  "br",
  "strong",
  "em",
  "u",
  "s",
  "h2",
  "h3",
  "blockquote",
  "ul",
  "ol",
  "li",
  "code",
  "pre",
  "a",
  "hr",
];

/**
 * Rich descriptions are author input, never trusted HTML. Keep a deliberately
 * small editorial vocabulary and derive the public/searchable plain text on
 * the server instead of trusting the browser payload.
 */
export function sanitizeRichText(value: string) {
  const html = sanitizeHtml(value, {
    allowedTags,
    allowedAttributes: {
      a: ["href", "target", "rel"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowProtocolRelative: false,
    transformTags: {
      a: (_tagName, attributes) => ({
        tagName: "a",
        attribs: {
          ...attributes,
          rel: "noopener noreferrer",
        },
      }),
    },
  }).trim();
  const text = sanitizeHtml(html, {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/\s+/g, " ")
    .trim();

  return {
    html: text ? html : null,
    text: text || null,
  };
}
