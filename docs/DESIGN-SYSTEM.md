# InfoKit — Design System ("Clinique")

**Adopted 25 July 2026.** Imported from the Claude Design project
`InfoKit Design System.dc.html` (project `1e802571-c30a-49bc-9c08-6ae9ed0c26d6`)
and encoded in code by [`packages/tokens/src/index.ts`](../packages/tokens/src/index.ts).

This file is the source of truth for visual decisions. When code and this file
disagree, this file wins and the code is a bug. When this file and the imported
sheet disagree, the sheet wins and this file is a bug.

---

## 1. Who this is for

The public site is read by people who are displaced, often on a borrowed or
low-battery Android phone, on a metered or captive-portal connection, standing
up, in a language that is not the language of the country they are in, and
frequently under stress. Everything below follows from that:

- **Answers before atmosphere.** The first screen of any page answers "is it
  open, where is it, who runs it, when was this checked".
- **Every claim is dated.** Freshness is content, not chrome.
- **The interface must survive degradation** — no images, no web fonts, no
  shadows, no JavaScript — and still be usable.
- **Nothing is signalled by colour alone.**

## 2. Normative rules

1. **Colour never alone.** Every state carries an icon **and** a word. A green
   dot is never the only "open".
2. **Body copy never below 16px.** Small text is reserved for metadata labels,
   never for instructions.
3. **Reading order of an activity card is fixed:** name → status and next time →
   place and distance → audience → services → providing association →
   freshness. Cards may compress, never reorder.
4. **Inline links inside paragraphs use `accentDeep`**, underlined. The mid-tone
   `accent` is for fills, icons and borders — not for text on canvas.
5. **Focus is always visible:** a 2px `accent` ring with a 2px offset, on every
   interactive element, never removed on mouse users.
6. **Minimum tap target 48×48px** on the public site (36px is allowed only
   inside the editor workspace, on pointer devices).
7. **Degradation order.** Features are dropped in this order when the device or
   network cannot carry them: motion → shadows → decorative images → web fonts
   → colour → layout. Layout and text content never depend on the layers above.
