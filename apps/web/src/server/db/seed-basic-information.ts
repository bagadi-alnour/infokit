/* eslint-disable no-console -- CLI seed script reports progress to stdout */
import "dotenv/config";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import {
  hashContent,
  localizedContentHash,
  type LocalizedContent,
} from "../content/editorial";
import { migratorUrl } from "./migrator-url";
import * as s from "./schema";

/**
 * The basic-information block, moved out of configuration and into the
 * authoring path it was always a placeholder for.
 *
 * `packages/shared/src/basics/index.ts` holds these numbers as two hardcoded
 * tables and says so in its own header: the digits carry no owner, no
 * last-checked date and no review interval, so a reader is given no way to judge
 * how old they are — exactly the staleness the platform exists to end. This
 * script writes the same facts as `editorial_entries` of kind
 * `basic_information`, which means each one arrives with a custodian, a review
 * date, a revision history and eleven languages that an editor can correct.
 *
 * Why this is a *seed* and not a fixture (AGENTS.md rule 5):
 *
 * - Nothing here is fictional and nothing is invented. Every number and every
 *   sentence is copied from what the repository already publishes — the six
 *   state numbers from `emergencyNumbers`, the three association lines from
 *   `helpLines`, and the words from the `basics.*` keys in `public-content`,
 *   which are already the reviewed public copy the site renders today. Eight of
 *   the eleven catalogues are only partly translated, so those languages arrive
 *   empty rather than filled with English — which is the honest state, and one
 *   the console can ask a translator to close.
 * - Every entry is published, in each language it has wording for.
 *
 *   This script originally left everything `draft`, on the reasoning that
 *   publishing is an editorial act and not a database one. That reasoning was
 *   right about new claims and wrong about these: the same numbers, in the same
 *   words, are *already* on the public home page — they are rendered from the
 *   `basics.*` catalogue keys this script copies from. Holding them back as
 *   drafts would not have kept anything unpublished; it would only have kept the
 *   page reading them from a hardcoded table with no owner and no review date,
 *   which is the exact failure the move exists to end. The editorial act here is
 *   the recheck that `review_due_at` will ask for, not a first publication.
 *
 *   Languages with no wording of their own are not published, because there is
 *   nothing to publish; the public reader falls back to the source language, so
 *   a reader in a language nobody has translated still gets the number.
 * - The association lines name their association in `answered_by_organization_id`
 *   and cite the guide in `source_summary`, which is the sourcing record the same
 *   rule asks for.
 *
 * Reruns never overwrite by accident. An entry that already exists is compared
 * with the reviewed copy and the differences are printed, because by then an
 * editor may have corrected it and this script's copy would be the older claim.
 * `--reword` is how a correction made here is actually published, as a new
 * revision rather than an edit — see `rewordContact`.
 *
 *   pnpm --filter @infokit/web db:seed:basics
 *   pnpm --filter @infokit/web db:seed:basics:reword
 */

const url = migratorUrl();
const client = postgres(url, { max: 1 });
const db = drizzle(client);

/** Every editorial language, in the order the console lists them. */
const LANGUAGES = [
  "fr",
  "en",
  "ar",
  "fa",
  "prs",
  "ps",
  "ckb",
  "am",
  "ti",
  "so",
  "om",
] as const;

type Language = (typeof LANGUAGES)[number];

/**
 * The label and the sentence saying when to use it, per language.
 *
 * Partial, because eight of the eleven catalogues are only partly translated and
 * a language with no wording of its own is left absent rather than filled in.
 */
type Copy = Partial<Record<Language, { title: string; summary: string }>>;

