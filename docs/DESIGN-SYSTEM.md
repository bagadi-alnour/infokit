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
   freshness. Cards may compress, never reorder. A row with nothing to say is
   left out, not shown empty: an activity the platform publishes itself has no
   providing association, so that row disappears and the rest keeps its order.
4. **Inline links inside paragraphs use `accentDeep`**, underlined. The mid-tone
   `accent` is for fills, icons and borders — not for text on canvas.
5. **Focus is always visible:** a 2px `accent` ring with a 2px offset, on every
   interactive element, never removed on mouse users. One exception, for
   geometry rather than taste: a control that anchors a popup the width of
   itself draws its 2px inside its own edge — border and ring in `accent`,
   meeting — so that focusing it cannot make it wider than the list it opens.
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
| `eventAccent` / `…Wash`   | `#3B4BA8` / `#E3E6F6` | `#A9B4F5` / `#1B2340` | agenda family (see §5)                  |
| `articleAccent` / `…Wash` | `#7A3A72` / `#F1E4EF` | `#E2A8D8` / `#2E2033` | reading family                          |
| `guideAccent` / `…Wash`   | `#8F5220` / `#F4E7D9` | `#E4B489` / `#33261B` | guide family                            |

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
- **Cards** are `surface` + `border` ring + radius 20 + the `sm` shadow at rest,
  and **no shadow moves on hover**: what answers the pointer is the ring taking
  the family hue, plus a 2px rise. A shelf where every card blooms under the
  cursor is chrome competing with the answers printed on it, and rule 7 drops
  shadows before anything a reader needs. A card is a link target in full; the
  visible affordance is its title.
  **The activity card is still.** It carries the answer itself — status, address,
  hours, how old the check is — and a card a reader is mid-sentence in must not
  move under the cursor that is tracking the line. It keeps the ring on focus,
  which is the only pointer a keyboard reader has; the shelves that are routes
  onward rather than answers (articles, the agenda, associations) keep the rise.
- **Content families.** Each kind of card is built differently, so a reader
  recognises what they are holding before reading it. One shape and one hue per
  family, and no family may take more than the one element named here:

  | Family   | Hue                         | The one thing that carries it                  |
  | -------- | --------------------------- | ---------------------------------------------- |
  | activity | the status ramp (§6)        | a 6px rule across the head of the card         |
  | event    | `eventAccent` / `eventWash` | the date, in a washed block                    |
  | article  | `articleAccent`             | a short rule under the title; nothing filled   |
  | guide    | `guideAccent` / `guideWash` | the whole card is washed — it is an invitation |

  Family hues are **structural, never signals**: they carry no state, they never
  appear inside a status pill or a notice, and rule 1 still holds — nothing is
  understood from a family colour alone. A family hue follows its content from
  the list into the detail screen, on exactly one element there too.

  The four hues are the **same four on the site and in the app**, under the same
  utility names (`text-event`, `bg-guide-wash`, …) so a screen and a page cannot
  drift apart. Beyond the card itself a family may colour two more things, and
  only these:

  - **the opening of a page or a section** — a tinted eyebrow plus a short rule
    before the heading, so the reader meets the hue before the first card;
  - **the card's own affordance word** — "Read article", "Event details",
    "Open" — because that word is the promise of what the hue leads to.

  Everything else on the surface stays neutral. The home page is where all four
  meet, and it is the only place they appear side by side.

- **Notices** carry an icon, a bold one-line summary, then detail — in
  `accentSoft` (info), `warningSoft`, `dangerSoft`.
- **Site chrome.** The public bar is **one line at every width**, and what it can
  hold changes rather than how many lines it takes: the mark, then the six
  sections from `lg` up, then the reader's preferences. Language stays on the bar
  at every width — reading the page at all depends on it — while the sections and
  the theme move into the menu below `lg`. The bar earns a shadow only once the
  page has moved under it.
  - **The associations' door** (sign-in) is chrome, never a section: a reader
    needs nothing behind it, so it is quiet, it sits last on the bar, below the
    sections in the menu, and on one line in the footer. On the bar it is a glyph
    alone — the one exception to writing the word beside the icon, because the bar
    is glanced at and nothing a reader needs is behind it; its name is carried by
    `aria-label` and `title`. Where the reader is choosing rather than glancing —
    the menu row, the footer line — it is written out, and it says whose door it
    is rather than only "sign in".
  - **The menu** is a modal drawer against the reading edge: one 56px row per
    section in reading order, the current one marked by a rail as well as a wash
    (rule 1), theme as two named choices at the foot. Escape closes it, focus
    stays inside it, and a thumb can throw it back towards the edge it came from.
    The burger folds into a cross, the rows arrive just behind the panel — all of
    it decoration over a layout that is already correct (rule 7).
  - **The footer** is the mark and what the platform is, the sections again for a
    reader who arrived at the bottom, then the sentence that qualifies every
    answer above it. The sections are a two-column grid on a phone: six stacked
    rows read as a scroll of their own.

## 6. Status ramp

Four roles, because "open now" is not the only answer the reader needs:

| Role      | Token pair                            | Icon           | Word                    |
| --------- | ------------------------------------- | -------------- | ----------------------- |
| open      | `success` / `successSoft`             | beating dot    | Open                    |
| closed    | `neutralStatus` / `neutralStatusSoft` | clock          | Closed (+ next opening) |
| cancelled | `danger` / `dangerSoft`               | x-circle       | Cancelled               |
| uncertain | `warning` / `warningSoft`             | alert-triangle | To confirm              |

`uncertain` is not a failure state: it is the honest answer when the schedule
exists but has not been verified inside its review window, and it is preferred
over showing a stale "open".

`open` is the one row whose glyph is not an icon. A check reads as "someone
verified this", which is the freshness marker's claim and the wrong one to make
about a state that is only true at this minute; a dot with a beat is what a
reader already reads as "now". Rule 1 is unchanged — the dot is never alone, the
word "Open" is beside it — and the beat is the halo only, so a reader who has
asked for less motion keeps the dot (rule 7).

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
