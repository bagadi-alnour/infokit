import { fromNodeProviderChain } from "@aws-sdk/credential-providers";

import { env } from "~/env";

type CredentialProvider = ReturnType<typeof fromNodeProviderChain>;

/**
 * Credentials for every AWS client in the app (SES, SNS, S3).
 *
 * Precedence:
 *  1. Explicit `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` — set in `.env`
 *     locally and injected as secrets in deployment.
 *  2. `AWS_PROFILE`, when a named profile is pinned.
 *  3. The standard AWS chain — default profile locally, task role in production.
 *
 * A profile is deliberately not hard-coded: pinning one that is absent from
 * ~/.aws/credentials fails every send at credential resolution, before SES or
 * SNS is ever contacted.
 */
export function awsCredentials(): CredentialProvider {
  if (env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY) {
    const identity = {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      ...(env.AWS_SESSION_TOKEN ? { sessionToken: env.AWS_SESSION_TOKEN } : {}),
    };
    return () => Promise.resolve(identity);
  }
  return fromNodeProviderChain(
    env.AWS_PROFILE ? { profile: env.AWS_PROFILE } : {},
  );
}