interface ContactFixture {
  slug: string;
  icon: string;
  /** Position in the block. Lower is read first. */
  priority: number;
  /** The one number for danger. At most one row carries this. */
  emergency: boolean;
  /**
   * Whose phone rings, and therefore which of the two public blocks the tile is
   * drawn in. Stated on every fixture rather than defaulted: the association
   * heading is a claim, and a claim should be written down rather than inherited
   * from a column default.
   */
  operator: "state" | "association";
  dial: string;
  reach: "voice" | "sms" | "whatsapp";
  /** The number this tile presses when that is not the number it is about. */
  dialInstead?: string;
  /** The association whose phone this is; absent for a state number. */
  answeredBy?: string;
  categoryCode?: string;
  /**
   * Where the fact came from, in the editor-only field. A state number cites the
   * country; an association line cites the edition of the guide it was printed
   * in, which is what a recheck is done against.
   */
  source: string;
  /**
   * How long until this has to be looked at again. A state number is stable for
   * a year; an association line moves when the association reorganises, so it is
   * asked for every quarter.
   */
  reviewDays: number;
  /**
   * The two `public-content` keys holding this tile's wording today: the label,
   * and the sentence saying when to use it. Naming the keys rather than pasting
   * the strings is what makes this a move — there is one copy of these words in
   * the repository, and once the entries are published the keys go away with the
   * hardcoded table they served.
   */
  labelKey: string;
  hintKey: string;
}

/**
 * The eleven raw public-content catalogues, read as files rather than through
 * `loadCatalog`.
 *
 * `loadCatalog` is the right reader for a page: it falls back to English for the
 * eight languages whose interface is only partly translated, which is how the
 * site avoids a blank screen. It is the wrong reader here. Storing an English
 * sentence in the Persian row and stamping it `human` would assert that somebody
 * wrote it in Persian, and the console would then offer it for publication as
 * Persian. So the files are read directly and a language that has no wording of
 * its own is simply left absent — the editor sees the language empty, which is
 * the truth, and can request a translation for it from the workspace.
 */
const CATALOG_DIRECTORY = "../../../../../packages/shared/src/i18n/messages";

const catalogs = {
  fr: () => import(`${CATALOG_DIRECTORY}/fr/public-content.json`),
  en: () => import(`${CATALOG_DIRECTORY}/en/public-content.json`),
  ar: () => import(`${CATALOG_DIRECTORY}/ar/public-content.json`),
  fa: () => import(`${CATALOG_DIRECTORY}/fa/public-content.json`),
  prs: () => import(`${CATALOG_DIRECTORY}/prs/public-content.json`),
  ps: () => import(`${CATALOG_DIRECTORY}/ps/public-content.json`),
  ckb: () => import(`${CATALOG_DIRECTORY}/ckb/public-content.json`),
  am: () => import(`${CATALOG_DIRECTORY}/am/public-content.json`),
  ti: () => import(`${CATALOG_DIRECTORY}/ti/public-content.json`),
  so: () => import(`${CATALOG_DIRECTORY}/so/public-content.json`),
  om: () => import(`${CATALOG_DIRECTORY}/om/public-content.json`),
} satisfies Record<Language, () => Promise<unknown>>;

/**
 * Read the languages of one `basics.*` pair out of those catalogues.
 *
 * The catalogues are the reviewed public copy — the same strings the home page
 * renders today — so copying them is a move rather than a rewrite.
 */
async function copyFromCatalog(
  labelKey: string,
  hintKey: string,
): Promise<Copy> {
  const result = {} as Copy;
  for (const language of LANGUAGES) {
    const loaded = (await catalogs[language]()) as {
      default: Record<string, string | undefined>;
    };
    const title = loaded.default[labelKey];
    const summary = loaded.default[hintKey];
    if (title === undefined || summary === undefined) continue;
    result[language] = { title, summary };
  }
  return result;
}

/**
 * The order is the advice: the number for danger, then the ones for a specific
 * emergency, then a bed, then the written line, then the association lines.
 * `priority` is spaced by ten so an editor can slot a number between two of
 * these without renumbering the block.
 */
