# Article list design QA

## Evidence

- Reference: `/Users/bagadi/Documents/screen-shots/Screenshot 2026-07-30 at 12.42.44.png`
- Implementation, light: `/private/tmp/infokit-article-list-light.png`
- Implementation, dark: `/private/tmp/infokit-article-list-dark.png`
- Implementation, compact viewport: `/private/tmp/infokit-article-list-mobile.png`
- Full comparison: `/private/tmp/infokit-article-list-comparison.png`
- Focused row comparison: `/private/tmp/infokit-article-row-comparison.png`

The reference was captured at 1372 × 1158. The desktop implementation was
captured at the same aspect ratio and normalized to 1372 × 1158 for the
side-by-side comparison. The compact implementation was also checked at a
390 × 844 browser viewport override.

## Review

The reference is used as the structural target for the article rows rather
than as a replacement for InfoKit's existing visual language. The implemented
rows preserve the reference's hierarchy: date first, a wider title and concise
summary, then factual owner and a relative review age beside one another at
the bottom. Article cards retain the requested rounded outline and transparent
surface, while semantic color tokens keep the treatment legible in light and
dark themes.

Responsive inspection confirmed that the metadata remains on one line when
space permits and wraps without horizontal overflow on compact screens.
Relative review text is server-prepared and the exact review date remains
available through semantic `<time>` markup and its tooltip.

## Issue history

- P0: none.
- P1: none.
- P2: the reference includes thumbnails, but the current published article
  fixtures do not provide cover images. The component keeps a compact,
  rounded logical-end thumbnail slot for articles that do provide one.

Browser console errors: none.

## Final result

passed
