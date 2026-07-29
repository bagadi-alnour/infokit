# Store credentials

Nothing in this directory is committed except this file. The two credentials
below are **account-level** — the same Apple team and the same Google Play
developer account already serve `ep-nextjs`, so neither has to be created again
for InfoKit.

## App Store Connect API key

Copy the key from the other repo:

    cp ../../../EP-next/apps/mobile/credentials/AuthKey_GFSKBQBNMK.p8 .

`submit.*.ios.ascApiKeyPath` in `eas.json` expects exactly that filename. The
key id (`GFSKBQBNMK`) and issuer id are identifiers, not secrets, and live in
`eas.json`; the `.p8` is the secret and is gitignored.

## Google Play service account

    cp ../../../EP-next/apps/mobile/credentials/google-play-service-account.json .

The service account itself is reused, but Play Console permissions are granted
per app: in **Users and permissions**, find the service-account email and add
InfoKit under App permissions with _Release to testing tracks_ and _Release apps
to production_. Until that grant exists, `eas submit` fails with a 403.

## GitHub Actions

CI never reads this directory — it rebuilds both files from repository secrets.
Copy the values across from the `ep-nextjs` repository settings:

| Secret                                    | Holds                              |
| ----------------------------------------- | ---------------------------------- |
| `EXPO_TOKEN`                              | Expo robot access token            |
| `APPLE_ASC_API_KEY_BASE64`                | base64 of `AuthKey_GFSKBQBNMK.p8`  |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_BASE64` | base64 of the service-account JSON |

To produce the base64 yourself instead of copying the existing secret:

    base64 -i AuthKey_GFSKBQBNMK.p8 | pbcopy

## The first Android upload is manual

Google's API cannot create a package that has no release, so the very first
`.aab` for `org.infokit.app` must be uploaded by hand in Play Console. Run the
release workflow for Android, download the artefact from the EAS build page,
upload it to the internal track once, and every submission after that is
automated.