const CONTACTS: ContactFixture[] = [
  {
    slug: "urgence-112",
    icon: "siren",
    priority: 10,
    emergency: true,
    operator: "state",
    dial: "112",
    reach: "voice",
    source:
      "Numéro d’urgence européen unique, valable dans toute l’Union européenne (service-public.fr).",
    reviewDays: 365,
    labelKey: "basics.number.emergency",
    hintKey: "basics.number.emergencyHint",
  },
  {
    slug: "samu-15",
    icon: "ambulance",
    priority: 20,
    emergency: false,
    operator: "state",
    dial: "15",
    reach: "voice",
    categoryCode: "health_wellbeing",
    source: "Numéro national d’aide médicale urgente (SAMU), France.",
    reviewDays: 365,
    labelKey: "basics.number.ambulance",
    hintKey: "basics.number.ambulanceHint",
  },
  {
    slug: "police-17",
    icon: "shield",
    priority: 30,
    emergency: false,
    operator: "state",
    dial: "17",
    reach: "voice",
    source: "Numéro national police-secours, France.",
    reviewDays: 365,
    labelKey: "basics.number.police",
    hintKey: "basics.number.policeHint",
  },
  {
    slug: "pompiers-18",
    icon: "flame",
    priority: 40,
    emergency: false,
    operator: "state",
    dial: "18",
    reach: "voice",
    source: "Numéro national des sapeurs-pompiers, France.",
    reviewDays: 365,
    labelKey: "basics.number.fire",
    hintKey: "basics.number.fireHint",
  },
  {
    slug: "hebergement-urgence-115",
    icon: "bed",
    priority: 50,
    emergency: false,
    operator: "state",
    dial: "115",
    reach: "voice",
    categoryCode: "shelter_access",
    source:
      "Numéro national d’urgence sociale (SIAO / 115), France. Gratuit, ouvert en permanence.",
    reviewDays: 365,
    labelKey: "basics.number.shelter",
    hintKey: "basics.number.shelterHint",
  },
  {
    // Texted, never called, which is the whole reason `reach` exists as a
    // column: offering a call here would send a deaf reader to a line that
    // cannot answer them.
    slug: "urgence-114-sms",
    icon: "message-square",
    priority: 60,
    emergency: false,
    operator: "state",
    dial: "114",
    reach: "sms",
    source:
      "Numéro d’urgence pour les personnes sourdes et malentendantes (114), France. Par SMS, fax ou chat — jamais par la voix.",
    reviewDays: 365,
    labelKey: "basics.number.deaf",
    hintKey: "basics.number.deafHint",
  },
  {
    /**
     * France's own sea-rescue number, answered by the CROSS, which coordinates
     * rescues in these waters.
     *
     * Last in the state block and directly above the association line, because
     * the order is the advice: 112 for any emergency, 196 for a rescue at sea,
     * and only then the volunteer network that can relay an alert. A reader who
     * reads the block top to bottom meets the services that can launch a boat
     * before the one that cannot.
     */
    slug: "secours-en-mer-196",
    icon: "waves",
    priority: 65,
    emergency: false,
    operator: "state",
    dial: "196",
    reach: "voice",
    source:
      "Numéro national de secours en mer (196), coordonné par les CROSS — ministère chargé de la mer.",
    reviewDays: 365,
    labelKey: "basics.number.seaRescue",
    hintKey: "basics.number.seaRescueHint",
  },
  {
    /**
     * The volunteer network, and its own number.
     *
     * It used to press 112 while printing Alarm Phone's number, because the
     * guide's instruction is to reach an official rescue service first and a
     * volunteer phone must never stand between a sinking boat and a launch. The
     * card that dialled somebody else's number is no longer how that is said:
     * 112 and 196 are each their own card above this one, and this card's own
     * text sends the reader to them first. A card that prints one number and
     * dials another is a surprise, and a reader in distress cannot afford one.
     */
    slug: "alarm-phone-secours-en-mer",
    icon: "life-buoy",
    priority: 70,
    emergency: false,
    operator: "association",
    dial: "+33 486 51 71 61",
    reach: "voice",
    /**
     * No `answeredBy`, and it is a fact rather than an omission. Alarm Phone is
     * its own transnational network, not one of the Calais associations in
     * `core.organizations` — naming any of them here would put a claim about
     * somebody else on a published card. Its name is in the label, where it
     * belongs, and the column stays empty until the network has a record of its
     * own.
     */
    source:
      "Channel Info Project, « New Arrival Guide — Calais », édition de juillet 2026 (lc.cx/calais). Réseau Alarm Phone — ligne bénévole : à revérifier contre l’édition courante chaque trimestre.",
    reviewDays: 90,
    labelKey: "basics.help.seaRescue",
    hintKey: "basics.help.seaRescueHint",
  },
  {
    slug: "utopia-56-nuit",
    icon: "tent",
    priority: 80,
    emergency: false,
    operator: "association",
    dial: "+33 7 53 91 85 96",
    reach: "voice",
    answeredBy: "utopia-56",
    categoryCode: "shelter_access",
    source:
      "Channel Info Project, « New Arrival Guide — Calais », édition de juillet 2026 (lc.cx/calais). Ligne bénévole : à revérifier contre l’édition courante chaque trimestre.",
    reviewDays: 90,
    labelKey: "basics.help.shelterNight",
    hintKey: "basics.help.shelterNightHint",
  },
  {
    slug: "human-rights-observers-expulsions",
    icon: "eye",
    priority: 90,
    emergency: false,
    operator: "association",
    dial: "+33 6 51 46 68 81",
    reach: "whatsapp",
    answeredBy: "auberge-des-migrants",
    categoryCode: "legal_orientation",
    source:
      "Channel Info Project, « New Arrival Guide — Calais », édition de juillet 2026 (lc.cx/calais). Ligne bénévole, joignable aussi sur WhatsApp : à revérifier contre l’édition courante chaque trimestre.",
    reviewDays: 90,
    labelKey: "basics.help.evictions",
    hintKey: "basics.help.evictionsHint",
  },
];

