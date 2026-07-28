import type { WelcomeStrings } from "./types";

export const english: WelcomeStrings = {
  languageTitle: "Choose your language",
  languageBody: "{language} is selected — it is your phone's language.",
  languagePicked: "{language} is selected.",
  detected: "your phone's language",
  scrollHint: "More languages below",
  continueIn: "Continue in {language}",
  skip: "Skip",
  back: "Back",
  next: "Next",
  finish: "See what is open",
  stepOf: "Step {step} of {total}",
  statusLegendLabel: "The four states you will see",
  statusWords: {
    open: "Open",
    closed: "Closed",
    uncertain: "To confirm",
    cancelled: "Cancelled",
  },
  visuals: {
    now: "Right now",
    dayLabel: "Your day, hour by hour",
    example: "Example",
    checkedToday: "Checked today",
    checkedDaysAgo: "Checked {days} days ago",
    stale: "Confirm before you go",
    neverAsked: "Never asked for",
    neverAskedItems: [
      "Your name",
      "Your phone number",
      "An email address",
      "A password",
    ],
  },
  features: [
    {
      title: "See what is open right now",
      body: "Every place shows its state, the next opening time, and what it offers today — so you know before you walk there.",
      points: [],
    },
    {
      title:
        "Published information is checked again regularly, so it stays fresh",
      body: "Associations publish here and come back to confirm what they wrote. Every entry keeps the day it was last checked and shows you that day. Once the date gets old, the app stops presenting the entry as settled and asks you to confirm it before you set out. Nothing here is left to look true forever.",
      points: [
        "The day it was last checked",
        "A warning on outdated information",
        "The association that published it",
      ],
    },
    {
      title: "Free to read, with no account and nothing asked about you",
      body: "There is no sign-up, no phone number and no tracking. Your language stays on your phone, what you read is not kept, and nothing about you reaches us. Reading all of it costs nothing: no fee, no advertising, and little enough data to work on a weak connection.",
      points: [
        "Free, without advertising",
        "Eleven languages, change at any time",
        "Readable on very little data",
      ],
    },
  ],
};
