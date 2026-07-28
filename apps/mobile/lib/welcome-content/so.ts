import type { WelcomeStrings } from "./types";

export const somali: WelcomeStrings = {
  languageTitle: "Dooro luqaddaada",
  languageBody: "{language} waa la doortay — waa luqadda taleefankaaga.",
  languagePicked: "{language} waa la doortay.",
  detected: "luqadda taleefankaaga",
  scrollHint: "Luqado dheeraad ah hoosta",
  continueIn: "Sii wad {language}",
  skip: "Ka bood",
  back: "Dib",
  next: "Xiga",
  finish: "Arag waxa furan",
  stepOf: "Tallaabo {step} ee {total}",
  statusLegendLabel: "Afarta xaalad ee aad arki doonto",
  statusWords: {
    open: "Furan",
    closed: "Xiran",
    uncertain: "Hubaal ma aha",
    cancelled: "La joojiyay",
  },
  visuals: {
    now: "Hadda",
    dayLabel: "Maalintaada, saac saac",
    example: "Tusaale",
    checkedToday: "Maanta la xaqiijiyay",
    checkedDaysAgo: "{days} maalmood ka hor la xaqiijiyay",
    stale: "Xaqiiji intaadan tegin",
    neverAsked: "Waligood lama weydiisto",
    neverAskedItems: [
      "Magacaaga",
      "Lambarka taleefankaaga",
      "Cinwaan iimeyl",
      "Furaha sirta",
    ],
  },
  features: [
    {
      title: "Arag waxa hadda furan",
      body: "Goob kastaa waxay muujisaa xaaladdeeda, waqtiga furitaanka xiga, iyo waxa ay maanta bixiso — si aad ogaato intaadan tegin.",
      points: [],
    },
    {
      title:
        "Xogta la daabacay si joogto ah waa dib-loo-eegaa, si ay cusub u ahaato",
      body: "Ururradu halkan ayey wax daabacaan, ka dibna waxay ku soo noqdaan inay xaqiijiyaan wixii ay qoreen. Xog kastaa waxay xajisaa maalintii ugu dambeysay ee dib-loo-eegay, maalintaasna way ku tusaysaa. Marka taariikhdaas gaboowdo, barnaamijku wuu joojinayaa inuu xogta u soo bandhigo sida mid hubaal ah, waxaana kaa codsanaya inaad xaqiijiso intaadan tegin. Waxba halkan looma daayo inay weligood run u ekaadaan.",
      points: [
        "Maalintii ugu dambeysay ee dib-loo-eegay",
        "Digniin isla marka taariikhdaas gaboowdo",
        "Ururka daabacay xogta",
      ],
    },
    {
      title:
        "Akhrisku waa bilaash, xisaab looma baahna, waxbana kaaga ah lama weydiiyo",
      body: "Isqorid ma jirto, lambar taleefan ma jiro, la socosho ma jirto. Luqaddaadu waxay ku hadhaysaa taleefankaaga, wixii aad akhriso lama kaydiyo, waxbana kaaga ah noo soo gaadho. Waxaas oo dhan akhrisku waxba kaa ma qaadan: lacag ma leh, xayeysiis ma leh, oo xog yar ayuu isticmaalaa si uu isku xir daciif ahna ugu shaqeeyo.",
      points: [
        "Bilaash, xayeysiis la’aan",
        "Kow iyo toban luqad, mar kasta beddel",
        "Waa la akhriyi karaa xog aad u yar",
      ],
    },
  ],
};
