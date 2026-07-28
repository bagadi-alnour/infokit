import type { WelcomeStrings } from "./types";

export const oromo: WelcomeStrings = {
  languageTitle: "Afaan kee filadhu",
  languageBody: "{language} filatameera — afaan bilbila keeti.",
  languagePicked: "{language} filatameera.",
  detected: "afaan bilbila keeti",
  scrollHint: "Afaanota dabalataa gadi jiru",
  continueIn: "Afaan {language} itti fufi",
  skip: "Bira darbi",
  back: "Duubatti",
  next: "Itti aanu",
  finish: "Maal banaa jiru ilaali",
  stepOf: "Tarkaanfii {step} kan {total}",
  statusLegendLabel: "Haalawwan afur ati argitu",
  statusWords: {
    open: "Banaa",
    closed: "Cufaa",
    uncertain: "Kan hin mirkanoofne",
    cancelled: "Haqame",
  },
  visuals: {
    now: "Amma",
    dayLabel: "Guyyaa kee, saʼaatii saʼaatiin",
    example: "Fakkeenya",
    checkedToday: "Har’a mirkaneeffame",
    checkedDaysAgo: "Guyyoota {days} dura mirkaneeffame",
    stale: "Utuu hin deemin mirkaneeffadhu",
    neverAsked: "Gonkumaa hin gaafatamu",
    neverAskedItems: [
      "Maqaa kee",
      "Lakkoofsa bilbila kee",
      "Teessoo imeelii",
      "Jecha icciitii",
    ],
  },
  features: [
    {
      title: "Amma maal banaa jiru ilaali",
      body: "Iddoon kamiyyuu haala isaa, yeroo banaa itti aanu, fi waan har’a dhiheessu agarsiisa — utuu hin deemin akka beektuuf.",
      points: [],
    },
    {
      title:
        "Odeeffannoon maxxanfame yeroo yeroon sakattaʼama, kanaaf haaraa taʼee itti fufa",
      body: "Waldaaleen asirratti maxxansanii, booda deebiʼanii waan barreessan mirkaneessu. Odeeffannoon kamiyyuu guyyaa dhumaa itti sakattaʼame qabatee, guyyaa sana sitti agarsiisa. Guyyaan sun yeroo dulloomu, appichi akka waan mirkanaaʼeetti dhiheessuu dhiisee, utuu hin deemin akka mirkaneeffattu si gaafata. Asitti homtuu bara baraan dhugaa taʼee hin hafu.",
      points: [
        "Guyyaa dhumaa itti sakattaʼame",
        "Akeekkachiisa akkuma guyyaan sun dulloome",
        "Waldaa odeeffannoo sana maxxanse",
      ],
    },
    {
      title:
        "Dubbisuun bilisa, herregni hin barbaachisu, waaʼee kees homaa hin gaafannu",
      body: "Galmeen hin jiru, lakkoofsi bilbilaa hin jiru, hordoffiin hin jiru. Afaan kee bilbila kee irratti hafa, wanti ati dubbistu hin kuufamu, waaʼee kees homtuu gara keenya hin dhufu. Kana hunda dubbisuun gatii hin qabu: kaffaltii hin qabu, beeksisa hin qabu, daataa xiqqoo qofa fayyadamee interneetii laafaa irrattis hojjeta.",
      points: [
        "Bilisa, beeksisa malee",
        "Afaanota kudha tokko, yeroo barbaadde jijjiiri",
        "Daataa baay’ee xiqqaadhaan dubbifama",
      ],
    },
  ],
};
