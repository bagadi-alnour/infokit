import type { AboutStrings } from "./types";

export const french: AboutStrings = {
  title: "À propos d’InfoKit",
  tagline:
    "Ce qui est ouvert, ce qui y est proposé, et la date de la dernière vérification.",
  intro:
    "InfoKit répond à une question : qu’est-ce que je peux obtenir dans cette ville aujourd’hui, et où. L’application s’adresse aux personnes qui ont besoin d’aide concrète — un repas, une douche, un médecin, un conseil juridique, un cours de français, une prise pour recharger un téléphone — et chaque information est revérifiée régulièrement, pour rester exacte et à jour. C’est aussi là que les organisations qui proposent cette aide publient ensemble et coordonnent leur travail.",
  what: {
    title: "Ce que vous pouvez chercher",
    body: "Cinq onglets, une question chacun. Rien n’est caché dans un menu : chaque écran répond où, quand, et ce qui est proposé.",
    points: [
      "Accueil — ce qui est ouvert, ce qui suit, et l’agenda",
      "Maintenant — chaque lieu avec son état à cette heure",
      "Carte — ce qui se trouve autour de vous",
      "Guide — une démarche expliquée étape par étape",
      "Articles — annonces et changements",
    ],
  },
  source: {
    title: "Qui l’écrit",
    body: "Rien ici n’est deviné ni récupéré sur le web. Les associations, les accueils de jour et les services publics publient eux-mêmes leurs informations, et chaque information nomme l’organisation qui l’a publiée — pour que vous sachiez toujours qui vous parle.",
    points: [
      "L’organisation est nommée sur chaque information",
      "Une organisation est vérifiée avant que ses publications apparaissent",
    ],
  },
  freshness: {
    title: "La fraîcheur des informations",
    body: "Chaque information conserve le jour de sa dernière vérification, et l’affiche. Quand ce jour devient ancien, l’application ne la présente plus comme sûre et vous demande de confirmer, plutôt que de vous laisser avec les horaires du mois dernier.",
    points: [
      "Le jour de la dernière vérification, sur l’information elle-même",
      "Un avertissement quand ce jour devient ancien",
    ],
  },
  statuses: {
    title: "Les quatre mots",
    body: "Les mêmes quatre mots partout dans l’application, chacun avec sa forme en plus de sa couleur, pour rester lisibles sans distinguer les couleurs.",
    meanings: {
      open: "Ouvert à cette heure.",
      closed:
        "Fermé à cette heure ; la prochaine ouverture est indiquée à côté.",
      uncertain:
        "Non confirmé, ou vérifié il y a trop longtemps. Renseignez-vous avant de vous déplacer.",
      cancelled: "C’était annoncé et cela n’aura pas lieu.",
    },
  },
  languages: {
    title: "Onze langues",
    body: "L’application s’ouvre dans la langue de votre téléphone quand elle fait partie des onze, et vous pouvez la changer à tout moment en haut de n’importe quel écran. L’arabe, le persan, le dari, le pachto et le kurde se lisent de droite à gauche, et toute l’interface se retourne avec eux.",
    points: [],
  },
  privacy: {
    title: "Ce qui n’est jamais demandé",
    body: "Aucune inscription, aucun numéro de téléphone, aucune publicité, aucun suivi. La langue et l’apparence que vous choisissez restent sur ce téléphone, et ce que vous lisez n’est pas enregistré.",
    points: [],
  },
  security: {
    title: "Comment les espaces sont séparés",
    body: "Les informations publiées et le travail propre des organisations sont deux espaces distincts, et seul le premier est ouvert. L’espace public contient des activités, des lieux, des horaires, des événements, des articles, des guides et des fiches d’organisation. Il ne contient jamais rien sur les personnes qui travaillent dans ces organisations — aucune fiche de membre, aucune adresse e-mail, aucun compte, aucune liste d’équipe, aucune disponibilité, aucune consigne interne, aucun brouillon, aucun document signé. Chaque modification garde son auteur et sa date, pour qu’une erreur puisse être retrouvée et corrigée, et InfoKit ne conserve aucune trace de l’aide reçue par qui que ce soit.",
    points: [
      "La lecture est anonyme : aucun compte, aucun numéro, aucune publicité, aucun suivi",
      "Rien sur un membre n’est public — ni un nom dans une liste, ni un e-mail, ni un compte",
      "Chaque organisation travaille dans son propre espace, et ce qui s’y écrit y reste jusqu’à publication",
      "Une réunion entre organisations est privée, sauf si celle qui l’organise choisit de l’annoncer",
      "Quand un lieu doit rester discret, seule la zone est indiquée, ou il vous est demandé de prendre contact d’abord",
      "Les membres se connectent avec un lien à usage unique ou un mot de passe, plus un code envoyé sur leur téléphone, et une session peut être révoquée",
    ],
  },
  cities: {
    title: "Calais d’abord, puis d’autres villes",
    body: "InfoKit est une plateforme pour n’importe quelle ville, et Calais est la première. Rien dans l’application n’appartient à un seul endroit : une nouvelle ville arrive avec ses associations, ses lieux et les mêmes onze langues.",
    points: [],
  },
  collaboration: {
    title: "C’est aussi pour les organisations",
    body: "InfoKit n’est pas seulement destiné aux personnes qui cherchent de l’aide. C’est aussi l’outil de travail des associations, des accueils de jour et des services publics de la ville : un seul endroit pour publier au lieu d’une dizaine de fils de discussion, et un agenda commun pour qu’une distribution, une réunion ou une fermeture soit connue à l’avance plutôt qu’après.",
    points: [
      "Une information, un responsable : celui qui gère un service est celui qui le modifie",
      "Un agenda partagé entre organisations, pour que les plans ne se télescopent plus",
      "Une correction est faite une fois et arrive ensemble sur le site, dans l’application et dans onze langues",
      "Chaque organisation garde son propre historique : ce qui a changé, quand, et par qui",
    ],
  },
  associations: {
    title: "Si vous gérez un service",
    body: "La publication se fait sur la version web, pas dans cette application : les informations y sont écrites, relues et datées, là où une association voit son propre historique et qui a modifié quoi. Cette application se contente de lire ce qui a été publié.",
    points: [
      "Les membres se connectent depuis le bouton en haut de l’écran",
      "Ici on lit, sur le web on modifie",
    ],
  },
  versionLabel: "Version de l’application",
};
