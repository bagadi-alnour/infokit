/**
 * The locale resolved by middleware for server-rendered fallback screens.
 * Next.js does not pass route params to not-found components, so the request
 * header preserves the selected URL locale without sending it to the browser.
 */
export const PUBLIC_LOCALE_HEADER = "x-infokit-public-locale";
