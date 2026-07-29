import { fromNodeProviderChain } from "@aws-sdk/credential-providers";

import { env } from "~/env";

type CredentialProvider = ReturnType<typeof fromNodeProviderChain>;

/**
 * The primary identity: object storage, and messaging unless
 * `messagingCredentials` finds a second one.
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

/**
 * Credentials for SES and SNS, which may belong to a different AWS account from
 * the one holding the asset bucket.
 *
 * Sandbox exit is granted per account and is not inherited from an AWS
 * Organization, so a fresh account can own the database and the bucket while
 * email and SMS still have to leave from an account that has already been
 * approved to reach unverified recipients.
 *
 * Falling back to `awsCredentials` is the point rather than a convenience: the
 * split lives entirely in two environment variables, so the day the primary
 * account is approved, deleting them collapses everything back to one identity
 * with no deployment of new code. Nothing here reads `AWS_SESSION_TOKEN` — a
 * borrowed identity is a long-lived IAM user in another account, not a session.
 */
export function messagingCredentials(): CredentialProvider {
  if (env.AWS_MESSAGING_ACCESS_KEY_ID && env.AWS_MESSAGING_SECRET_ACCESS_KEY) {
    const identity = {
      accessKeyId: env.AWS_MESSAGING_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_MESSAGING_SECRET_ACCESS_KEY,
    };
    return () => Promise.resolve(identity);
  }
  return awsCredentials();
}

/**
 * Where SES and SNS are called. A borrowed account keeps its own verified
 * identity and registered sender ID, and those are regional, so the region has
 * to travel with the credentials rather than being assumed from the bucket's.
 */
export function messagingRegion(): string {
  return env.AWS_MESSAGING_REGION ?? env.AWS_REGION;
}
