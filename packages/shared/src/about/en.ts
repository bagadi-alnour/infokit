import type { AboutStrings } from "./types";

export const english: AboutStrings = {
  title: "About InfoKit",
  tagline: "What is open, what it offers, and when it was last checked.",
  intro:
    "InfoKit answers one question: what can I get in this city today, and where. It is written for people who need practical help — a meal, a shower, a doctor, legal advice, a French class, somewhere to charge a phone — and every entry is checked again regularly, so what you read stays accurate and current. It is also where the organisations that provide that help publish together and coordinate their work.",
  what: {
    title: "What you can look up",
    body: "Five tabs, one question each. Nothing is buried in a menu: every screen answers where, when, and what is offered.",
    points: [
      "Home — what is open, what is next, and the agenda",
      "Now — every place with the state it is in at this hour",
      "Map — what is around you",
      "Guide — a procedure explained step by step",
      "Articles — announcements and what has changed",
    ],
  },
  source: {
    title: "Who writes it",
    body: "Nothing here is guessed or collected from the web. Associations, day centres and public services publish their own entries, and every entry names the organisation that published it — so you always know who is telling you.",
    points: [
      "The organisation is named on every entry",
      "An organisation is checked before its entries appear",
    ],
  },
  freshness: {
    title: "How fresh the information is",
    body: "Every entry keeps the day it was last checked, and shows it. Once that day is old, the app stops presenting the entry as settled and asks you to confirm, rather than leaving you with last month's hours.",
    points: [
      "The day of the last check, on the entry itself",
      "A warning when that day gets old",
    ],
  },
  statuses: {
    title: "The four words",
    body: "The same four words everywhere in the app, each with its own shape as well as its own colour, so they can be read without seeing colour.",
    meanings: {
      open: "Open at this hour.",
      closed: "Closed at this hour; the next opening is shown beside it.",
      uncertain: "Not confirmed, or checked too long ago. Ask before you go.",
      cancelled: "It was announced and will not happen.",
    },
  },
  languages: {
    title: "Eleven languages",
    body: "The app opens in your phone's language when that language is one of the eleven, and you can change it at any time from the top of any screen. Arabic, Persian, Dari, Pashto and Kurdish are read right to left, and the whole interface turns with them.",
    points: [],
  },
  privacy: {
    title: "What is never asked for",
    body: "No sign-up, no phone number, no advertising, no tracking. The language and appearance you choose stay on this phone, and what you read is not saved.",
    points: [],
  },
  security: {
    title: "How the areas are kept apart",
    body: "The published information and the organisations' own work are two separate areas, and only the first one is open. The public area holds activities, places, opening hours, events, articles, guides and organisation profiles. It never holds anything about the people who work in those organisations — no member records, no email addresses, no accounts, no team lists, no availability, no internal instructions, no drafts, no signed documents. Every change keeps its author and its date, so a mistake can be traced and corrected, and InfoKit holds no record of the help anyone received.",
    points: [
      "Reading is anonymous: no account, no phone number, no advertising, no tracking",
      "Nothing about a member is ever public — no name in a list, no email, no account",
      "Each organisation works in its own space, and what is being written stays inside it until it is published",
      "A meeting between organisations is private unless the organisation hosting it chooses to announce it",
      "Where a place has to stay discreet, only the area is shown, or you are asked to make contact first",
      "Members sign in with a single-use link or a password plus a code sent to their phone, and a session can be revoked",
    ],
  },
  cities: {
    title: "Calais first, then other cities",
    body: "InfoKit is a platform for any city, and Calais is the first one. Nothing in the app belongs to a single place: a new city arrives with its own associations, its own places, and the same eleven languages.",
    points: [],
  },
  collaboration: {
    title: "It is for the organisations too",
    body: "InfoKit is not only for the people looking for help. It is also the working surface of the associations, day centres and public services of the city: one place to publish instead of a dozen threads, and one shared agenda so a distribution, a meeting or a closure is known in advance instead of afterwards.",
    points: [
      "One entry, one owner: whoever runs a service is the one who changes it",
      "One agenda shared between organisations, so plans stop colliding",
      "A correction is made once and reaches the site, the app and eleven languages together",
      "Each organisation keeps its own history: what changed, when, and by whom",
    ],
  },
  associations: {
    title: "If you run a service",
    body: "Publishing happens on the web version, not in this app: entries are written, reviewed and dated there, where an association can see its own history and who changed what. This app only reads what has been published.",
    points: [
      "Members sign in from the button at the top of the screen",
      "Reading here, editing on the web",
    ],
  },
  versionLabel: "App version",
};