function must<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`Seed integrity: missing ${what}`);
  return value;
}

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

/**
 * Who these entries are authored by, and where they sit.
 *
 * The author is whichever platform account holds the write grant. Nothing here
 * is attributed to a person who did not do it: the account named is the one that
 * will open each entry and publish it, and `source_summary` on every revision
 * says the words were moved from configuration rather than written fresh.
 */
async function loadContext() {
  const [city] = await db
    .select({ id: s.cities.id })
    .from(s.cities)
    .where(eq(s.cities.code, "calais"))
    .limit(1);

  const [author] = await db
    .select({ id: s.users.id, email: s.users.email })
    .from(s.users)
    .innerJoin(s.userPlatformRoles, eq(s.userPlatformRoles.userId, s.users.id))
    .innerJoin(s.roles, eq(s.roles.id, s.userPlatformRoles.roleId))
    .innerJoin(s.rolePermissions, eq(s.rolePermissions.roleId, s.roles.id))
    .where(
      and(
        eq(s.rolePermissions.permissionCode, "content.basic_information.write"),
        isNull(s.roles.organizationId),
      ),
    )
    .limit(1);

  const organizationSlugs = [
    ...new Set(
      CONTACTS.map((contact) => contact.answeredBy).filter(
        (slug): slug is string => slug !== undefined,
      ),
    ),
  ];
  const organizationRows =
    organizationSlugs.length > 0
      ? await db
          .select({ id: s.organizations.id, slug: s.organizations.slug })
          .from(s.organizations)
          .where(inArray(s.organizations.slug, organizationSlugs))
      : [];

  const categoryCodes = [
    ...new Set(
      CONTACTS.map((contact) => contact.categoryCode).filter(
        (code): code is string => code !== undefined,
      ),
    ),
  ];
  const categoryRows =
    categoryCodes.length > 0
      ? await db
          .select({
            id: s.serviceCategories.id,
            code: s.serviceCategories.code,
          })
          .from(s.serviceCategories)
          .where(inArray(s.serviceCategories.code, categoryCodes))
      : [];

  return {
    cityId: must(city, "the Calais city row (run pnpm db:seed first)").id,
    authorId: must(
      author,
      "a platform account holding content.basic_information.write",
    ).id,
    authorEmail: must(author, "the authoring account").email,
    organizationIds: new Map(
      organizationRows.map((row) => [row.slug, row.id] as const),
    ),
    categoryIds: new Map(
      categoryRows.map((row) => [row.code, row.id] as const),
    ),
  };
}

