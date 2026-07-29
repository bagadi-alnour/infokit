/* eslint-disable no-console -- CLI seed script reports progress to stdout */
import { createHash } from "node:crypto";
import "dotenv/config";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { hashContent, localizedContentHash } from "../content/editorial";
import { migratorUrl } from "./migrator-url";
import * as s from "./schema";

/**
 * Demo content for the public read path: four activities and four articles,
 * published in fr/en/ar, so the site and the app have something to render
 * locally. Separate from `seed.ts` on purpose — that file seeds catalogues and
 * sourced organisation identities and states that it never seeds activities or
 * editorial content, because everything here is *published*, which is the one
 * thing a fixture must not do by accident.
 *
 * How the AGENTS.md rule ("fixtures are fictional and marked 'Demo data — do
 * not publish'") is kept while still exercising the publication gates:
 *
 * - the script refuses to run against anything but a local database;
 * - every claim belongs to a fictional association whose own display name says
 *   "ne pas publier", so the label reaches the rendered card, not just the row;
 * - the label is repeated in the workspace-only fields an editor reads first
 *   (`activities.source_note`, `editorial_revisions.source_summary`, the
 *   verification note), never inside public copy or a slug, which would make
 *   the fixture useless for judging how the real thing reads.
 *
 * Reruns replace rather than accumulate: every row this script owns has a fixed
 * id, and `resetDemoContent` deletes them in dependency order first.
 *
 *   pnpm --filter web db:seed:demo
 */

// The owner: this publishes content, which means writing verification and
// revision rows the app is not allowed to rewrite. The guard below runs on this
// same URL — whichever of the two it resolved to is the one that gets connected.
const url = migratorUrl();

/**
 * A published fixture on a shared database is a published lie, so the host has
 * to be local. `SEED_DEMO_FORCE=1` exists for a tunnelled local database, not
 * as a convenience.
 */
function assertLocalDatabase(connectionString: string) {
  const host = new URL(connectionString).hostname;
  const local = new Set([
    "localhost",
    "127.0.0.1",
    "::1",
    "0.0.0.0",
    "host.docker.internal",
  ]);
  if (local.has(host) || process.env.SEED_DEMO_FORCE === "1") return;
  throw new Error(
    `Refusing to seed demo content into "${host}": this fixture publishes fictional records. Set SEED_DEMO_FORCE=1 if that database really is local.`,
  );
}

assertLocalDatabase(url);

const client = postgres(url, { max: 1 });
const db = drizzle(client);

const LOCALES = ["fr", "en", "ar"] as const;
type Locale = (typeof LOCALES)[number];

const DEMO_NOTE =
  "Demo data — do not publish. Fictional fixture written by db:seed:demo.";
const CITY_CODE = "calais";
const POSTAL_CODE = "62100";
const DEMO_ORGANIZATION_ID = "33333333-3333-4333-8333-333333333333";
const DEMO_ORGANIZATION_NAME = "Association de démonstration (ne pas publier)";
/**
 * A second association, because the point of the skills catalogue is what
 * crosses between two of them: a requirement written by one, held by a member of
 * the other. One association cannot demonstrate that.
 */
const DEMO_PARTNER_ORGANIZATION_ID = "44444444-4444-4444-8444-444444444444";
const DEMO_PARTNER_ORGANIZATION_NAME =
  "Association partenaire de démonstration (ne pas publier)";

type OrganizationKey = "demo" | "partner";

const ORGANIZATION_IDS: Record<OrganizationKey, string> = {
  demo: DEMO_ORGANIZATION_ID,
  partner: DEMO_PARTNER_ORGANIZATION_ID,
};

const UUID_SHAPE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Fixed ids, one prefix per table, so a rerun overwrites its own rows. */
const ID_PREFIX = {
  place: "de11",
  activity: "de12",
  entry: "de13",
  revision: "de14",
  verification: "de15",
  team: "de16",
  member: "de17",
  translator: "de18",
  skill: "de19",
  course: "de1a",
  requirementSet: "de1b",
  assignment: "de1c",
} as const;

