/**
 * Everything about this app lives in `app.json`. This file exists for one value.
 *
 * The Google Maps Android key is compiled into the APK, so it is never truly
 * secret — Google's protection is the key's own restrictions, not concealment.
 * But this repository is public, and a key sitting in a public tree is scraped
 * within hours; holding it in an EAS environment variable means the scrape finds
 * nothing, and the restrictions stay the only thing standing between a stolen
 * key and a bill on a real card.
 *
 * iOS needs nothing here. `react-native-maps` draws on Apple Maps, which has no
 * key, no quota and no billing account.
 */

/** @param {{ config: import('expo/config').ExpoConfig }} param0 */
module.exports = ({ config }) => {
  const apiKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY?.trim();

  // A missing key is normal on a laptop and wrong in a release, so it warns
  // rather than throwing: the map tab goes grey on Android, everything else in
  // the app still builds and runs.
  if (!apiKey) {
    console.warn(
      "GOOGLE_MAPS_ANDROID_API_KEY is not set — the Android map will render blank tiles.",
    );
    return config;
  }

  return {
    ...config,
    android: {
      ...config.android,
      config: {
        ...config.android?.config,
        googleMaps: { apiKey },
      },
    },
  };
};