type Context = Awaited<ReturnType<typeof loadContext>>;

function localized(copy: { title: string; summary: string }): LocalizedContent {
  return {
    title: copy.title,
    summary: copy.summary,
    // A tile is a label, a sentence and a number: there is no body and no
    // reading text beyond the sentence itself.
    bodyHtml: null,
    plainText: null,
  };
}

/**
 * The wording one entry should carry, in the languages that have any.
 *
 * French is the source language, so a fixture whose French key is missing is a
 * fixture nobody can publish: that is a mistake in this file rather than a
 * translation gap, and it stops the run.
 */
async function authoredCopy(fixture: ContactFixture) {
  const copy = await copyFromCatalog(fixture.labelKey, fixture.hintKey);
  const authored = LANGUAGES.flatMap((language) => {
    const wording = copy[language];
    return wording ? [{ language, wording }] : [];
  });
  if (!authored.some((entry) => entry.language === "fr")) {
    throw new Error(
      `Seed integrity: ${fixture.labelKey} has no French wording, and French is the source language`,
    );
  }
  return authored;
}

async function seedContact(context: Context, fixture: ContactFixture) {
  const [existing] = await db
    .select({ id: s.editorialEntries.id })
    .from(s.editorialEntries)
    .where(eq(s.editorialEntries.slug, fixture.slug))
    .limit(1);
  if (existing) {
    await rewordContact(context, fixture, existing.id);
    return;
  }

  const authored = await authoredCopy(fixture);
  const organizationId = fixture.answeredBy
    ? must(
        context.organizationIds.get(fixture.answeredBy),
        `organisation ${fixture.answeredBy}`,
      )
    : null;
  const categoryId = fixture.categoryCode
    ? must(
        context.categoryIds.get(fixture.categoryCode),
        `service category ${fixture.categoryCode}`,
      )
    : null;
  const now = new Date();

  await db.transaction(async (tx) => {
    const [entry] = await tx
      .insert(s.editorialEntries)
      .values({
        kind: "basic_information",
        slug: fixture.slug,
        // Published: these numbers are already public, rendered from the very
        // catalogue keys this script copies. See the header.
        workflowState: "published",
        cityId: context.cityId,
      })
      .returning({ id: s.editorialEntries.id });
    const entryId = must(entry, `entry ${fixture.slug}`).id;

    /**
     * No `editorial_entry_routes` row: a tile is read inside the urgent block on
     * the home page and has no URL of its own, so a route would reserve a slug
     * that nothing will ever serve.
     */
    await tx.insert(s.basicInformationDetails).values({
      entryId,
      icon: fixture.icon,
      priority: fixture.priority,
      emergency: fixture.emergency,
      operator: fixture.operator,
      categoryId,
      dial: fixture.dial,
      reach: fixture.reach,
      dialInstead: fixture.dialInstead ?? null,
      answeredByOrganizationId: organizationId,
    });

    const [revision] = await tx
      .insert(s.editorialRevisions)
      .values({
        entryId,
        revisionNumber: 1,
        authorId: context.authorId,
        sourceLanguageCode: "fr",
        /**
         * True for every one of these. A number that goes stale silently is the
         * fact this kind exists to date — even a state number, since the review
         * date is what tells a reader somebody looked.
         */
        canBecomeOutdated: true,
        sourceSummary: fixture.source,
        lastReviewedAt: now,
        reviewDueAt: daysFromNow(fixture.reviewDays),
      })
      .returning({ id: s.editorialRevisions.id });
    const revisionId = must(revision, `revision for ${fixture.slug}`).id;

    const sourceContent = {
      sourceLanguage: "fr",
      articleDate: null,
      translations: Object.fromEntries(
        authored.map(({ language, wording }) => [language, localized(wording)]),
      ),
    };
    const [sourceVersion] = await tx
      .insert(s.translationSourceVersions)
      .values({
        // The custodian is the platform, so the source version belongs to no
        // organisation — `answered_by_organization_id` says whose phone rings,
        // which is a different question from who maintains the record.
        organizationId: null,
        entityKind: "editorial_entry",
        entityId: entryId,
        version: 1,
        sourceRevisionId: revisionId,
        sourceLanguageCode: "fr",
        sourceContentJson: sourceContent,
        sourceContentHash: hashContent(sourceContent),
        impact: "initial",
        createdById: context.authorId,
      })
      .returning({ id: s.translationSourceVersions.id });
    const sourceVersionId = must(
      sourceVersion,
      `source version for ${fixture.slug}`,
    ).id;

    for (const { language, wording } of authored) {
      const payload = localized(wording);
      await tx.insert(s.editorialRevisionTranslations).values({
        revisionId,
        languageCode: language,
        title: payload.title,
        summary: payload.summary,
        /**
         * `human` and `needs_review`, and the pair is deliberate. These strings
         * were written and reviewed by people — they are the interface
         * catalogues the site ships — so calling them machine output would be
         * false. But nobody has yet confirmed them *as a dated contact record*,
         * which is what a review of one of these asserts, so every language
         * arrives asking to be read.
         *
         * `needs_review` and published at the same time is not a contradiction
         * here: it is precisely the state these words are in. They are live on
         * the site today and nobody has dated them. The flag is what puts each
         * one in front of a reviewer, and `review_due_at` is what keeps it there.
         */
        state: "needs_review",
        method: "human",
        sourceVersionId,
        contentHash: localizedContentHash(language, payload),
        reviewStage: "none",
      });

      /**
       * One publication row per language that has wording, which is what makes
       * the tile readable on the public page. A language nobody has translated
       * gets no row rather than an English one under its name — the reader falls
       * back to the source language and still gets the number, which is the part
       * that has to survive a missing translation.
       */
      await tx.insert(s.editorialPublications).values({
        entryId,
        languageCode: language,
        revisionId,
        sourceVersionId,
        translationContentHash: localizedContentHash(language, payload),
        publishedById: context.authorId,
        publishedAt: now,
      });
    }

    // The platform holds these: no association can confirm a state number, and
    // the two that belong to associations are maintained here until one of them
    // asks for custody.
    await tx.insert(s.editorialCustodianships).values({
      entryId,
      custodianKind: "platform",
      organizationId: null,
      actorUserId: context.authorId,
      startedAt: now,
    });
  });

  console.log(
    `basic information: ${fixture.slug} (${fixture.dial}, ${fixture.operator}, ${String(authored.length)} languages published)`,
  );
}