function demoId(kind: keyof typeof ID_PREFIX, index: number): string {
  return `${ID_PREFIX[kind]}0000-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

const now = new Date();

function daysFromNow(days: number): Date {
  const at = new Date(now);
  at.setDate(at.getDate() + days);
  return at;
}

/** `date` columns are plain calendar days: an obtained-on has no clock. */
function dateFromNow(days: number): string {
  return daysFromNow(days).toISOString().slice(0, 10);
}

function must<T>(value: T | undefined | null, what: string): T {
  if (value === undefined || value === null)
    throw new Error(`Demo seed: missing ${what}`);
  return value;
}

/** Both readers split a body on blank lines (`article-detail`, `activity-card`). */
function bodyText(paragraphs: string[]): string {
  return paragraphs.join("\n\n");
}

function bodyHtml(paragraphs: string[]): string {
  return paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join("");
}

/**
 * `translationPayloadHash` from `~/server/translation/provenance`, inlined: that
 * module is `server-only` and refuses to load in a plain Node script. The shape
 * and the whitespace normalisation have to match it exactly, or the hash a
 * publication carries is not the hash the console recomputes on the next save.
 */
function activityContentHash(payload: Record<string, unknown>): string {
  return hashContent(
    Object.fromEntries(
      Object.entries(payload).map(([key, value]) => [
        key,
        typeof value === "string" ? value.replace(/\s+/g, " ").trim() : value,
      ]),
    ),
  );
}

/* -------------------------------- places -------------------------------- */

interface PlaceFixture {
  areaCode: string;
  addressLine: string | null;
  lat: number;
  lng: number;
  precision: "exact" | "area_only";
  copy: Record<Locale, { name: string; directionsHint: string }>;
}

const PLACES: PlaceFixture[] = [
  {
    areaCode: "east",
    addressLine: "14 rue des Fontinettes",
    lat: 50.9412,
    lng: 1.8571,
    precision: "exact",
    copy: {
      fr: {
        name: "Halte de jour des Fontinettes",
        directionsHint:
          "À cinq minutes à pied de la gare des Fontinettes, porte bleue côté rue.",
      },
      en: {
        name: "Fontinettes day centre",
        directionsHint:
          "Five minutes on foot from Fontinettes station; blue door on the street side.",
      },
      ar: {
        name: "مركز فونتينيت النهاري",
        directionsHint:
          "على بعد خمس دقائق سيرًا من محطة فونتينيت، الباب الأزرق على جهة الشارع.",
      },
    },
  },
  {
    areaCode: "centre",
    addressLine: "Place Crèvecœur",
    lat: 50.9524,
    lng: 1.8547,
    precision: "exact",
    copy: {
      fr: {
        name: "Esplanade du marché Crèvecœur",
        directionsHint: "Sous les arbres, côté nord de la place.",
      },
      en: {
        name: "Crèvecœur market esplanade",
        directionsHint: "Under the trees, on the north side of the square.",
      },
      ar: {
        name: "ساحة سوق كريفكور",
        directionsHint: "تحت الأشجار، في الجهة الشمالية من الساحة.",
      },
    },
  },
  {
    areaCode: "station",
    addressLine: "6 place d'Alsace",
    lat: 50.954,
    lng: 1.858,
    precision: "exact",
    copy: {
      fr: {
        name: "Permanence de la place d'Alsace",
        directionsHint: "Bâtiment en briques, première porte à gauche.",
      },
      en: {
        name: "Place d'Alsace drop-in",
        directionsHint: "Brick building, first door on the left.",
      },
      ar: {
        name: "نقطة الاستقبال في ساحة الألزاس",
        directionsHint: "المبنى المبني بالطوب، أول باب على اليسار.",
      },
    },
  },
  {
    areaCode: "west",
    addressLine: null,
    lat: 50.9481,
    lng: 1.8272,
    precision: "area_only",
    copy: {
      fr: {
        name: "Quartier du Fort-Nieulay",
        directionsHint: "Le point de rendez-vous exact est indiqué sur place.",
      },
      en: {
        name: "Fort-Nieulay area",
        directionsHint: "The exact meeting point is given on arrival.",
      },
      ar: {
        name: "حي فور-نييولاي",
        directionsHint: "يُحدَّد مكان اللقاء بالضبط عند الوصول.",
      },
    },
  },
];

/* ------------------------------ activities ------------------------------ */

interface ActivityCopy {
  name: string;
  shortDescription: string;
  paragraphs: string[];
  instructions: string;
  cancellationNote?: string;
}

/**
 * One way in without a car. No copy per language: the mode is drawn from the
 * reader's own catalogue, and the line and the stop are the network's names.
 */
interface TransitFixture {
  mode:
    "bus" | "tram" | "metro" | "train" | "coach" | "ferry" | "bike" | "other";
  line?: string;
  stopName?: string;
  walkMinutes?: number;
}

interface ActivityFixture {
  slug: string;
  categoryCode: string;
  audienceCode: string;
  serviceCodes: string[];
  tagCodes: string[];
  /** 1-based index into `PLACES`. */
  placeIndex: number;
  /** How to get there, in the order a reader should read them. */
  transit: TransitFixture[];
  holder: "platform" | "organization";
  manualStatus: "normal" | "cancelled" | "uncertain";
  weekdays: number[];
  startTime: string;
  endTime: string;
  publish: Locale[];
  checkedDaysAgo: number;
  reviewDueInDays: number;
  stewardName: string;
  copy: Record<Locale, ActivityCopy>;
}

/**
 * One activity per rung of the status ramp (DESIGN-SYSTEM.md §6), because the
 * four states are what the cards mostly differ by. `normal` still depends on
 * the clock: read on a Tuesday lunchtime, the first is open and the second is
 * closed with a next opening — the manual states hold on any day.
 */
const ACTIVITIES: ActivityFixture[] = [
  {
    slug: "halte-de-jour-fontinettes",
    categoryCode: "hygiene_material",
    audienceCode: "all_public",
    serviceCodes: [
      "showers_hygiene",
      "toilets",
      "drinking_water",
      "phone_connectivity",
    ],
    tagCodes: ["walk_in", "free"],
    placeIndex: 1,
    transit: [
      { mode: "bus", line: "3", stopName: "Fontinettes", walkMinutes: 4 },
      { mode: "train", stopName: "Calais-Ville", walkMinutes: 12 },
    ],
    holder: "platform",
    manualStatus: "normal",
    weekdays: [1, 2, 3, 4, 5, 6],
    startTime: "08:30",
    endTime: "19:30",
    publish: ["fr", "en", "ar"],
    checkedDaysAgo: 2,
    reviewDueInDays: 26,
    stewardName: "Coordination de la halte de jour",
    copy: {
      fr: {
        name: "Halte de jour — douches, laverie et recharge",
        shortDescription:
          "Douches, machines à laver et prises pour recharger un téléphone, six jours sur sept.",
        paragraphs: [
          "La halte de jour accueille sans rendez-vous. Sur place : quatre douches individuelles, deux machines à laver, des toilettes et des prises pour recharger un téléphone.",
          "Le savon, la serviette et la lessive sont fournis. Il est possible de laisser une machine tourner et de revenir chercher son linge dans la journée.",
          "Un point d'eau potable reste accessible à l'extérieur, même quand la halte est fermée.",
        ],
        instructions:
          "Prendre un ticket à l'entrée pour les douches. Le dernier ticket est distribué une heure avant la fermeture.",
      },
      en: {
        name: "Day centre — showers, laundry and phone charging",
        shortDescription:
          "Showers, washing machines and sockets to charge a phone, six days a week.",
        paragraphs: [
          "The day centre takes people without an appointment. Inside: four individual showers, two washing machines, toilets, and sockets for charging a phone.",
          "Soap, a towel and washing powder are provided. You can leave a machine running and come back for your clothes later the same day.",
          "There is drinking water outside, reachable even when the centre is closed.",
        ],
        instructions:
          "Take a ticket at the entrance for the showers. The last ticket is handed out one hour before closing.",
      },
      ar: {
        name: "مركز نهاري — دشّات وغسيل وشحن الهاتف",
        shortDescription:
          "دشّات وغسّالات ومقابس لشحن الهاتف، ستة أيام في الأسبوع.",
        paragraphs: [
          "يستقبل المركز النهاري الناس دون موعد. في الداخل: أربع دشّات فردية، وغسّالتان، ومراحيض، ومقابس لشحن الهاتف.",
          "الصابون والمنشفة ومسحوق الغسيل متوفّرة. يمكنك تشغيل الغسّالة والعودة لأخذ ثيابك في اليوم نفسه.",
          "هناك ماء للشرب في الخارج، يمكن الوصول إليه حتى عندما يكون المركز مغلقًا.",
        ],
        instructions:
          "خذ رقمًا عند المدخل من أجل الدش. يُوزَّع الرقم الأخير قبل ساعة من الإغلاق.",
      },
    },
  },
  {
    slug: "repas-chauds-crevecoeur",
    categoryCode: "essentials",
    audienceCode: "all_public",
    serviceCodes: ["food", "tea", "drinking_water"],
    tagCodes: ["walk_in", "free"],
    placeIndex: 2,
    transit: [
      { mode: "bus", line: "1", stopName: "Crèvecœur", walkMinutes: 2 },
    ],
    holder: "organization",
    manualStatus: "normal",
    weekdays: [1, 3, 5, 6],
    startTime: "12:00",
    endTime: "14:00",
    publish: ["fr", "en", "ar"],
    checkedDaysAgo: 1,
    reviewDueInDays: 13,
    stewardName: "Équipe distribution",
    copy: {
      fr: {
        name: "Distribution de repas chauds — marché Crèvecœur",
        shortDescription:
          "Un repas chaud, du thé et de l'eau, quatre midis par semaine.",
        paragraphs: [
          "L'équipe s'installe sur l'esplanade du marché et sert un repas chaud, du thé et de l'eau potable. Il n'y a pas d'inscription : on se présente pendant le créneau.",
          "Les repas sont sans porc, et une petite quantité de portions sans gluten est préparée.",
          "En cas d'alerte météo, la distribution est déplacée sous le préau, à cinquante mètres.",
        ],
        instructions:
          "Apporter un récipient si possible ; des barquettes sont disponibles sinon.",
      },
      en: {
        name: "Hot meal distribution — Crèvecœur market",
        shortDescription: "A hot meal, tea and water, four lunchtimes a week.",
        paragraphs: [
          "The team sets up on the market esplanade and serves a hot meal, tea and drinking water. There is no sign-up: come during the time slot.",
          "Meals are pork-free, and a small number of gluten-free portions are prepared.",
          "If there is a weather warning, the distribution moves under the covered area fifty metres away.",
        ],
        instructions: "Bring a container if you can; trays are available too.",
      },
      ar: {
        name: "توزيع وجبات ساخنة — ساحة سوق كريفكور",
        shortDescription:
          "وجبة ساخنة وشاي وماء، أربعة أيام في الأسبوع وقت الظهيرة.",
        paragraphs: [
          "يتمركز الفريق في ساحة السوق ويقدّم وجبة ساخنة وشايًا وماء للشرب. لا يوجد تسجيل: تعال في الوقت المحدّد.",
          "الوجبات خالية من لحم الخنزير، وتُحضَّر كمية صغيرة خالية من الغلوتين.",
          "في حال وجود تحذير جوي، يُنقل التوزيع إلى المكان المسقوف على بعد خمسين مترًا.",
        ],
        instructions: "أحضر وعاءً إن أمكن؛ وإلا فهناك عُلب جاهزة.",
      },
    },
  },
  {
    slug: "permanence-asile-place-d-alsace",
    categoryCode: "legal_orientation",
    audienceCode: "all_public",
    serviceCodes: ["asylum_legal_information", "information_orientation"],
    tagCodes: ["walk_in", "free"],
    placeIndex: 3,
    transit: [
      { mode: "bus", line: "2", stopName: "Place d’Alsace", walkMinutes: 3 },
      { mode: "bike", stopName: "Théâtre", walkMinutes: 5 },
    ],
    holder: "organization",
    manualStatus: "uncertain",
    weekdays: [2, 4],
    startTime: "09:30",
    endTime: "12:30",
    // Arabic is written and waiting for its read, so /ar falls back to French
    // and shows the language-fallback notice.
    publish: ["fr", "en"],
    checkedDaysAgo: 21,
    reviewDueInDays: -4,
    stewardName: "Permanence juridique",
    copy: {
      fr: {
        name: "Permanence d'information sur l'asile",
        shortDescription:
          "Des informations sur la demande d'asile en France, avec un interprète.",
        paragraphs: [
          "Deux matinées par semaine, une permanence répond aux questions sur la demande d'asile en France : rendez-vous en préfecture, délais, documents à garder.",
          "Un interprète est présent en arabe et en pachto ; d'autres langues sont possibles par téléphone.",
          "La permanence n'est pas un avocat et ne remplit pas de dossier à la place des personnes : elle explique les étapes et oriente vers l'aide juridique gratuite.",
        ],
        instructions:
          "Apporter tous les papiers déjà reçus, même ceux qui semblent sans importance.",
      },
      en: {
        name: "Asylum information drop-in",
        shortDescription:
          "Information about claiming asylum in France, with an interpreter.",
        paragraphs: [
          "Two mornings a week, this drop-in answers questions about claiming asylum in France: prefecture appointments, waiting times, and which documents to keep.",
          "An interpreter is there for Arabic and Pashto; other languages can be arranged by phone.",
          "The drop-in is not a lawyer and does not fill in forms for people: it explains the steps and points to free legal help.",
        ],
        instructions:
          "Bring every paper you have already been given, even the ones that look unimportant.",
      },
      ar: {
        name: "نقطة معلومات حول اللجوء",
        shortDescription: "معلومات عن تقديم طلب اللجوء في فرنسا، مع مترجم.",
        paragraphs: [
          "صباحَ يومين في الأسبوع، تجيب هذه النقطة عن الأسئلة المتعلقة بطلب اللجوء في فرنسا: مواعيد المحافظة، ومدد الانتظار، والأوراق التي يجب الاحتفاظ بها.",
          "يوجد مترجم للعربية والبشتو، ويمكن ترتيب لغات أخرى عبر الهاتف.",
          "هذه النقطة ليست محاميًا ولا تملأ الاستمارات بدلًا عن الأشخاص: بل تشرح الخطوات وتوجّه إلى المساعدة القانونية المجانية.",
        ],
        instructions:
          "أحضر كل الأوراق التي استلمتها، حتى تلك التي تبدو غير مهمة.",
      },
    },
  },
  {
    slug: "espace-femmes-fort-nieulay",
    categoryCode: "shelter_access",
    audienceCode: "women_only",
    serviceCodes: ["clothing_shoes", "activities", "information_orientation"],
    tagCodes: ["walk_in", "free"],
    placeIndex: 4,
    transit: [
      { mode: "bus", line: "5", stopName: "Fort-Nieulay", walkMinutes: 6 },
    ],
    holder: "platform",
    manualStatus: "cancelled",
    weekdays: [3],
    startTime: "13:00",
    endTime: "17:00",
    publish: ["fr", "en", "ar"],
    checkedDaysAgo: 5,
    reviewDueInDays: 9,
    stewardName: "Coordination espace femmes",
    copy: {
      fr: {
        name: "Espace femmes — vestiaire et atelier couture",
        shortDescription:
          "Un après-midi réservé aux femmes : vêtements, machines à coudre, thé.",
        paragraphs: [
          "Chaque mercredi après-midi, un espace réservé aux femmes ouvre dans le quartier du Fort-Nieulay : vestiaire, deux machines à coudre, du thé et un coin pour les enfants.",
          "Des bénévoles femmes accompagnent l'atelier. Le lieu exact est communiqué sur place, pour la tranquillité des participantes.",
          "Une information sur la santé et les droits est disponible à la demande, sans que rien ne soit noté.",
        ],
        instructions:
          "Se présenter à l'entrée du quartier ; une bénévole accompagne les nouvelles venues.",
        cancellationNote:
          "Les séances sont suspendues jusqu'à nouvel ordre, le temps de trouver une nouvelle salle. La reprise sera annoncée ici.",
      },
      en: {
        name: "Women's space — clothes and sewing workshop",
        shortDescription:
          "One afternoon for women only: clothes, sewing machines, tea.",
        paragraphs: [
          "Every Wednesday afternoon a women-only space opens in the Fort-Nieulay area: a clothes store, two sewing machines, tea, and a corner for children.",
          "Women volunteers run the workshop. The exact address is given on arrival, to keep the space quiet for the people who use it.",
          "Information about health and rights is available on request, and nothing is written down.",
        ],
        instructions:
          "Come to the entrance of the neighbourhood; a volunteer walks newcomers in.",
        cancellationNote:
          "Sessions are suspended until further notice while a new room is found. The restart will be announced here.",
      },
      ar: {
        name: "مساحة النساء — ملابس وورشة خياطة",
        shortDescription: "بعد ظهر مخصّص للنساء: ملابس، ماكينات خياطة، وشاي.",
        paragraphs: [
          "كل يوم أربعاء بعد الظهر تُفتح مساحة للنساء فقط في حي فور-نييولاي: مخزن ملابس، وماكينتا خياطة، وشاي، وزاوية للأطفال.",
          "تُدير الورشة متطوّعات. يُعطى العنوان الدقيق عند الوصول، حفاظًا على هدوء المكان.",
          "تتوفّر معلومات عن الصحة والحقوق عند الطلب، ولا يُسجَّل أي شيء.",
        ],
        instructions:
          "تعالي إلى مدخل الحي؛ سترافقك متطوّعة إن كانت زيارتك الأولى.",
        cancellationNote:
          "الجلسات موقوفة حتى إشعار آخر ريثما يُعثر على قاعة جديدة. سيُعلن عن العودة هنا.",
      },
    },
  },
];

/* -------------------------------- articles ------------------------------- */

interface ArticleCopy {
  title: string;
  summary: string;
  paragraphs: string[];
}

interface ArticleFixture {
  /** Entry slug and French route slug. */
  slug: string;
  /**
   * One route per language. Arabic reuses the French slug on purpose: `slugify`
   * strips Arabic script entirely and would hand every Arabic route the same
   * "article" stub, and route uniqueness is per (language, slug).
   */
  routes: Record<Locale, string>;
  articleDate: string;
  featured: boolean;
  owner: "platform" | "organization";
  /** A date in the past turns on the dated public warning. */
  unreliableFrom: string | null;
  publish: Locale[];
  checkedDaysAgo: number;
  reviewDueInDays: number;
  sourceSummary: string;
  copy: Record<Locale, ArticleCopy>;
}

const ARTICLES: ArticleFixture[] = [
  {
    slug: "ou-se-doucher-laver-son-linge-et-trouver-des-vetements-a-calais",
    routes: {
      fr: "ou-se-doucher-laver-son-linge-et-trouver-des-vetements-a-calais",
      en: "where-to-shower-wash-clothes-and-find-clothing-in-calais",
      ar: "ou-se-doucher-laver-son-linge-et-trouver-des-vetements-a-calais",
    },
    articleDate: "2026-07-22",
    featured: true,
    owner: "platform",
    unreliableFrom: null,
    publish: ["fr", "en", "ar"],
    checkedDaysAgo: 6,
    reviewDueInDays: 24,
    sourceSummary:
      "Horaires relevés sur les fiches d'activité correspondantes ; aucune source extérieure.",
    copy: {
      fr: {
        title: "Où se doucher, laver son linge et trouver des vêtements",
        summary:
          "Les points d'hygiène ouverts cette semaine, ce qu'il faut apporter et à quelle heure venir.",
        paragraphs: [
          "Se laver demande d'organiser sa journée autour de deux ou trois adresses. La halte de jour des Fontinettes ouvre du lundi au samedi, de 8h30 à 19h30 : douches individuelles, machines à laver, toilettes et prises pour recharger un téléphone.",
          "Le savon, la serviette et la lessive sont fournis sur place. Un ticket est distribué à l'entrée pour les douches et le dernier part une heure avant la fermeture : arriver en début d'après-midi laisse le temps d'une machine.",
          "Pour les vêtements, l'espace femmes du quartier du Fort-Nieulay tient un vestiaire le mercredi après-midi. Les séances sont suspendues en ce moment, le temps de trouver une nouvelle salle.",
          "Chaque adresse citée ici est vérifiée séparément : la date du dernier contrôle est indiquée sur sa propre fiche.",
        ],
      },
      en: {
        title: "Where to shower, wash clothes and find clothing",
        summary:
          "The hygiene points open this week, what to bring, and when to arrive.",
        paragraphs: [
          "Washing means planning a day around two or three addresses. The Fontinettes day centre opens Monday to Saturday, 8.30am to 7.30pm: individual showers, washing machines, toilets, and sockets for charging a phone.",
          "Soap, a towel and washing powder are provided. A ticket is handed out at the entrance for the showers and the last one goes an hour before closing, so arriving early in the afternoon leaves time for a machine.",
          "For clothes, the women's space in the Fort-Nieulay area runs a clothes store on Wednesday afternoons. Sessions are suspended at the moment while a new room is found.",
          "Every address named here is checked separately: the date of the last check is on its own page.",
        ],
      },
      ar: {
        title: "أين تستحمّ وتغسل ثيابك وتجد ملابس",
        summary:
          "نقاط النظافة المفتوحة هذا الأسبوع، وما يجب أن تحمله، ومتى تأتي.",
        paragraphs: [
          "الاستحمام يعني تنظيم اليوم حول عنوانين أو ثلاثة. يفتح مركز فونتينيت النهاري من الاثنين إلى السبت، من الثامنة والنصف صباحًا إلى السابعة والنصف مساءً: دشّات فردية، وغسّالات، ومراحيض، ومقابس لشحن الهاتف.",
          "الصابون والمنشفة ومسحوق الغسيل متوفّرة في المكان. يُوزَّع رقم عند المدخل للدش، والرقم الأخير يُعطى قبل ساعة من الإغلاق؛ لذلك فإن الوصول في بداية بعد الظهر يترك وقتًا لغسل الثياب.",
          "أمّا الملابس، فمساحة النساء في حي فور-نييولاي تدير مخزن ملابس بعد ظهر كل أربعاء. الجلسات موقوفة حاليًا ريثما يُعثر على قاعة جديدة.",
          "كل عنوان مذكور هنا يُتحقَّق منه على حدة: تاريخ آخر تحقّق مكتوب في صفحته الخاصة.",
        ],
      },
    },
  },
  {
    slug: "demander-l-asile-en-france-les-premieres-demarches",
    routes: {
      fr: "demander-l-asile-en-france-les-premieres-demarches",
      en: "claiming-asylum-in-france-the-first-steps",
      ar: "demander-l-asile-en-france-les-premieres-demarches",
    },
    articleDate: "2026-06-15",
    featured: false,
    owner: "organization",
    unreliableFrom: "2026-07-01",
    publish: ["fr", "en", "ar"],
    checkedDaysAgo: 43,
    reviewDueInDays: -13,
    sourceSummary:
      "Étapes reprises de la permanence juridique de démonstration ; à revoir à chaque changement de procédure.",
    copy: {
      fr: {
        title: "Demander l'asile en France : les premières démarches",
        summary:
          "Les étapes entre l'arrivée et le dépôt de la demande, et les papiers à garder à chaque étape.",
        paragraphs: [
          "Une demande d'asile commence par un passage en structure de premier accueil, qui enregistre la demande et fixe un rendez-vous en préfecture. Ce rendez-vous donne une attestation : c'est le document à garder en permanence.",
          "La demande est ensuite déposée auprès de l'OFPRA, en français, dans le délai indiqué sur l'attestation. Un récit écrit est demandé ; il peut être préparé avec une aide gratuite.",
          "Garder chaque papier reçu, même illisible ou apparemment sans importance : une convocation perdue peut coûter plusieurs mois.",
          "Cette page décrit une procédure générale et ne remplace pas un conseil juridique. La permanence de la place d'Alsace répond aux questions deux matinées par semaine.",
        ],
      },
      en: {
        title: "Claiming asylum in France: the first steps",
        summary:
          "What happens between arriving and lodging the claim, and which papers to keep at each step.",
        paragraphs: [
          "A claim starts at a first-reception service, which registers it and books a prefecture appointment. That appointment produces a certificate: it is the document to keep on you at all times.",
          "The claim is then lodged with OFPRA, in French, within the deadline written on the certificate. A written account is required, and free help is available to prepare it.",
          "Keep every paper you are given, even an unreadable one or one that looks unimportant: a lost summons can cost several months.",
          "This page describes a general procedure and is not legal advice. The Place d'Alsace drop-in answers questions two mornings a week.",
        ],
      },
      ar: {
        title: "طلب اللجوء في فرنسا: الخطوات الأولى",
        summary:
          "ما يحدث بين الوصول وتقديم الطلب، والأوراق التي يجب الاحتفاظ بها في كل خطوة.",
        paragraphs: [
          "يبدأ الطلب من مركز الاستقبال الأول، حيث يُسجَّل الطلب ويُحدَّد موعد في المحافظة. يمنحك هذا الموعد شهادةً: وهي الورقة التي يجب أن تبقى معك دائمًا.",
          "ثم يُقدَّم الطلب إلى «أوفبرا» (OFPRA) بالفرنسية، خلال المدة المكتوبة على الشهادة. يُطلب سرد مكتوب، ويمكن إعداده بمساعدة مجانية.",
          "احتفظ بكل ورقة تستلمها، حتى إن كانت غير مقروءة أو تبدو غير مهمة: فقدان استدعاء قد يكلّفك عدة أشهر.",
          "هذه الصفحة تشرح إجراءً عامًا وليست استشارة قانونية. نقطة ساحة الألزاس تجيب عن الأسئلة صباحَ يومين في الأسبوع.",
        ],
      },
    },
  },
  {
    slug: "se-soigner-a-calais-pass-permanences-et-urgences",
    routes: {
      fr: "se-soigner-a-calais-pass-permanences-et-urgences",
      en: "healthcare-in-calais-pass-drop-ins-and-emergencies",
      ar: "se-soigner-a-calais-pass-permanences-et-urgences",
    },
    articleDate: "2026-07-10",
    featured: false,
    owner: "platform",
    unreliableFrom: null,
    // English is written but not activated, so /en falls back to French.
    publish: ["fr", "ar"],
    checkedDaysAgo: 18,
    reviewDueInDays: 12,
    sourceSummary:
      "Fixture de démonstration : parcours de soins décrit de mémoire, sans source citée.",
    copy: {
      fr: {
        title: "Se soigner : PASS, permanences et urgences",
        summary:
          "À qui s'adresser pour une consultation, un vaccin ou une urgence, avec ou sans papiers.",
        paragraphs: [
          "La permanence d'accès aux soins de santé (PASS) de l'hôpital reçoit sans condition de papiers ni de couverture maladie. C'est le point d'entrée pour une consultation, une ordonnance ou un examen.",
          "Pour une urgence, le 15 répond jour et nuit et un interprète peut être demandé pendant l'appel. Le 114 permet d'écrire au lieu de parler.",
          "Les soins dentaires et l'accès aux lunettes passent par des rendez-vous plus longs : mieux vaut les demander dès la première consultation.",
          "Aucun soignant n'a le droit de transmettre une information médicale à la police ou à la préfecture.",
        ],
      },
      en: {
        title: "Healthcare: PASS, drop-ins and emergencies",
        summary:
          "Who to go to for a consultation, a vaccine or an emergency, with or without papers.",
        paragraphs: [
          "The hospital's healthcare access service (PASS) sees people with no conditions about papers or health insurance. It is the way in for a consultation, a prescription or a test.",
          "In an emergency, 15 answers day and night and an interpreter can be requested during the call. 114 lets you write instead of speaking.",
          "Dental care and glasses go through longer appointments: it is better to ask for them at the first consultation.",
          "No health worker is allowed to pass medical information to the police or the prefecture.",
        ],
      },
      ar: {
        title: "العلاج: خدمة PASS والعيادات والطوارئ",
        summary:
          "إلى مَن تتوجّه من أجل استشارة أو تطعيم أو حالة طارئة، مع أوراق أو بدونها.",
        paragraphs: [
          "تستقبل خدمة الوصول إلى الرعاية الصحية (PASS) في المستشفى الناس دون شرط الأوراق أو التأمين الصحي. وهي باب الدخول إلى استشارة أو وصفة طبية أو تحليل.",
          "في الحالات الطارئة، يجيب الرقم 15 ليلًا ونهارًا، ويمكن طلب مترجم أثناء المكالمة. أما الرقم 114 فيتيح الكتابة بدل الكلام.",
          "علاج الأسنان والحصول على النظارات يمرّان بمواعيد أطول: من الأفضل طلبهما في الاستشارة الأولى.",
          "لا يحقّ لأي عامل في مجال الصحة أن ينقل معلومة طبية إلى الشرطة أو المحافظة.",
        ],
      },
    },
  },
  {
    slug: "distributions-de-repas-les-horaires-de-la-semaine",
    routes: {
      fr: "distributions-de-repas-les-horaires-de-la-semaine",
      en: "meal-distributions-this-weeks-times",
      ar: "distributions-de-repas-les-horaires-de-la-semaine",
    },
    articleDate: "2026-07-27",
    featured: false,
    owner: "organization",
    unreliableFrom: "2026-08-10",
    publish: ["fr", "en", "ar"],
    checkedDaysAgo: 1,
    reviewDueInDays: 29,
    sourceSummary:
      "Horaires confirmés par l'équipe de distribution de démonstration la veille de la publication.",
    copy: {
      fr: {
        title: "Distributions de repas : les horaires de la semaine",
        summary:
          "Les créneaux de distribution du lundi au samedi, et ce qui change en cas d'alerte météo.",
        paragraphs: [
          "Quatre midis par semaine, un repas chaud est servi sur l'esplanade du marché Crèvecœur : lundi, mercredi, vendredi et samedi, de 12h à 14h.",
          "Du thé et de l'eau potable sont servis pendant toute la distribution. Les repas sont sans porc, et une petite quantité de portions sans gluten est préparée.",
          "En cas d'alerte météo, la distribution est déplacée sous le préau, à cinquante mètres du point habituel.",
          "Les horaires changent parfois d'une semaine à l'autre : la date du dernier contrôle figure en bas de cette page.",
        ],
      },
      en: {
        title: "Meal distributions: this week's times",
        summary:
          "The distribution slots from Monday to Saturday, and what changes when there is a weather warning.",
        paragraphs: [
          "Four lunchtimes a week, a hot meal is served on the Crèvecœur market esplanade: Monday, Wednesday, Friday and Saturday, from noon to 2pm.",
          "Tea and drinking water are served throughout. Meals are pork-free, and a small number of gluten-free portions are prepared.",
          "If there is a weather warning, the distribution moves under the covered area fifty metres from the usual spot.",
          "Times change from one week to the next sometimes: the date of the last check is at the foot of this page.",
        ],
      },
      ar: {
        title: "توزيع الوجبات: مواعيد هذا الأسبوع",
        summary:
          "أوقات التوزيع من الاثنين إلى السبت، وما يتغيّر عند وجود تحذير جوي.",
        paragraphs: [
          "أربع مرات في الأسبوع وقت الظهيرة، تُقدَّم وجبة ساخنة في ساحة سوق كريفكور: الاثنين والأربعاء والجمعة والسبت، من الثانية عشرة إلى الثانية بعد الظهر.",
          "يُقدَّم الشاي والماء الصالح للشرب أثناء التوزيع كله. الوجبات خالية من لحم الخنزير، وتُحضَّر كمية صغيرة خالية من الغلوتين.",
          "في حال وجود تحذير جوي، يُنقل التوزيع إلى المكان المسقوف على بعد خمسين مترًا من النقطة المعتادة.",
          "تتغيّر المواعيد أحيانًا من أسبوع إلى آخر: تاريخ آخر تحقّق مكتوب في أسفل هذه الصفحة.",
        ],
      },
    },
  },
];

/* --------------------- people, skills and requirements -------------------- */

/**
 * The half of the fixture nothing public reads: two associations with a city
 * team each, four members, one directory translator, and what they declare from
 * the skills and courses catalogue (docs/DATABASE-SCHEMA.md §12).
 *
 * It exists so the shared vocabulary can be judged on the thing that is hard to
 * picture from a schema — a requirement written by one association, satisfied by
 * somebody who is not its member. So the fixture deliberately holds every state
 * a coordinator has to read: a verified declaration, one still waiting for a
 * verifier, one whose validity has run out, and a course held by a partner's
 * member and by an external translator.
 *
 * No account and no licence number is invented: members carry `userId = null`
 * exactly like a real pending invitation, and the addresses are on the reserved
 * `example.org` domain. `core.organization_members` requires a phone number, so
 * the fixtures use the 06 39 98 XX XX block ARCEP reserves for fiction — the
 * documentation range for a number, dialling nobody. Every name says "démo",
 * because these names reach a workspace screen.
 */

type RecordState =
  "self_declared" | "awaiting_verification" | "verified" | "expired";

interface TeamFixture {
  index: number;
  owner: OrganizationKey;
  name: string;
}

const TEAMS: TeamFixture[] = [
  { index: 1, owner: "demo", name: "Équipe Calais (démonstration)" },
  {
    index: 2,
    owner: "partner",
    name: "Équipe Calais (démonstration partenaire)",
  },
];

/**
 * One declaration: a `skills.code` or a `training_courses.slug`, resolved once
 * both catalogues are in place. A verified or expired row also carries the
 * verifier the table's check demands.
 */
interface DeclarationFixture {
  code: string;
  state: RecordState;
  obtainedDaysAgo?: number;
  /** Negative for a validity period that has already run out. */
  expiresInDays?: number;
  note?: string;
}

interface MemberFixture {
  index: number;
  teamIndex: number;
  owner: OrganizationKey;
  firstName: string;
  lastName: string;
  contactEmail: string;
  /** From the fiction block above, so a fixture row never dials anybody. */
  phone: string;
  title: string;
  isLead: boolean;
  /** Spoken, from the whole of `core.languages` — not the publishable subset. */
  languages: string[];
  skills: DeclarationFixture[];
  courses: DeclarationFixture[];
}

const MEMBERS: MemberFixture[] = [
  {
    index: 1,
    teamIndex: 1,
    owner: "demo",
    firstName: "Nadia",
    lastName: "B. (démo)",
    contactEmail: "nadia.demo@example.org",
    phone: "+33 6 39 98 00 01",
    title: "Coordination maraude",
    isLead: true,
    languages: ["fr", "ar"],
    skills: [
      { code: "permit-b", state: "verified", obtainedDaysAgo: 1500 },
      { code: "psc1", state: "verified", obtainedDaysAgo: 400 },
      { code: "conduite-de-maraude", state: "verified", obtainedDaysAgo: 200 },
      { code: "mano", state: "self_declared" },
      { code: "suivi-interne", state: "self_declared" },
    ],
    courses: [
      { code: "accueil-orientation-personnes-exilees", state: "self_declared" },
    ],
  },
  {
    index: 2,
    teamIndex: 1,
    owner: "demo",
    firstName: "Karim",
    lastName: "T. (démo)",
    contactEmail: "karim.demo@example.org",
    phone: "+33 6 39 98 00 02",
    title: "Bénévole maraude",
    isLead: false,
    languages: ["fr", "ps"],
    skills: [
      // Declared and waiting: "Maraude" asks for a verified permit, so this
      // reads as a gap a coordinator can close rather than as a refusal.
      { code: "permit-b", state: "awaiting_verification" },
      {
        code: "sst",
        state: "expired",
        obtainedDaysAgo: 913,
        expiresInDays: -183,
        note: "Recyclage à programmer (fixture de démonstration).",
      },
      { code: "mano", state: "self_declared" },
    ],
    courses: [],
  },
  {
    index: 3,
    teamIndex: 1,
    owner: "demo",
    firstName: "Hélène",
    lastName: "M. (démo)",
    contactEmail: "helene.demo@example.org",
    phone: "+33 6 39 98 00 03",
    title: "Accueil et orientation",
    isLead: false,
    languages: ["fr", "en"],
    skills: [
      { code: "active-listening", state: "self_declared" },
      { code: "administrative-support", state: "self_declared" },
      { code: "mano", state: "self_declared" },
    ],
    courses: [
      // The same course as Yusuf's below, on her own word only: "Permanence"
      // wants it verified, so the two rows read differently.
      { code: "prevention-des-abus-ocp", state: "awaiting_verification" },
      {
        code: "donnees-personnelles-et-confidentialite",
        state: "self_declared",
      },
    ],
  },
  {
    index: 4,
    teamIndex: 2,
    owner: "partner",
    firstName: "Yusuf",
    lastName: "A. (démo)",
    contactEmail: "yusuf.demo@example.org",
    phone: "+33 6 39 98 00 04",
    title: "Médiation interculturelle",
    isLead: true,
    languages: ["fr", "ar", "ku"],
    skills: [
      { code: "intercultural-mediation", state: "self_declared" },
      { code: "interpreting", state: "self_declared" },
      { code: "mano", state: "self_declared" },
    ],
    courses: [
      // The cross-organisation case: a partner's member holds the demo
      // association's course, verified, without either side copying a row.
      {
        code: "prevention-des-abus-ocp",
        state: "verified",
        obtainedDaysAgo: 120,
      },
    ],
  },
];

/**
 * One translator in the directory, invited and not yet signed in — the state the
 * self-service profile page has to work in. Owned by the demo association, kept
 * to it (`directoryScope`), and holding the same OCP course as the partner's
 * member: the brief's exact case.
 */
const TRANSLATOR = {
  index: 1,
  displayName: "Leyla K. (démo)",
  contactEmail: "leyla.demo@example.org",
  headline: "Français → arabe, kurmandji ; entretiens et permanences",
  languages: [
    { code: "fr", into: false, from: true },
    { code: "ar", into: true, from: true },
    { code: "ku", into: true, from: false },
  ],
  skills: [
    { code: "mano", state: "self_declared" },
    { code: "interpreting", state: "self_declared" },
  ] satisfies DeclarationFixture[],
  courses: [
    {
      code: "prevention-des-abus-ocp",
      state: "verified",
      obtainedDaysAgo: 60,
    },
  ] satisfies DeclarationFixture[],
};

/**
 * The live invitation that reaches her: one activity, one target language, and
 * the token the email would have carried. Sending content *is* the invitation,
 * so this row is what makes the self-service profile reachable locally —
 * `/fr/translate/<token>` exchanges it for the scoped session that the profile
 * page reads.
 *
 * The token is written here in the clear on purpose, and only the hash is
 * stored, exactly as a real send does. It says "demo" and "do not publish" in
 * its own text: a fixture token in a local database is a fixture, and one that
 * cannot be told apart from a real one would be the actual hazard. The target
 * language is Arabic, which activity 3 does not publish yet, so the request has
 * something real to ask for.
 */
const TRANSLATION_INVITATION = {
  index: 1,
  activityIndex: 3,
  targetLanguage: "ar",
  token: "demo-do-not-publish-translator-invitation-0001",
  expiresInDays: 14,
  instructions:
    "Données de démonstration — ne pas publier. Traduisez le titre, le résumé et le corps en arabe ; gardez les horaires tels quels.",
};

/**
 * The association-owned half of the catalogue. `suivi-interne` stays at
 * `organization`, which is what a private vocabulary looks like;
 * `conduite-de-maraude` is shared with translators on purpose, because people
 * from outside the association have to hold it — the decision the create dialog
 * nudges about.
 */
interface OrgSkillFixture {
  index: number;
  owner: OrganizationKey;
  kind: (typeof s.skillKind.enumValues)[number];
  code: string;
  visibility: (typeof s.courseVisibility.enumValues)[number];
  verificationRequired: boolean;
  name: Record<Locale, string>;
  descriptionFr: string;
}

const ORGANIZATION_SKILLS: OrgSkillFixture[] = [
  {
    index: 1,
    owner: "demo",
    kind: "skill",
    code: "conduite-de-maraude",
    visibility: "all_organizations_and_translators",
    verificationRequired: true,
    name: {
      fr: "Conduite de maraude (démo)",
      en: "Leading an outreach round (demo)",
      ar: "قيادة دورية ميدانية (تجربة)",
    },
    descriptionFr:
      "A déjà encadré une maraude avec l’association. Partagé au-delà de l’association, parce que des personnes extérieures y participent.",
  },
  {
    index: 2,
    owner: "demo",
    kind: "software",
    code: "suivi-interne",
    visibility: "organization",
    verificationRequired: false,
    name: {
      fr: "Tableau de suivi interne (démo)",
      en: "Internal follow-up sheet (demo)",
      ar: "جدول المتابعة الداخلي (تجربة)",
    },
    descriptionFr:
      "Sait tenir le tableau de suivi de l’association. Ne concerne personne d’autre : la ligne reste dans l’association.",
  },
  {
    index: 3,
    owner: "partner",
    kind: "skill",
    code: "accompagnement-vers-les-soins",
    visibility: "all_organizations",
    verificationRequired: false,
    name: {
      fr: "Accompagnement vers les soins (démo)",
      en: "Accompanying someone to healthcare (demo)",
      ar: "المواكبة نحو الرعاية الصحية (تجربة)",
    },
    descriptionFr:
      "Accompagne une personne jusqu’à une consultation et reste pendant l’échange. Partagé avec les autres associations, pas avec les traducteurs.",
  },
];

/**
 * The course from the brief: an association's own, opened to translators because
 * the people it applies to are not all its members. `verificationRequired`, so a
 * declaration lands in the verification queue instead of counting itself.
 */
interface OrgCourseFixture {
  index: number;
  owner: OrganizationKey;
  slug: string;
  visibility: (typeof s.courseVisibility.enumValues)[number];
  verificationRequired: boolean;
  title: Record<Locale, string>;
  description: string;
}

const ORGANIZATION_COURSES: OrgCourseFixture[] = [
  {
    index: 1,
    owner: "demo",
    slug: "prevention-des-abus-ocp",
    visibility: "all_organizations_and_translators",
    verificationRequired: true,
    title: {
      fr: "Prévention des abus : comportements responsables (OCP) (démo)",
      en: "Abuse prevention: responsible behaviour (OCP) (demo)",
      ar: "الوقاية من الإساءة: السلوك المسؤول (OCP) (تجربة)",
    },
    description:
      "Demandé à toute personne qui participe à une permanence, y compris aux traducteurs et aux personnes venues d’une autre association.",
  },
];

/**
 * What the association asks of the people on one kind of mission, written before
 * the mission entity exists. Nothing points at a set yet — the Phase 3 planning
 * work does — so these are read by hand through `~/lib/requirement-matching`.
 */
interface RequirementFixture {
  index: number;
  owner: OrganizationKey;
  code: string;
  name: string;
  description: string;
  items: {
    /** A skill code, or `course:<slug>`, or `language:<code>`. */
    target: string;
    necessity: (typeof s.requirementNecessity.enumValues)[number];
    mustBeVerified?: boolean;
    minimumCount?: number;
    note?: string;
  }[];
}

const REQUIREMENT_SETS: RequirementFixture[] = [
  {
    index: 1,
    owner: "demo",
    code: "maraude",
    name: "Maraude du soir (démo)",
    description:
      "Deux à quatre personnes, un véhicule, un créneau de trois heures.",
    items: [
      {
        target: "permit-b",
        necessity: "required",
        mustBeVerified: true,
        minimumCount: 1,
        note: "Une seule personne conduit ; le permis est vérifié avant la première sortie.",
      },
      {
        target: "conduite-de-maraude",
        necessity: "required",
        mustBeVerified: true,
        minimumCount: 1,
        note: "Quelqu’un qui a déjà encadré une maraude, quelle que soit son association.",
      },
      { target: "language:fr", necessity: "required" },
      { target: "psc1", necessity: "preferred", minimumCount: 1 },
    ],
  },
  {
    index: 2,
    owner: "demo",
    code: "permanence",
    name: "Permanence d’accueil (démo)",
    description:
      "Accueil et orientation en binôme, avec un traducteur quand la langue le demande.",
    items: [
      {
        target: "course:prevention-des-abus-ocp",
        necessity: "required",
        mustBeVerified: true,
        note: "Vaut pour les traducteurs et les personnes d’une autre association.",
      },
      { target: "mano", necessity: "required" },
      { target: "language:ar", necessity: "preferred", minimumCount: 1 },
      { target: "active-listening", necessity: "preferred" },
    ],
  },
];

/* ------------------------------- catalogue ------------------------------- */

/**
 * Catalogue rows are resolved by their stable `code`, never by id: the ids are
 * generated by `db:seed` and differ between databases. A row without a code is
 * one this fixture cannot name, so it is skipped rather than indexed under null.
 */
function lookup(rows: { id: string; code: string | null }[], what: string) {
  const map = new Map(
    rows.flatMap((row) => (row.code ? [[row.code, row.id] as const] : [])),
  );
  return (code: string) => must(map.get(code), `${what} "${code}"`);
}

async function loadContext() {
  const email = process.env.BOOTSTRAP_SUPERADMIN_EMAIL?.trim().toLowerCase();
  const publisherRows = email
    ? await db
        .select({ id: s.users.id, email: s.users.email })
        .from(s.users)
        .where(eq(s.users.email, email))
        .limit(1)
    : await db
        .select({ id: s.users.id, email: s.users.email })
        .from(s.users)
        .orderBy(asc(s.users.email))
        .limit(1);
  const publisher = must(
    publisherRows[0],
    "a console account to publish as — run db:seed first",
  );

  const [city] = await db
    .select({ id: s.cities.id })
    .from(s.cities)
    .where(eq(s.cities.code, CITY_CODE))
    .limit(1);
  const cityId = must(city, `city "${CITY_CODE}"`).id;

  const [areas, categories, audiences, services, tags] = await Promise.all([
    db
      .select({ id: s.cityAreas.id, code: s.cityAreas.code })
      .from(s.cityAreas)
      .where(eq(s.cityAreas.cityId, cityId)),
    db
      .select({ id: s.serviceCategories.id, code: s.serviceCategories.code })
      .from(s.serviceCategories),
    db
      .select({ id: s.audienceCategories.id, code: s.audienceCategories.code })
      .from(s.audienceCategories),
    db.select({ id: s.services.id, code: s.services.code }).from(s.services),
    db
      .select({ id: s.tags.id, code: s.tags.code })
      .from(s.tags)
      .where(eq(s.tags.namespace, "access")),
  ]);

  return {
    publisherId: publisher.id,
    publisherEmail: publisher.email,
    cityId,
    area: lookup(areas, "city area"),
    category: lookup(categories, "service category"),
    audience: lookup(audiences, "audience category"),
    service: lookup(services, "service"),
    tag: lookup(tags, "access tag"),
  };
}

type Context = Awaited<ReturnType<typeof loadContext>>;

/* --------------------------------- reset --------------------------------- */

const placeIds = PLACES.map((_, index) => demoId("place", index + 1));
const activityIds = ACTIVITIES.map((_, index) => demoId("activity", index + 1));
const entryIds = ARTICLES.map((_, index) => demoId("entry", index + 1));
const teamIds = TEAMS.map((team) => demoId("team", team.index));
const memberIds = MEMBERS.map((member) => demoId("member", member.index));
const translatorId = demoId("translator", TRANSLATOR.index);
const orgSkillIds = ORGANIZATION_SKILLS.map((skill) =>
  demoId("skill", skill.index),
);
const orgCourseIds = ORGANIZATION_COURSES.map((course) =>
  demoId("course", course.index),
);
const requirementSetIds = REQUIREMENT_SETS.map((set) =>
  demoId("requirementSet", set.index),
);
const invitationId = demoId("assignment", TRANSLATION_INVITATION.index);

/**
 * Delete what a previous run wrote, deepest first. Publications and
 * translations go before the source versions they cite (those FKs restrict),
 * and activities before the places they sit in.
 */
async function resetDemoContent() {
  /**
   * The invitation goes first: it cites a source version (that FK restricts)
   * and the translator directory entry, so nothing below it can be deleted
   * while it exists. Its own lifecycle events cascade with it.
   */
  await db
    .delete(s.translationAssignments)
    .where(eq(s.translationAssignments.id, invitationId));

  await db
    .delete(s.editorialPublications)
    .where(inArray(s.editorialPublications.entryId, entryIds));
  await db
    .delete(s.editorialRevisions)
    .where(inArray(s.editorialRevisions.entryId, entryIds));
  await db
    .delete(s.translationSourceVersions)
    .where(
      and(
        eq(s.translationSourceVersions.entityKind, "editorial_entry"),
        inArray(s.translationSourceVersions.entityId, entryIds),
      ),
    );
  await db
    .delete(s.editorialEntries)
    .where(inArray(s.editorialEntries.id, entryIds));

  await db
    .delete(s.activityPublications)
    .where(inArray(s.activityPublications.activityId, activityIds));
  await db
    .delete(s.activityTranslations)
    .where(inArray(s.activityTranslations.activityId, activityIds));
  await db.delete(s.activities).where(inArray(s.activities.id, activityIds));
  await db
    .delete(s.translationSourceVersions)
    .where(
      and(
        eq(s.translationSourceVersions.entityKind, "activity"),
        inArray(s.translationSourceVersions.entityId, activityIds),
      ),
    );

  await db.delete(s.places).where(inArray(s.places.id, placeIds));

  /**
   * The private half. A requirement set cascades to its items, a member or a
   * translator to their declarations and languages, so only the rows that own
   * something are named here. `city_team_members` is deleted by hand because its
   * team foreign key restricts, and the association's own catalogue rows go last,
   * once nothing points at them any more.
   */
  await db
    .delete(s.requirementSets)
    .where(inArray(s.requirementSets.id, requirementSetIds));
  await db
    .delete(s.cityTeamMembers)
    .where(inArray(s.cityTeamMembers.teamId, teamIds));
  await db.delete(s.cityTeams).where(inArray(s.cityTeams.id, teamIds));
  await db
    .delete(s.organizationMembers)
    .where(inArray(s.organizationMembers.id, memberIds));
  await db.delete(s.translators).where(eq(s.translators.id, translatorId));
  await db.delete(s.skills).where(inArray(s.skills.id, orgSkillIds));
  await db
    .delete(s.trainingCourses)
    .where(inArray(s.trainingCourses.id, orgCourseIds));
  console.log("reset: previous demo rows removed");
}

/* ---------------------------------- cover -------------------------------- */

/**
 * The picture the fixtures share as their cover, resolved rather than named.
 *
 * A row in `content.assets` points at a file in object storage, so this script
 * cannot create one: a made-up storage key is a broken image on every card. And
 * a hard-coded id does not survive the local database being disposable —
 * dropping the schema takes the row with it, and the re-upload gets a new id,
 * which used to fail the whole fixture over a decoration. So: the asset
 * `DEMO_COVER_ASSET_ID` pins when an operator names one, otherwise the newest
 * image the console holds, and otherwise none at all — the public readers treat
 * `coverImage` as optional, so the fixture is worth having without a picture.
 * Upload one and re-run to add it.
 *
 * The image is made public and rights-confirmed here, and the malware scan that
 * never runs locally is flipped to `clean`, because the publication gate refuses
 * anything else. Doing that by hand is exactly why this script insists on a
 * local database.
 *
 * The alt text is `decorative` in all three languages, and that is not laziness:
 * nothing here has seen the file, and inventing a description of a photograph
 * is worse for a screen reader than the empty alt the design system's §7
 * explicitly allows. Give it real alt text in the console when the picture
 * matters.
 */
async function prepareCover(): Promise<string | null> {
  const pinned = process.env.DEMO_COVER_ASSET_ID?.trim();
  if (pinned && !UUID_SHAPE.test(pinned))
    throw new Error(`Demo seed: DEMO_COVER_ASSET_ID="${pinned}" is not a uuid`);
  const [asset] = await db
    .select({ id: s.assets.id })
    .from(s.assets)
    .where(
      and(
        eq(s.assets.kind, "image"),
        isNull(s.assets.archivedAt),
        pinned ? eq(s.assets.id, pinned) : undefined,
      ),
    )
    .orderBy(desc(s.assets.createdAt))
    .limit(1);
  if (!asset) {
    if (pinned)
      throw new Error(
        `Demo seed: DEMO_COVER_ASSET_ID=${pinned} is not an image in this database`,
      );
    console.log(
      "cover: no image in the console — seeding without one; upload a picture and re-run to add it",
    );
    return null;
  }
  const coverAssetId = asset.id;

  await db
    .update(s.assets)
    .set({
      visibility: "public",
      scanState: "clean",
      rightsConfirmed: true,
      archivedAt: null,
      updatedAt: now,
    })
    .where(eq(s.assets.id, coverAssetId));

  for (const locale of LOCALES) {
    await db
      .insert(s.assetTranslations)
      .values({
        assetId: coverAssetId,
        languageCode: locale,
        title: "Photographie d'illustration (démonstration)",
        altText: null,
        decorative: true,
        state: "verified",
      })
      .onConflictDoUpdate({
        target: [s.assetTranslations.assetId, s.assetTranslations.languageCode],
        set: {
          title: "Photographie d'illustration (démonstration)",
          altText: null,
          decorative: true,
          state: "verified",
        },
      });
  }
  console.log(
    `cover: asset ${coverAssetId} marked clean and decorative in fr/en/ar`,
  );
  return coverAssetId;
}

/* ------------------------------ organisation ----------------------------- */

/**
 * The fictional associations every organisation-held row belongs to. They have
 * to be `verified` and unsuspended or the public reader drops their activities,
 * and a verified organisation without evidence is the thing AGENTS.md forbids —
 * so each approval row carries the demo label as its note, and both display
 * names say "ne pas publier" where a reader would see them.
 *
 * The second one publishes nothing. It exists for the private half of the
 * fixture: a partner whose member holds the first association's course.
 */
const ORGANIZATIONS: {
  key: OrganizationKey;
  index: number;
  slug: string;
  displayName: string;
}[] = [
  {
    key: "demo",
    index: 1,
    slug: "demo-association",
    displayName: DEMO_ORGANIZATION_NAME,
  },
  {
    key: "partner",
    index: 2,
    slug: "demo-association-partenaire",
    displayName: DEMO_PARTNER_ORGANIZATION_NAME,
  },
];

async function seedDemoOrganization(context: Context) {
  for (const organization of ORGANIZATIONS) {
    const id = ORGANIZATION_IDS[organization.key];
    await db
      .insert(s.organizations)
      .values({
        id,
        slug: organization.slug,
        displayName: organization.displayName,
        status: "verified",
        publishingSuspended: false,
      })
      .onConflictDoUpdate({
        target: s.organizations.id,
        set: {
          displayName: organization.displayName,
          status: "verified",
          publishingSuspended: false,
          updatedAt: now,
        },
      });

    await db
      .insert(s.organizationVerifications)
      .values({
        id: demoId("verification", organization.index),
        organizationId: id,
        reviewedById: context.publisherId,
        method: "demo_fixture",
        status: "approved",
        notes: DEMO_NOTE,
        decidedAt: now,
      })
      .onConflictDoUpdate({
        target: s.organizationVerifications.id,
        set: {
          reviewedById: context.publisherId,
          status: "approved",
          notes: DEMO_NOTE,
          decidedAt: now,
          updatedAt: now,
        },
      });
    console.log(`organisation: ${organization.displayName} verified`);
  }
}

/* --------------------------------- places -------------------------------- */

async function seedPlaces(context: Context) {
  for (const [index, fixture] of PLACES.entries()) {
    const id = demoId("place", index + 1);
    await db.insert(s.places).values({
      id,
      cityId: context.cityId,
      cityAreaId: context.area(fixture.areaCode),
      addressLine: fixture.addressLine,
      postalCode: POSTAL_CODE,
      lat: fixture.lat,
      lng: fixture.lng,
      precision: fixture.precision,
      active: true,
    });
    await db.insert(s.placeTranslations).values(
      LOCALES.map((locale) => ({
        placeId: id,
        languageCode: locale,
        name: fixture.copy[locale].name,
        directionsHint: fixture.copy[locale].directionsHint,
        state: "verified" as const,
      })),
    );
  }
  console.log(`places: ${String(PLACES.length)} seeded`);
}

/* ------------------------------- activities ------------------------------ */

async function seedActivities(context: Context, coverAssetId: string | null) {
  for (const [index, fixture] of ACTIVITIES.entries()) {
    const activityId = demoId("activity", index + 1);
    const organizationId =
      fixture.holder === "organization" ? DEMO_ORGANIZATION_ID : null;
    const checkedAt = daysFromNow(-fixture.checkedDaysAgo);
    const source = fixture.copy.fr;

    await db.insert(s.activities).values({
      id: activityId,
      slug: fixture.slug,
      organizationId,
      cityId: context.cityId,
      placeId: demoId("place", fixture.placeIndex),
      categoryId: context.category(fixture.categoryCode),
      audienceCategoryId: context.audience(fixture.audienceCode),
      sourceLanguageCode: "fr",
      manualStatus: fixture.manualStatus,
      published: true,
      createdById: context.publisherId,
      createdByScope: organizationId ? "organization" : "platform",
      provisionedByPlatform: organizationId === null,
      verifiedById: context.publisherId,
      sourceNote: DEMO_NOTE,
      stewardName: fixture.stewardName,
      lastVerifiedAt: checkedAt,
      reviewDueAt: daysFromNow(fixture.reviewDueInDays),
    });

    /**
     * Version 1 seals the authored language only, the same way
     * `createActivity` does: sealing the whole multilingual payload would make
     * the first console edit look like a source change and demote every
     * translation seeded with it.
     */
    const sourcePayload = {
      sourceLanguage: "fr",
      title: source.name,
      summary: source.shortDescription,
      bodyHtml: bodyHtml(source.paragraphs),
      plainText: bodyText(source.paragraphs),
    };
    const [inserted] = await db
      .insert(s.translationSourceVersions)
      .values({
        organizationId,
        entityKind: "activity",
        entityId: activityId,
        version: 1,
        sourceLanguageCode: "fr",
        sourceContentJson: sourcePayload,
        sourceContentHash: hashContent(sourcePayload),
        impact: "initial",
        createdById: context.publisherId,
      })
      .returning({ id: s.translationSourceVersions.id });
    const sourceVersionId = must(inserted, "activity source version").id;

    for (const locale of LOCALES) {
      const copy = fixture.copy[locale];
      const html = bodyHtml(copy.paragraphs);
      const contentHash = activityContentHash({
        languageCode: locale,
        title: copy.name,
        bodyHtml: html,
      });
      const live = fixture.publish.includes(locale);
      await db.insert(s.activityTranslations).values({
        activityId,
        languageCode: locale,
        name: copy.name,
        descriptionHtml: html,
        descriptionText: bodyText(copy.paragraphs),
        shortDescription: copy.shortDescription,
        instructions: copy.instructions,
        cancellationNote: copy.cancellationNote ?? null,
        // A language that is written but not activated is waiting for its read,
        // which is the only honest reason for it not to be live.
        state: live ? "verified" : "needs_review",
        method: "human",
        sourceVersionId,
        contentHash,
        reviewStage: live ? "platform_verified" : "platform_requested",
        reviewRequestedById: live ? null : context.publisherId,
        reviewRequestedAt: live ? null : daysFromNow(-2),
        verifiedById: live ? context.publisherId : null,
        verifiedAt: live ? checkedAt : null,
      });
      if (!live) continue;
      await db.insert(s.activityPublications).values({
        activityId,
        languageCode: locale,
        sourceVersionId,
        translationContentHash: contentHash,
        publishedById: context.publisherId,
        publishedAt: checkedAt,
      });
    }

    await db.insert(s.activityServices).values(
      fixture.serviceCodes.map((code, order) => ({
        activityId,
        serviceId: context.service(code),
        displayOrder: order,
      })),
    );
    await db.insert(s.activityTags).values(
      fixture.tagCodes.map((code, order) => ({
        activityId,
        tagId: context.tag(code),
        displayOrder: order,
      })),
    );
    await db.insert(s.scheduleRules).values(
      fixture.weekdays.map((weekday) => ({
        activityId,
        weekday,
        startTime: fixture.startTime,
        endTime: fixture.endTime,
      })),
    );
    // The fourth activity's place is `area_only` and has no address at all —
    // which is exactly the reader these rows are for, so it keeps a bus line.
    await db.insert(s.activityTransitLinks).values(
      fixture.transit.map((link, displayOrder) => ({
        activityId,
        mode: link.mode,
        line: link.line ?? null,
        stopName: link.stopName ?? null,
        walkMinutes: link.walkMinutes ?? null,
        displayOrder,
      })),
    );
    if (coverAssetId) {
      await db.insert(s.activityAssets).values({
        activityId,
        assetId: coverAssetId,
        role: "cover",
      });
    }

    // An organisation's activity is published on its provider's account; a
    // platform-held one has no provider by design and the card leaves that row
    // out entirely (DESIGN-SYSTEM.md §2 rule 3).
    if (organizationId) {
      await db.insert(s.activityProviders).values({
        activityId,
        organizationId,
        state: "confirmed",
        providerRole: "provider",
        active: true,
        proposedById: context.publisherId,
        confirmedById: context.publisherId,
        confirmedAt: checkedAt,
      });
    }
    console.log(
      `activity: ${fixture.slug} (${fixture.manualStatus}, ${fixture.publish.join("/")})`,
    );
  }
}

/* -------------------------------- articles ------------------------------- */

async function seedArticles(context: Context, coverAssetId: string | null) {
  for (const [index, fixture] of ARTICLES.entries()) {
    const entryId = demoId("entry", index + 1);
    const revisionId = demoId("revision", index + 1);
    const organizationId =
      fixture.owner === "organization" ? DEMO_ORGANIZATION_ID : null;
    const checkedAt = daysFromNow(-fixture.checkedDaysAgo);

    await db.insert(s.editorialEntries).values({
      id: entryId,
      kind: "article",
      slug: fixture.slug,
      workflowState: "published",
      cityId: context.cityId,
      stewardName: "Rédaction de démonstration",
    });
    await db.insert(s.editorialEntryRoutes).values(
      LOCALES.map((locale) => ({
        entryId,
        languageCode: locale,
        slug: fixture.routes[locale],
      })),
    );
    await db.insert(s.articleDetails).values({
      entryId,
      articleDate: fixture.articleDate,
      featured: fixture.featured,
    });
    await db.insert(s.editorialRevisions).values({
      id: revisionId,
      entryId,
      revisionNumber: 1,
      authorId: context.publisherId,
      sourceLanguageCode: "fr",
      canBecomeOutdated: fixture.unreliableFrom !== null,
      unreliableFrom: fixture.unreliableFrom,
      sourceSummary: `${DEMO_NOTE} ${fixture.sourceSummary}`,
      lastReviewedAt: checkedAt,
      reviewDueAt: daysFromNow(fixture.reviewDueInDays),
    });

    const localized = (locale: Locale) => ({
      title: fixture.copy[locale].title,
      summary: fixture.copy[locale].summary,
      bodyHtml: bodyHtml(fixture.copy[locale].paragraphs),
      plainText: bodyText(fixture.copy[locale].paragraphs),
    });

    // An editorial source version seals every language at once — unlike an
    // activity, an article's revision *is* the multilingual payload.
    const sourceContent = {
      sourceLanguage: "fr",
      articleDate: fixture.articleDate,
      translations: Object.fromEntries(
        LOCALES.map((locale) => [locale, localized(locale)]),
      ),
    };
    const [inserted] = await db
      .insert(s.translationSourceVersions)
      .values({
        organizationId,
        entityKind: "editorial_entry",
        entityId: entryId,
        version: 1,
        sourceRevisionId: revisionId,
        sourceLanguageCode: "fr",
        sourceContentJson: sourceContent,
        sourceContentHash: hashContent(sourceContent),
        impact: "initial",
        createdById: context.publisherId,
      })
      .returning({ id: s.translationSourceVersions.id });
    const sourceVersionId = must(inserted, "article source version").id;

    for (const locale of LOCALES) {
      const payload = localized(locale);
      const contentHash = localizedContentHash(locale, payload);
      const live = fixture.publish.includes(locale);
      await db.insert(s.editorialRevisionTranslations).values({
        revisionId,
        languageCode: locale,
        title: payload.title,
        summary: payload.summary,
        bodyJson: { html: payload.bodyHtml },
        plainText: payload.plainText,
        state: live ? "verified" : "needs_review",
        method: "human",
        sourceVersionId,
        contentHash,
        reviewStage: live ? "platform_verified" : "platform_requested",
        reviewRequestedById: live ? null : context.publisherId,
        reviewRequestedAt: live ? null : daysFromNow(-2),
        verifiedById: live ? context.publisherId : null,
        verifiedAt: live ? checkedAt : null,
      });
      if (!live) continue;
      await db.insert(s.editorialPublications).values({
        entryId,
        languageCode: locale,
        revisionId,
        sourceVersionId,
        translationContentHash: contentHash,
        publishedById: context.publisherId,
        publishedAt: checkedAt,
      });
    }

    await db.insert(s.editorialCustodianships).values({
      entryId,
      custodianKind: organizationId ? "organization" : "platform",
      organizationId,
      actorUserId: context.publisherId,
      startedAt: checkedAt,
    });
    if (coverAssetId) {
      await db.insert(s.editorialEntryAssets).values({
        entryId,
        assetId: coverAssetId,
        role: "cover",
      });
    }

    // Naming a factual owner is a claim about somebody else, so it travels with
    // the approval evidence FR-P1-021 asks for. Platform-held articles name no
    // organisation and the reader prints "InfoKit" instead.
    if (organizationId) {
      await db.insert(s.editorialRevisionOrganizations).values({
        revisionId,
        organizationId,
        role: "factual_owner",
        approvedByName: "Coordination (fixture de démonstration)",
        approvedVia: "demo_fixture",
        approvedAt: checkedAt,
        evidenceNote: DEMO_NOTE,
      });
    }
    console.log(
      `article: ${fixture.slug} (${fixture.publish.join("/")}${fixture.unreliableFrom ? `, unreliable from ${fixture.unreliableFrom}` : ""})`,
    );
  }
}

/* ------------------------------ teams and people ------------------------- */

/**
 * Teams, members and their spoken languages. `userId` stays null on every
 * member: no account is invented, which is also the state a real invited member
 * sits in until they sign in. The languages come from the whole of
 * `core.languages`, Pashto and Kurmancî included — the site is not published in
 * either, and somebody speaking one is a different fact from that.
 */
async function seedDemoPeople(context: Context) {
  for (const team of TEAMS) {
    await db.insert(s.cityTeams).values({
      id: demoId("team", team.index),
      organizationId: ORGANIZATION_IDS[team.owner],
      cityId: context.cityId,
      name: team.name,
      active: true,
    });
  }

  for (const member of MEMBERS) {
    const id = demoId("member", member.index);
    const organizationId = ORGANIZATION_IDS[member.owner];
    await db.insert(s.organizationMembers).values({
      id,
      organizationId,
      userId: null,
      firstName: member.firstName,
      lastName: member.lastName,
      contactEmail: member.contactEmail,
      phone: member.phone,
      title: member.title,
      status: "active",
    });
    await db.insert(s.cityTeamMembers).values({
      teamId: demoId("team", member.teamIndex),
      organizationId,
      memberId: id,
      isLead: member.isLead,
      active: true,
    });
    await db.insert(s.memberLanguages).values(
      member.languages.map((languageCode) => ({
        memberId: id,
        languageCode,
      })),
    );
  }
  console.log(
    `teams: ${String(TEAMS.length)} with ${String(MEMBERS.length)} members (no accounts, fiction-range numbers)`,
  );
}

/**
 * The directory translator, invited and not activated: `userId` null and
 * `activatedAt` null together, which is what the table's activation check means
 * by "not signed in yet". That is the state the self-service profile page has to
 * work in, since possession of an assignment link is what authorises it.
 */
async function seedDemoTranslator() {
  await db.insert(s.translators).values({
    id: translatorId,
    userId: null,
    ownerOrganizationId: DEMO_ORGANIZATION_ID,
    displayName: TRANSLATOR.displayName,
    contactEmail: TRANSLATOR.contactEmail,
    headline: TRANSLATOR.headline,
    status: "invited",
    directoryScope: "organization",
  });
  await db.insert(s.translatorLanguages).values(
    TRANSLATOR.languages.map((language) => ({
      translatorId,
      languageCode: language.code,
      canTranslateInto: language.into,
      canTranslateFrom: language.from,
    })),
  );
  console.log(`translator: ${TRANSLATOR.displayName} invited, not activated`);
}

/**
 * The invitation itself, pinned to the source version `seedActivities` sealed —
 * looked up rather than fixed, because that row's id is generated.
 *
 * `translatorId` is what makes this fixture worth having: an assignment sent to
 * an address typed into the form has nobody to write a profile for, so only a
 * link that names a directory entry can exercise
 * `/translate/profile`. `assignedById` is the console account, since a person
 * sent it.
 */
async function seedTranslationInvitation(context: Context) {
  const activityId = demoId("activity", TRANSLATION_INVITATION.activityIndex);
  const [source] = await db
    .select({ id: s.translationSourceVersions.id })
    .from(s.translationSourceVersions)
    .where(
      and(
        eq(s.translationSourceVersions.entityKind, "activity"),
        eq(s.translationSourceVersions.entityId, activityId),
      ),
    )
    .orderBy(asc(s.translationSourceVersions.version))
    .limit(1);

  await db.insert(s.translationAssignments).values({
    id: invitationId,
    organizationId: DEMO_ORGANIZATION_ID,
    entityKind: "activity",
    entityId: activityId,
    sourceVersionId: must(source, "activity source version to translate").id,
    targetLanguageCode: TRANSLATION_INVITATION.targetLanguage,
    translatorId,
    translatorEmail: TRANSLATOR.contactEmail,
    translatorName: TRANSLATOR.displayName,
    assignedById: context.publisherId,
    tokenHash: createHash("sha256")
      .update(TRANSLATION_INVITATION.token)
      .digest("hex"),
    state: "requested",
    instructions: TRANSLATION_INVITATION.instructions,
    expiresAt: daysFromNow(TRANSLATION_INVITATION.expiresInDays),
  });
  console.log(
    `invitation: /fr/translate/${TRANSLATION_INVITATION.token} (${TRANSLATION_INVITATION.targetLanguage}, one use)`,
  );
}

/* ------------------------- skills, courses, records ---------------------- */

/**
 * The association-owned rows, beside the global vocabulary `db:seed` writes.
 * `createdById` is the console account, because somebody typed these; the owner
 * is the organisation column, and the two are deliberately not the same thing.
 */
async function seedOrganizationCatalogue(context: Context) {
  for (const skill of ORGANIZATION_SKILLS) {
    await db.insert(s.skills).values({
      id: demoId("skill", skill.index),
      organizationId: ORGANIZATION_IDS[skill.owner],
      kind: skill.kind,
      code: skill.code,
      nameFr: skill.name.fr,
      nameEn: skill.name.en,
      nameAr: skill.name.ar,
      descriptionFr: skill.descriptionFr,
      visibility: skill.visibility,
      verificationRequired: skill.verificationRequired,
      active: true,
      createdById: context.publisherId,
    });
  }
  for (const course of ORGANIZATION_COURSES) {
    await db.insert(s.trainingCourses).values({
      id: demoId("course", course.index),
      organizationId: ORGANIZATION_IDS[course.owner],
      slug: course.slug,
      title: course.title.fr,
      titleEn: course.title.en,
      titleAr: course.title.ar,
      description: course.description,
      visibility: course.visibility,
      provider: DEMO_ORGANIZATION_NAME,
      sourceLanguageCode: "fr",
      verificationRequired: course.verificationRequired,
      active: true,
      createdById: context.publisherId,
    });
  }
  console.log(
    `catalogue: ${String(ORGANIZATION_SKILLS.length)} association skills, ${String(ORGANIZATION_COURSES.length)} association courses`,
  );
}

/** A verified or expired row was decided by somebody; the tables check the pair. */
function decisionOf(context: Context, declaration: DeclarationFixture) {
  const decided =
    declaration.state === "verified" || declaration.state === "expired";
  return {
    verifiedById: decided ? context.publisherId : null,
    verifiedAt: decided
      ? daysFromNow(-(declaration.obtainedDaysAgo ?? 7))
      : null,
  };
}

function datesOf(declaration: DeclarationFixture) {
  return {
    obtainedOn:
      declaration.obtainedDaysAgo === undefined
        ? null
        : dateFromNow(-declaration.obtainedDaysAgo),
    expiresOn:
      declaration.expiresInDays === undefined
        ? null
        : dateFromNow(declaration.expiresInDays),
  };
}

/**
 * Both catalogues by code, global rows and association rows together — which is
 * unambiguous only because the demo codes are chosen distinct from the global
 * ones; the schema itself lets an association reuse a global code, since the
 * uniqueness is per scope.
 */
async function catalogueLookups() {
  const [skillRows, courseRows] = await Promise.all([
    db.select({ id: s.skills.id, code: s.skills.code }).from(s.skills),
    db
      .select({ id: s.trainingCourses.id, code: s.trainingCourses.slug })
      .from(s.trainingCourses),
  ]);
  return {
    skill: lookup(skillRows, "skill"),
    course: lookup(courseRows, "course"),
  };
}

/** A member or the translator, in the exclusive shape the record tables want. */
type Holder =
  | { memberId: string; translatorId?: undefined }
  | { memberId?: undefined; translatorId: string };

/**
 * What each person declared. Records point at catalogue rows, never at text, so
 * this is the part that makes a requirement matchable: the OCP row Yusuf holds
 * is the same row the demo association's "Permanence" set asks for.
 */
async function seedDeclarations(context: Context) {
  const { skill, course } = await catalogueLookups();
  const declared: {
    holder: Holder;
    skills: DeclarationFixture[];
    courses: DeclarationFixture[];
  }[] = [
    ...MEMBERS.map((member) => ({
      holder: { memberId: demoId("member", member.index) },
      skills: member.skills,
      courses: member.courses,
    })),
    {
      holder: { translatorId },
      skills: [...TRANSLATOR.skills],
      courses: [...TRANSLATOR.courses],
    },
  ];

  let skillCount = 0;
  let courseCount = 0;
  for (const person of declared) {
    const holder = {
      memberId: person.holder.memberId ?? null,
      translatorId: person.holder.translatorId ?? null,
    };
    for (const declaration of person.skills) {
      await db.insert(s.skillRecords).values({
        ...holder,
        skillId: skill(declaration.code),
        state: declaration.state,
        note: declaration.note ?? null,
        ...datesOf(declaration),
        ...decisionOf(context, declaration),
      });
      skillCount += 1;
    }
    for (const declaration of person.courses) {
      const { obtainedOn, expiresOn } = datesOf(declaration);
      await db.insert(s.trainingRecords).values({
        ...holder,
        courseId: course(declaration.code),
        state: declaration.state,
        completedOn: obtainedOn,
        expiresOn,
        note: declaration.note ?? null,
        ...decisionOf(context, declaration),
      });
      courseCount += 1;
    }
  }
  console.log(
    `declarations: ${String(skillCount)} skills, ${String(courseCount)} courses`,
  );
}

/* ------------------------------ requirements ----------------------------- */

/**
 * The two sets from the brief. An item points at exactly one of a skill, a
 * course or a language, so the fixture's `target` carries the prefix and this is
 * where it is taken apart.
 */
async function seedRequirementSets(context: Context) {
  const { skill, course } = await catalogueLookups();

  for (const set of REQUIREMENT_SETS) {
    const setId = demoId("requirementSet", set.index);
    await db.insert(s.requirementSets).values({
      id: setId,
      organizationId: ORGANIZATION_IDS[set.owner],
      code: set.code,
      name: set.name,
      description: set.description,
      sourceLanguageCode: "fr",
      active: true,
      createdById: context.publisherId,
    });
    await db.insert(s.requirementItems).values(
      set.items.map((item) => {
        const language = item.target.startsWith("language:")
          ? item.target.slice("language:".length)
          : null;
        const courseSlug = item.target.startsWith("course:")
          ? item.target.slice("course:".length)
          : null;
        const skillCode = language === null && courseSlug === null;
        return {
          setId,
          skillId: skillCode ? skill(item.target) : null,
          courseId: courseSlug === null ? null : course(courseSlug),
          languageCode: language,
          necessity: item.necessity,
          mustBeVerified: item.mustBeVerified ?? false,
          mustBeCurrent: true,
          minimumCount: item.minimumCount ?? null,
          note: item.note ?? null,
        };
      }),
    );
    console.log(
      `requirements: ${set.code} with ${String(set.items.length)} conditions`,
    );
  }
}

/* ---------------------------------- main --------------------------------- */

async function main() {
  const context = await loadContext();
  console.log(`Seeding demo content as ${context.publisherEmail}…`);
  await resetDemoContent();
  const coverAssetId = await prepareCover();
  await seedDemoOrganization(context);
  await seedPlaces(context);
  await seedActivities(context, coverAssetId);
  await seedArticles(context, coverAssetId);
  await seedDemoPeople(context);
  await seedDemoTranslator();
  await seedTranslationInvitation(context);
  await seedOrganizationCatalogue(context);
  await seedDeclarations(context);
  await seedRequirementSets(context);
  console.log(
    `Done: ${String(ACTIVITIES.length)} activities and ${String(ARTICLES.length)} articles published, ${String(MEMBERS.length)} members and one translator with declarations. ${DEMO_NOTE}`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void client.end();
  });
