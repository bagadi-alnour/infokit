import type { AboutStrings } from "./types";

export const english: AboutStrings = {
  title: "About InfoKit",
  tagline:
    "Practical public information for people seeking help, and shared tools for the organisations providing it.",
  intro:
    "InfoKit is being built in Calais around two connected needs. A person seeking support with an essential need should be able to find clear answers: what is available, where, when, who provides it and when someone last checked the information. Associations, day centres and public services need one place to publish those answers, correct them and coordinate changes without copying the same update between messages, spreadsheets, websites, email and paper.",
  independence: {
    title: "An independent service",
    body: "InfoKit is an independent humanitarian and social information and guidance service. It is not affiliated with any prefecture, government administration or police service. InfoKit does not facilitate irregular entry into the country, the crossing of borders or the circumvention of administrative or judicial controls. Published legal information is general and does not replace support from a qualified professional.",
    points: [],
  },
  what: {
    title: "What you can find",
    body: "The public service brings together published activities, opening times, locations, public events, articles, organisation profiles and step-by-step guides. Public information is available without an account on the web and through the Android and iOS apps.",
    points: [
      "See what is open and what opens next",
      "Search by need, service, place, audience or organisation",
      "Use a text list when a map is slow or unsuitable",
      "Follow a guide one question at a time",
      "Check who provides the service and when the information was verified",
    ],
  },
  source: {
    title: "Reliability starts with a source",
    body: "Information is published or confirmed directly by the organisations responsible for the services it describes. InfoKit does not treat an unverified claim as a fact. Each public record names the association or platform team responsible for it. An organisation must be verified before its services appear under its name, and draft content stays out of public view.",
    points: [
      "Each public record has a named owner",
      "Editors record sources and review dates",
      "Unverified organisations and drafts remain private",
    ],
  },
  freshness: {
    title: "Current when possible, clear when uncertain",
    body: "Opening hours and availability can change after publication. InfoKit shows when a record was last verified and when its next review is due. If the check is old, a service is cancelled or staff cannot confirm it, the app says so and asks you to confirm before travelling.",
    points: [
      "The last verification date appears on the record",
      "Warnings identify old or uncertain information",
    ],
  },
  statuses: {
    title: "Four service states",
    body: "The same four states appear across the service. Each uses a label, symbol and colour.",
    meanings: {
      open: "Confirmed open at the time shown.",
      closed:
        "Closed at the time shown; the next known opening appears when available.",
      uncertain:
        "Not confirmed, or checked too long ago. Contact the provider before travelling.",
      cancelled: "A scheduled occurrence will not take place.",
    },
  },
  languages: {
    title: "Accessibility in real conditions",
    body: "InfoKit is designed for small phones, slow or expensive connections, interrupted attention and eleven languages. A text list remains available when a map is slow or unsuitable. Arabic, Persian, Dari, Pashto and Sorani read right to left. You can change the language without an account, including on a borrowed phone.",
    points: [],
  },
  privacy: {
    title: "Dignity without a profile",
    body: "You can use the public service without giving InfoKit your name or phone number. InfoKit does not create a profile of the help you view or receive. Answers you give while following a guide stay within that session. Language and appearance choices stay on your device.",
    points: [],
  },
  security: {
    title: "Public information and private work stay separate",
    body: "Public pages contain published information only. Drafts, member accounts, email addresses, teams, availability, internal instructions and signed documents stay in restricted organisation areas. Each organisation has its own workspace. Coordination events remain private unless the host chooses a wider audience.",
    points: [
      "Public reading requires no account",
      "Member and draft information never feeds the public read model",
      "When a service's safety, confidentiality or capacity requires it, its exact address may not be shown publicly. Access arrangements are then given directly by the organisation responsible",
    ],
  },
  cities: {
    title: "Calais first",
    body: "Calais is the first and only committed deployment. The platform keeps places, languages, organisations and local information separate from the software so another city could use InfoKit later. The service does not claim to cover other cities today.",
    points: [],
  },
  collaboration: {
    title: "Collaboration without losing ownership",
    body: "InfoKit gives participating associations, day centres and public services a shared place to publish information and coordinate work. Each organisation keeps its own workspace and controls its own information. Organisations can share an agenda, coordinate public or inter-organisation events and work together on joint publications.",
    points: [
      "One shared agenda helps organisations avoid conflicting plans",
      "The host chooses who can see each coordination event",
      "A published correction reaches the website and mobile apps from the same reviewed source",
    ],
  },
  associations: {
    title: "Responsibility stays visible",
    body: "Publishing and coordination happen in the web workspace for invited members. InfoKit records who changed, verified, approved and published information, and when. This history allows organisations to correct mistakes without erasing what happened.",
    points: [
      "Saving a draft never publishes it",
      "Only authorised members can publish",
      "The mobile apps read published public content and authorised agendas",
    ],
  },
  limits: {
    title: "What InfoKit does not do",
    body: "InfoKit does not register people seeking help, manage individual cases, decide eligibility or provide legal decisions. It does not keep a record of who received assistance. Its role is narrower: help someone find reviewed information and identify the organisation responsible for it, while giving participating organisations safer tools to publish and coordinate their work.",
    points: [],
  },
  versionLabel: "App version",
};