/**
 * An entry that already exists, checked against the reviewed copy — and, with
 * `--reword`, corrected.
 *
 * Creating is the easy half. The hard half is a correction: these words are
 * published on the home page in eleven languages, and when one of them turns out
 * to be wrong in a way that matters — a claim about the law, a number that
 * promises a bed it cannot give — leaving it live until somebody retypes eleven
 * translations in the console is not a plan. So this pass exists, and two things
 * make it safe to have:
 *
 * - It never edits history. A correction is a *new* revision, a new source
 *   version and a new publication per language, with the previous publication
 *   marked unpublished — exactly what the console does when an editor saves and
 *   publishes (`dashboard/basics/actions.ts`). `editorial_revisions` and
 *   `translation_source_versions` are append-only by design, and nothing here
 *   asks them to be otherwise.
 * - It is opt-in. Without the flag the pass only *reports* the drift, because by
 *   now an editor may have corrected an entry by hand and this file's copy would
 *   be the older claim. Overwriting somebody's correction has to be a decision
 *   somebody takes, at a prompt, in front of the diff it prints.
 *
 *     pnpm --filter @infokit/web db:seed:basics:reword
 */
const REWORD = process.argv.slice(2).includes("--reword");

/** What the stored entry says today, next to what the repository now says. */
interface WordingDrift {
  language: Language;
  storedTitle: string | null;
  storedSummary: string | null;
  title: string;
  summary: string;
}

