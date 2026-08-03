import { toNextJsHandler } from "better-auth/next-js";

import { authServer } from "~/server/auth";

/**
 * Better Auth's own endpoints: sign-in, sign-out, the magic-link callback, the
 * second-factor challenges, password reset. The catch-all segment is `[...all]`
 * because that is the path Better Auth's clients — the browser's and the phone
 * app's — are built to call.
 */
export const { GET, POST } = toNextJsHandler(authServer);
