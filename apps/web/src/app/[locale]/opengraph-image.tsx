import { loadPageCatalog } from "@infokit/shared/i18n/catalogs";
import { light } from "@infokit/tokens";
import { ImageResponse } from "next/og";

import { defaultShareCard, siteConfig } from "~/seo/site";

/**
 * The share card every public page without a cover of its own falls back to. A
 * link pasted into a chat arrives as a card rather than a bare URL, and that
 * card is often all someone sees before deciding whether to open it.
 *
 * The same card in every locale, on purpose. Drawing eleven scripts would mean
 * embedding fonts for Arabic, Persian, Ethiopic and Sorani, and one missing
 * glyph renders as a row of empty boxes — worse than no card. So it carries the
 * site's own line in the two Latin-script languages it is authored in, taken
 * from the catalogue rather than written here, and a page with a real cover
 * overrides it with something specific anyway.
 */

export const alt = defaultShareCard.alt;
export const size = {
  width: defaultShareCard.width,
  height: defaultShareCard.height,
};
export const contentType = "image/png";

export default async function Image() {
  const [fr, en] = await Promise.all([
    loadPageCatalog("fr", "home"),
    loadPageCatalog("en", "home"),
  ]);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: light.canvas,
        color: light.ink,
        padding: 80,
      }}
    >
      {/* The wordmark, drawn rather than typeset: the leading "i" of
       * "infoKit" is the information disc itself (docs/DESIGN-SYSTEM.md §5). */}
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <div
          style={{
            width: 84,
            height: 84,
            borderRadius: 84,
            background: light.accent,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <div
            style={{
              width: 13,
              height: 13,
              borderRadius: 13,
              background: light.accentContrast,
            }}
          />
          <div
            style={{
              width: 12,
              height: 26,
              borderRadius: 6,
              background: light.accentContrast,
            }}
          />
        </div>
        <div style={{ fontSize: 76, fontWeight: 700, letterSpacing: -2 }}>
          {siteConfig.name.slice(1)}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 22,
          maxWidth: 940,
        }}
      >
        <div style={{ fontSize: 46, lineHeight: 1.25, fontWeight: 600 }}>
          {fr["home.metaDescription"]}
        </div>
        <div style={{ fontSize: 30, lineHeight: 1.3, color: light.textMuted }}>
          {en["home.metaDescription"]}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          fontSize: 26,
          color: light.accentDeep,
        }}
      >
        <div style={{ width: 64, height: 6, background: light.accent }} />
        {siteConfig.url.host}
      </div>
    </div>,
    size,
  );
}