8. **RTL is a first-class direction,** not a mirror hack: logical properties
   only (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`), never `ml-*`/`left-*`.
9. **No colour decisions in components.** Components consume semantic roles
   from `@infokit/tokens`; hex values exist in exactly one file.

## 3. Colour roles

Two complete sets, one per scheme. Every value is an opaque hex so the same
token works in CSS and in React Native.

| Role                      | Light                 | Dark                  | Use                                     |
| ------------------------- | --------------------- | --------------------- | --------------------------------------- |
| `canvas`                  | `#EFF5F3`             | `#0D1A18`             | page background                         |
| `surface`                 | `#FBFEFD`             | `#142523`             | cards, sheets, header                   |
| `surfaceSubtle`           | `#E4EFEC`             | `#1B302D`             | inset bands, table headers, chips       |
| `ink`                     | `#10231F`             | `#E6F2EF`             | body copy                               |
| `textMuted`               | `#5B6F6B`             | `#9FB3AF`             | metadata labels only                    |
| `border`                  | `#D3E2DE`             | `#22403C`             | hairlines, default card ring            |
| `borderStrong`            | `#BFD5D0`             | `#2F5651`             | inputs, hovered cards                   |
| `accent`                  | `#0F766E`             | `#4FD1C5`             | fills, icons, active states             |
| `accentHover`             | `#0F6A63`             | `#64D6CB`             | hover/pressed fill                      |
| `accentDeep`              | `#0B544E`             | `#A7E8E1`             | accent **text** on canvas, inline links |
| `accentContrast`          | `#F0FBF9`             | `#0D1A18`             | text on an accent fill                  |
| `accentSoft`              | `#D3ECE8`             | `#10403C`             | washes, selected rows, callouts         |
| `accentSoftInk`           | `#0B544E`             | `#C9F2EE`             | text on `accentSoft`                    |
| `success` / `successSoft` | `#0F7A3D` / `#D2E5DB` | `#59C98A` / `#173127` | open, verified, yes                     |
| `warning` / `warningSoft` | `#8A5A06` / `#E9E3D2` | `#DDB96A` / `#2C2A1E` | uncertain, expiring                     |
| `danger` / `dangerSoft`   | `#A3282C` / `#EFDAD9` | `#EF8F8A` / `#2F2523` | cancelled, error, no                    |
| `neutralStatus` / `…Soft` | `#5B6F6B` / `#DEE6E3` | `#9FB3AF` / `#1D2B29` | closed, inactive, unknown               |

The accent is a **care teal**: institutional enough to be trusted, far enough
from the blue of border-police and government sites to not be mistaken for one.

## 4. Type, space, shape

- **Headings** — Work Sans, 600/700, tight tracking.
- **Body** — Public Sans, 400/500, 1.6 line height, minimum 16px.
- **Arabic script** — Noto Sans Arabic in both roles; it leads the stack for
  `ar`/`ckb`/`fa`/`prs`/`ps`.
- Scale (rem): 0.75 label · 0.875 metadata · **1 body** · 1.125 lead ·
  1.375 h3 · 1.75 h2 · 2.25 h1 (2.75 on the home hero).
- **Grid** 4px; component padding on the public site is 16/24; page gutters
  16 mobile / 24 tablet / 32 desktop; content column max 72ch, page max 1200px.
- **Radii** 8 chips · 12 controls and inputs · 20 cards and panels · full pills.
- **Elevation** is a ring plus a soft shadow, always in that order, so dropping
  shadows (rule 7) leaves the card outline intact:
  `sm 0 1px 2px /4%`, `md 0 4px 12px /6%`, `lg 0 12px 32px /10%`.
- **Densities**: `comfortable` (1.0×, the public site, always) and `compact`
  (0.70×, the editor workspace only).

## 5. Components

- **Buttons.** Solid (`accent` fill, `accentContrast` label) for the one primary
  action per view; outline (`borderStrong`, `ink`) for secondary; quiet (text
  `accentDeep`) for tertiary. Height 48 public / 40 dense, radius 12.
- **Chips.** `surfaceSubtle` fill, `border` hairline, radius 8, icon in
  `accentDeep` + word. Service chips are neutral: the icon and the word identify
  the service — there is no per-service hue.
- **Stat blocks.** Big number in Work Sans over a `textMuted` uppercase label;
  used for counts, never for anything the reader must act on.
- **Freshness marker.** "Checked <date>" with a check icon in `success`;
  degrades to `warning` + "to confirm" when the check is older than the
  content's review window, and to `neutralStatus` + "not available" when unknown.
- **Cards** are `surface` + `border` ring + radius 20 + `md` shadow on hover
  only. A card is a link target in full; the visible affordance is its title.
- **Notices** carry an icon, a bold one-line summary, then detail — in
  `accentSoft` (info), `warningSoft`, `dangerSoft`.

## 6. Status ramp

Four roles, because "open now" is not the only answer the reader needs:

| Role      | Token pair                            | Icon           | Word                    |
| --------- | ------------------------------------- | -------------- | ----------------------- |
| open      | `success` / `successSoft`             | check-circle   | Open                    |
| closed    | `neutralStatus` / `neutralStatusSoft` | clock          | Closed (+ next opening) |
| cancelled | `danger` / `dangerSoft`               | x-circle       | Cancelled               |
| uncertain | `warning` / `warningSoft`             | alert-triangle | To confirm              |

`uncertain` is not a failure state: it is the honest answer when the schedule
exists but has not been verified inside its review window, and it is preferred
over showing a stale "open".

## 7. Imagery

Photographs are optional and never carry information. They are cropped 16:9 or
4:3, sit behind a `surface` ring, and always have either a real alt text or an
explicit decorative flag from the editor. No stock photography of people in
distress. No image is required for a card to make sense.

## 8. Where this lives in code

| Concern                       | File                                                               |
| ----------------------------- | ------------------------------------------------------------------ |
| Token values                  | `packages/tokens/src/index.ts`                                     |
| CSS variables (`--infokit-*`) | `apps/web/src/components/design-tokens.tsx`                        |
| Tailwind role mapping         | `apps/web/src/styles/globals.css`                                  |
| Public surface                | `apps/web/src/components/public/*`                                 |
| Native surface                | `packages/ui` (React Native Reusables + NativeWind), `apps/mobile` |

See [UI-ARCHITECTURE.md](UI-ARCHITECTURE.md) for how the web and native layers
are split, and [DESIGN.md](DESIGN.md) for the product rules that generated these
constraints.
