import type { WelcomeStrings } from "./types";

export const french: WelcomeStrings = {
  languageTitle: "Choisissez votre langue",
  languageBody:
    "{language} est sélectionné — c’est la langue de votre téléphone.",
  languagePicked: "{language} est sélectionné.",
  detected: "langue de votre téléphone",
  scrollHint: "D’autres langues plus bas",
  continueIn: "Continuer en {language}",
  skip: "Passer",
  back: "Retour",
  next: "Suivant",
  finish: "Voir ce qui est ouvert",
  stepOf: "Étape {step} sur {total}",
  statusLegendLabel: "Les quatre états affichés",
  statusWords: {
    open: "Ouvert",
    closed: "Fermé",
    uncertain: "À confirmer",
    cancelled: "Annulé",
  },
  visuals: {
    now: "En ce moment",
    dayLabel: "Votre journée, heure par heure",
    example: "Exemple",
    checkedToday: "Vérifié aujourd’hui",
    checkedDaysAgo: "Vérifié il y a {days} jours",
    stale: "À confirmer avant de vous déplacer",
    neverAsked: "Jamais demandé",
    neverAskedItems: [
      "Votre nom",
      "Votre numéro de téléphone",
      "Une adresse e-mail",
      "Un mot de passe",
    ],
  },
  features: [
    {
      title: "Voyez ce qui est ouvert maintenant",
      body: "Chaque lieu indique son état, sa prochaine ouverture et ce qu’il propose aujourd’hui — pour savoir avant de vous déplacer.",
      points: [],
    },
    {
      title:
        "Les informations publiées sont vérifiées régulièrement, pour rester fraîches",
      body: "Les associations publient ici, puis reviennent confirmer ce qu’elles ont écrit. Chaque information garde le jour de sa dernière vérification et vous le montre. Quand cette date vieillit, l’application cesse de la présenter comme sûre et vous demande de la confirmer avant de vous déplacer. Rien ici n’est laissé pour vrai indéfiniment.",
      points: [
        "Le jour de la dernière vérification",
        "Un avertissement dès que cette date vieillit",
        "L’association qui l’a publiée",
      ],
    },
    {
      title: "Lecture gratuite, sans compte et sans rien demander sur vous",
      body: "Aucune inscription, aucun numéro de téléphone, aucun suivi. Votre langue reste sur votre téléphone, ce que vous lisez n’est pas conservé et rien ne nous parvient à votre sujet. Tout lire ne coûte rien : pas de frais, pas de publicité, et assez peu de données pour fonctionner avec une connexion faible.",
      points: [
        "Gratuit, sans publicité",
        "Onze langues, modifiables à tout moment",
        "Lisible avec très peu de données",
      ],
    },
  ],
};
