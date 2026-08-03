# InfoKit store assets, version 1.0.0

## Upload-ready brand assets

- `google-play/icon-512.png`: 512 × 512 Google Play icon.
- `google-play/feature-graphic.jpg`: 1024 × 500 Google Play feature graphic.
- `source/icon-1024.png`: copy of the current app icon used for this pack.

The app icon remains unchanged. The Google Play export uses the same artwork and
adds the required 32-bit PNG channel.

## Screenshots

Screenshots are intentionally omitted while the interface is still changing.
Capture them from the signed release candidate after production content and the
final mobile layouts have passed review. Do not use development screenshots or
substitute a fake native map.

## Apple notes

`apps/mobile/app.json` currently sets `supportsTablet` to `true`, which makes an
iPad screenshot required at submission time. Plan both 6.9-inch iPhone and
13-inch iPad captures for the release candidate.

Apple does not show “What’s New in this Version” for the first app version. Use
the release notes in `LISTING-COPY.md` for Google Play 1.0.0 and keep them for the
next Apple update.

## Listing languages

`LISTING-COPY.md` contains format-ready metadata for every InfoKit language that
the stores accept:

- Apple App Store: French, English, and Arabic.
- Google Play: French, English, Arabic, Persian (`fa-IR`), Dari using Google’s
  Persian (Afghanistan) locale (`fa-AF`), and Amharic (`am`).

Pashto, Sorani Kurdish, Tigrinya, Afaan Oromo, and Somali are not manual listing
locales in either store. They remain available inside the app and use the
primary store listing or the store’s available fallback behaviour.

This support matrix was checked on 30 July 2026 against Apple’s
[App Store localizations](https://developer.apple.com/help/app-store-connect/reference/app-information/app-store-localizations)
and Google’s
[Play Console localization list](https://support.google.com/googleplay/android-developer/answer/9844778?hl=en).

The Persian, Dari, and Amharic drafts reuse vocabulary from the app catalog.
Have fluent speakers review all translated store copy in its final Play Console
preview before publishing.

## Source and generation

The feature graphic is deterministic SVG artwork built from the app’s semantic
tokens. It avoids synthetic people, invented places, and unverified service
claims. The image-generation skill guided the asset choice; direct vector
composition kept the store artwork faithful to the existing brand.