async function rewordContact(
  context: Context,
  fixture: ContactFixture,
  entryId: string,
) {
  const authored = await authoredCopy(fixture);
  const organizationId = fixture.answeredBy
    ? must(
        context.organizationIds.get(fixture.answeredBy),
        `organisation ${fixture.answeredBy}`,
      )
    : null;
  const categoryId = fixture.categoryCode
    ? must(
        context.categoryIds.get(fixture.categoryCode),
        `service category ${fixture.categoryCode}`,
      )
    : null;

  const [latest] = await db
    .select({
      id: s.editorialRevisions.id,
      revisionNumber: s.editorialRevisions.revisionNumber,
    })
    .from(s.editorialRevisions)
    .where(eq(s.editorialRevisions.entryId, entryId))
    .orderBy(desc(s.editorialRevisions.revisionNumber))
    .limit(1);
  if (!latest) throw new Error(`${fixture.slug} has no revision`);

  const stored = new Map(
    (
      await db
        .select({
          languageCode: s.editorialRevisionTranslations.languageCode,
          title: s.editorialRevisionTranslations.title,
          summary: s.editorialRevisionTranslations.summary,
        })
        .from(s.editorialRevisionTranslations)
        .where(eq(s.editorialRevisionTranslations.revisionId, latest.id))
    ).map((row) => [row.languageCode, row] as const),
  );

  const [detail] = await db
    .select({
      icon: s.basicInformationDetails.icon,
      priority: s.basicInformationDetails.priority,
      emergency: s.basicInformationDetails.emergency,
      operator: s.basicInformationDetails.operator,
      categoryId: s.basicInformationDetails.categoryId,
      dial: s.basicInformationDetails.dial,
      reach: s.basicInformationDetails.reach,
      dialInstead: s.basicInformationDetails.dialInstead,
      answeredByOrganizationId:
        s.basicInformationDetails.answeredByOrganizationId,
    })
    .from(s.basicInformationDetails)
    .where(eq(s.basicInformationDetails.entryId, entryId))
    .limit(1);

  const wantedDetail = {
    icon: fixture.icon,
    priority: fixture.priority,
    emergency: fixture.emergency,
    operator: fixture.operator,
    categoryId,
    dial: fixture.dial,
    reach: fixture.reach,
    dialInstead: fixture.dialInstead ?? null,
    answeredByOrganizationId: organizationId,
  };
  const detailChanged =
    !detail ||
    (Object.keys(wantedDetail) as (keyof typeof wantedDetail)[]).some(
      (key) => detail[key] !== wantedDetail[key],
    );

  const drift: WordingDrift[] = authored.flatMap(({ language, wording }) => {
    const row = stored.get(language);
    if (row?.title === wording.title && row.summary === wording.summary) {
      return [];
    }
    return [
      {
        language,
        storedTitle: row?.title ?? null,
        storedSummary: row?.summary ?? null,
        title: wording.title,
        summary: wording.summary,
      },
    ];
  });

  if (drift.length === 0 && !detailChanged) {
    console.log(`basic information: ${fixture.slug} (up to date)`);
    return;
  }

  if (!REWORD) {
    console.log(
      `basic information: ${fixture.slug} DIFFERS from the reviewed copy — ${String(drift.length)} language(s)${detailChanged ? ", and its dial/order details" : ""}. Rerun with --reword to publish the correction, or correct it in /dashboard/basics.`,
    );
    for (const row of drift) {
      console.log(`  ${row.language}: ${row.storedSummary ?? "(none)"}`);
      console.log(`  ${row.language} → ${row.summary}`);
    }
    return;
  }

  const now = new Date();
  await db.transaction(async (tx) => {
    if (detailChanged) {
      await tx
        .update(s.basicInformationDetails)
        .set(wantedDetail)
        .where(eq(s.basicInformationDetails.entryId, entryId));
    }

    const [revision] = await tx
      .insert(s.editorialRevisions)
      .values({
        entryId,
        revisionNumber: latest.revisionNumber + 1,
        authorId: context.authorId,
        sourceLanguageCode: "fr",
        canBecomeOutdated: true,
        sourceSummary: fixture.source,
        /**
         * The platform did look at this entry today — that is what a correction
         * is — so the date it carries is today's. What it does *not* claim is
         * that the association answering the phone confirmed anything: that is
         * the card's own badge, which stays "not yet confirmed" until custody
         * moves (`public-basics-payload.ts`).
         */
        lastReviewedAt: now,
        reviewDueAt: daysFromNow(fixture.reviewDays),
      })
      .returning({ id: s.editorialRevisions.id });
    const revisionId = must(revision, `revision for ${fixture.slug}`).id;

    const [previousVersion] = await tx
      .select({
        id: s.translationSourceVersions.id,
        version: s.translationSourceVersions.version,
      })
      .from(s.translationSourceVersions)
      .where(
        and(
          eq(s.translationSourceVersions.entityKind, "editorial_entry"),
          eq(s.translationSourceVersions.entityId, entryId),
        ),
      )
      .orderBy(desc(s.translationSourceVersions.version))
      .limit(1);

    const sourceContent = {
      sourceLanguage: "fr",
      articleDate: null,
      translations: Object.fromEntries(
        authored.map(({ language, wording }) => [language, localized(wording)]),
      ),
    };
    const [sourceVersion] = await tx
      .insert(s.translationSourceVersions)
      .values({
        organizationId: null,
        entityKind: "editorial_entry",
        entityId: entryId,
        version: (previousVersion?.version ?? 0) + 1,
        previousVersionId: previousVersion?.id ?? null,
        sourceRevisionId: revisionId,
        sourceLanguageCode: "fr",
        sourceContentJson: sourceContent,
        sourceContentHash: hashContent(sourceContent),
        // The words moved, so every language has to be read again — the same
        // impact the console records when an editor edits a published source.
        impact: "review_required",
        createdById: context.authorId,
      })
      .returning({ id: s.translationSourceVersions.id });
    const sourceVersionId = must(
      sourceVersion,
      `source version for ${fixture.slug}`,
    ).id;

    for (const { language, wording } of authored) {
      const payload = localized(wording);
      await tx.insert(s.editorialRevisionTranslations).values({
        revisionId,
        languageCode: language,
        title: payload.title,
        summary: payload.summary,
        state: "needs_review",
        method: "human",
        sourceVersionId,
        contentHash: localizedContentHash(language, payload),
        reviewStage: "none",
      });

      // The previous publication of this language stops being the live one, and
      // the new revision takes its place — the console's own two steps, in the
      // same order, so the public read model never sees two active rows.
      await tx
        .update(s.editorialPublications)
        .set({ unpublishedAt: now, unpublishedById: context.authorId })
        .where(
          and(
            eq(s.editorialPublications.entryId, entryId),
            eq(s.editorialPublications.languageCode, language),
            isNull(s.editorialPublications.unpublishedAt),
          ),
        );
      await tx.insert(s.editorialPublications).values({
        entryId,
        languageCode: language,
        revisionId,
        sourceVersionId,
        translationContentHash: localizedContentHash(language, payload),
        publishedById: context.authorId,
        publishedAt: now,
      });
    }

    await tx
      .update(s.editorialEntries)
      .set({ updatedAt: now })
      .where(eq(s.editorialEntries.id, entryId));
  });

  console.log(
    `basic information: ${fixture.slug} REWORDED as revision ${String(latest.revisionNumber + 1)} (${String(drift.length)} language(s)${detailChanged ? " + details" : ""})`,
  );
}

async function main() {
  const context = await loadContext();
  console.log(`authoring as ${context.authorEmail}`);
  if (!REWORD) {
    console.log(
      "Reporting mode: existing entries are compared with the reviewed copy, not changed. Pass --reword to publish corrections.",
    );
  }
  for (const fixture of CONTACTS) {
    await seedContact(context, fixture);
  }
  console.log(
    "Every entry is published in the languages it has wording for. Open /dashboard/basics to date each one against the current guide.",
  );
}

main()
  .then(() => client.end())
  .catch(async (error: unknown) => {
    console.error(error);
    await client.end();
    process.exit(1);
  });
