import { SendEmailCommand, SESv2Client } from "@aws-sdk/client-sesv2";
import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import {
  formatMessage,
  localeMetadata,
  type Locale,
} from "@infokit/shared/i18n";
import { loadCatalog } from "@infokit/shared/i18n/catalogs";

import { env } from "~/env";
import type { EditorialLanguage } from "~/lib/editorial-languages";
// Imported from the file rather than from `~/server/audit`, whose index reaches
// the session — and the session's configuration imports this module.
import {
  recordDelivery,
  trackDelivery,
  type DeliveryInput,
} from "~/server/audit/deliveries";
// `import type` only, for the same reason: it is erased at build time, so it
// adds no runtime edge to `record`, which does reach the session.
import type { AuditEventRef } from "~/server/audit/record";
import {
  messagingCredentials,
  messagingRegion,
} from "~/server/aws-credentials";
import { canSignIn } from "./eligibility";

// Messaging may leave from a different AWS account than the asset bucket, and
// the region travels with the credentials because a verified sending identity
// and a registered sender ID are both regional. See `~/server/aws-credentials`.
const credentials = messagingCredentials();
const region = messagingRegion();
const ses = new SESv2Client({ region, credentials });
const sns = new SNSClient({ region, credentials });

/**
 * What the ledger needs to know about a message before anyone tries to send it,
 * so the same facts describe the send, the skip and the failure.
 */
type LedgerFacts = Pick<
  DeliveryInput,
  | "channel"
  | "template"
  | "recipient"
  | "locale"
  | "userId"
  | "organizationId"
  | "auditEvent"
>;

/**
 * A deliberate non-send, written down as one. Development logs the link to the
 * console instead of sending, and the sign-in gate answers unknown addresses
 * exactly as it answers known ones — both leave the console showing "we sent
 * it", and only the ledger can say which of the two actually happened.
 */
function recordSkip(facts: LedgerFacts, errorCode: string): Promise<void> {
  return recordDelivery({
    ...facts,
    status: "skipped",
    provider: errorCode === "dev_log_transport" ? "dev-log" : null,
    errorCode,
  });
}

/**
 * The verified From address, or a failure nobody has to guess at. A deployment
 * that never configured it breaks every sign-in silently at the SES call; this
 * way the ledger names the reason next to the recipient who did not receive it.
 */
async function senderAddress(
  facts: LedgerFacts,
  message: string,
): Promise<string> {
  if (env.AUTH_EMAIL_FROM) return env.AUTH_EMAIL_FROM;
  await recordDelivery({
    ...facts,
    status: "failed",
    errorCode: "email_from_missing",
  });
  throw new Error(message);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return entities[character] ?? character;
  });
}

export async function sendMagicLinkEmail({
  email,
  url,
  locale,
}: {
  email: string;
  url: string;
  locale: Locale;
}) {
  const facts: LedgerFacts = {
    channel: "email",
    template: "auth.magic_link",
    recipient: email,
    locale,
  };
  // Auth.js still completes the generic verification-request response for an
  // address the database does not know, but no recipient data leaves this
  // process.
  if (!(await canSignIn(email))) {
    await recordSkip(facts, "recipient_not_eligible");
    return;
  }
  if (env.AUTH_DEV_LOG_DELIVERY) {
    console.warn(`\n[auth:dev] Magic link for ${email}:\n${url}\n`);
    await recordSkip(facts, "dev_log_transport");
    return;
  }
  const from = await senderAddress(
    facts,
    "AUTH_EMAIL_FROM must be configured before an editor can sign in",
  );

  const messages = await loadCatalog(locale, "auth-delivery");
  const safeUrl = escapeHtml(url);
  const { direction } = localeMetadata[locale];
  const text = `${messages["auth.email.heading"]}\n\n${messages["auth.email.body"]}\n${url}\n\n${messages["auth.email.ignore"]}`;
  const html = `<section lang="${locale}" dir="${direction}"><h1>${escapeHtml(messages["auth.email.heading"])}</h1><p>${escapeHtml(messages["auth.email.body"])}</p><p><a href="${safeUrl}">${escapeHtml(messages["auth.email.action"])}</a></p><p>${escapeHtml(messages["auth.email.ignore"])}</p></section>`;

  await trackDelivery(facts, async () => {
    const sent = await ses.send(
      new SendEmailCommand({
        FromEmailAddress: from,
        Destination: { ToAddresses: [email] },
        Content: {
          Simple: {
            Subject: {
              Charset: "UTF-8",
              Data: messages["auth.email.subject"],
            },
            Body: {
              Text: { Charset: "UTF-8", Data: text },
              Html: { Charset: "UTF-8", Data: html },
            },
          },
        },
      }),
    );
    return { provider: "ses", providerMessageId: sent.MessageId };
  });
}

export async function sendPasswordResetEmail({
  email,
  url,
  locale,
}: {
  email: string;
  url: string;
  locale: Locale;
}) {
  const facts: LedgerFacts = {
    channel: "email",
    template: "auth.password_reset",
    recipient: email,
    locale,
  };
  if (env.AUTH_DEV_LOG_DELIVERY) {
    console.warn(`\n[auth:dev] Password reset for ${email}:\n${url}\n`);
    await recordSkip(facts, "dev_log_transport");
    return;
  }
  const from = await senderAddress(
    facts,
    "AUTH_EMAIL_FROM must be configured before password resets can be sent",
  );

  const messages = await loadCatalog(locale, "auth-delivery");
  const safeUrl = escapeHtml(url);
  const { direction } = localeMetadata[locale];
  const text = `${messages["auth.reset.heading"]}\n\n${messages["auth.reset.body"]}\n${url}\n\n${messages["auth.reset.ignore"]}`;
  const html = `<section lang="${locale}" dir="${direction}"><h1>${escapeHtml(messages["auth.reset.heading"])}</h1><p>${escapeHtml(messages["auth.reset.body"])}</p><p><a href="${safeUrl}">${escapeHtml(messages["auth.reset.action"])}</a></p><p>${escapeHtml(messages["auth.reset.ignore"])}</p></section>`;

  await trackDelivery(facts, async () => {
    const sent = await ses.send(
      new SendEmailCommand({
        FromEmailAddress: from,
        Destination: { ToAddresses: [email] },
        Content: {
          Simple: {
            Subject: {
              Charset: "UTF-8",
              Data: messages["auth.reset.subject"],
            },
            Body: {
              Text: { Charset: "UTF-8", Data: text },
              Html: { Charset: "UTF-8", Data: html },
            },
          },
        },
      }),
    );
    return { provider: "ses", providerMessageId: sent.MessageId };
  });
}

/**
 * Invitation for a person who may not have an account yet. Sent only on an
 * admin-initiated action inside the workspace — never from a public form — so
 * it does not go through the sign-in anti-enumeration gate.
 *
 * Without a team the invitation is an organisation one: the representative is
 * invited to the organisation itself, not to one of its city teams, and the
 * body says so instead of naming a team the person has never heard of.
 */
export async function sendInvitationEmail({
  email,
  url,
  locale,
  organizationName,
  teamName,
  inviterName,
  expiresAt,
  organizationId,
  auditEvent,
}: {
  email: string;
  url: string;
  locale: Locale;
  organizationName: string;
  teamName?: string;
  inviterName: string;
  expiresAt: Date;
  /** Null for a platform staff invitation, which belongs to no organisation. */
  organizationId?: string | null;
  /** The `member.invited` event, so the ledger row points at who invited them. */
  auditEvent?: AuditEventRef | null;
}) {
  const facts: LedgerFacts = {
    channel: "email",
    template: "invitation",
    recipient: email,
    locale,
    organizationId,
    auditEvent,
  };
  if (env.AUTH_DEV_LOG_DELIVERY) {
    console.warn(
      `\n[auth:dev] Invitation for ${email} to ${organizationName}${teamName ? ` / ${teamName}` : ""} (by ${inviterName}):\n${url}\n`,
    );
    await recordSkip(facts, "dev_log_transport");
    return;
  }
  const from = await senderAddress(
    facts,
    "AUTH_EMAIL_FROM must be configured before invitations can be sent",
  );

  const messages = await loadCatalog(locale, "auth-delivery");
  const { direction } = localeMetadata[locale];
  const values = {
    organization: organizationName,
    team: teamName ?? organizationName,
    inviter: inviterName,
  };
  const heading = formatMessage(messages["invite.heading"], values);
  const body = formatMessage(
    teamName ? messages["invite.body"] : messages["invite.organizationBody"],
    values,
  );
  const expires = formatMessage(messages["invite.expires"], {
    date: new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(
      expiresAt,
    ),
  });
  const action = teamName
    ? messages["invite.action"]
    : messages["invite.organizationAction"];
  const safeUrl = escapeHtml(url);
  const text = `${heading}\n\n${body}\n${url}\n\n${expires}\n${messages["invite.ignore"]}`;
  const html = `<section lang="${locale}" dir="${direction}"><h1>${escapeHtml(heading)}</h1><p>${escapeHtml(body)}</p><p><a href="${safeUrl}">${escapeHtml(action)}</a></p><p>${escapeHtml(expires)}</p><p>${escapeHtml(messages["invite.ignore"])}</p></section>`;

  await trackDelivery(facts, async () => {
    const sent = await ses.send(
      new SendEmailCommand({
        FromEmailAddress: from,
        Destination: { ToAddresses: [email] },
        Content: {
          Simple: {
            Subject: {
              Charset: "UTF-8",
              Data: formatMessage(messages["invite.subject"], values),
            },
            Body: {
              Text: { Charset: "UTF-8", Data: text },
              Html: { Charset: "UTF-8", Data: html },
            },
          },
        },
      }),
    );
    return { provider: "ses", providerMessageId: sent.MessageId };
  });
}

/** One-item, one-language external translator assignment. */
export async function sendTranslationAssignmentEmail({
  email,
  url,
  locale,
  language,
  senderName,
  expiresAt,
  organizationId,
}: {
  email: string;
  url: string;
  locale: Locale;
  language: EditorialLanguage;
  senderName: string;
  expiresAt: Date;
  /** Whose content is being translated, so its admins can see the send. */
  organizationId?: string | null;
}) {
  const facts: LedgerFacts = {
    channel: "email",
    template: "translation.assignment",
    recipient: email,
    locale,
    organizationId,
  };
  if (env.AUTH_DEV_LOG_DELIVERY) {
    console.warn(
      `\n[translation:dev] ${language} assignment for ${email} (by ${senderName}):\n${url}\n`,
    );
    await recordSkip(facts, "dev_log_transport");
    return;
  }
  const from = await senderAddress(
    facts,
    "AUTH_EMAIL_FROM must be configured before translation assignments can be sent",
  );

  const messages = await loadCatalog(locale, "auth-delivery");
  const { direction } = localeMetadata[locale];
  const values = {
    sender: senderName,
    language: messages[`translation.language.${language}`],
    date: new Intl.DateTimeFormat(locale, {
      dateStyle: "long",
      timeStyle: "short",
    }).format(expiresAt),
  };
  const heading = formatMessage(messages["translation.heading"], values);
  const body = formatMessage(messages["translation.body"], values);
  const expires = formatMessage(messages["translation.expires"], values);
  const safeUrl = escapeHtml(url);
  const text = `${heading}\n\n${body}\n${url}\n\n${expires}\n${messages["translation.ignore"]}`;
  const html = `<section lang="${locale}" dir="${direction}"><h1>${escapeHtml(heading)}</h1><p>${escapeHtml(body)}</p><p><a href="${safeUrl}">${escapeHtml(messages["translation.action"])}</a></p><p>${escapeHtml(expires)}</p><p>${escapeHtml(messages["translation.ignore"])}</p></section>`;

  await trackDelivery(facts, async () => {
    const sent = await ses.send(
      new SendEmailCommand({
        FromEmailAddress: from,
        Destination: { ToAddresses: [email] },
        Content: {
          Simple: {
            Subject: {
              Charset: "UTF-8",
              Data: formatMessage(messages["translation.subject"], values),
            },
            Body: {
              Text: { Charset: "UTF-8", Data: text },
              Html: { Charset: "UTF-8", Data: html },
            },
          },
        },
      }),
    );
    return { provider: "ses", providerMessageId: sent.MessageId };
  });
}

export async function sendSmsCode({
  phone,
  code,
  locale,
  userId,
}: {
  phone: string;
  code: string;
  locale: Locale;
  /** Whose step-up this is — the one lookup support needs to answer "no code?". */
  userId?: string | null;
}) {
  const facts: LedgerFacts = {
    channel: "sms",
    template: "auth.sms_code",
    recipient: phone,
    locale,
    userId,
  };
  if (env.AUTH_DEV_LOG_DELIVERY) {
    console.warn(`\n[auth:dev] SMS code for ${phone}: ${code}\n`);
    await recordSkip(facts, "dev_log_transport");
    return;
  }
  const messages = await loadCatalog(locale, "auth-delivery");
  // The ledger records that a code was sent to this number and what SNS said
  // about it. The code itself is never written down here or anywhere else.
  await trackDelivery(facts, async () => {
    const sent = await sns.send(
      new PublishCommand({
        PhoneNumber: phone,
        Message: formatMessage(messages["auth.sms.message"], { code }),
        MessageAttributes: {
          "AWS.SNS.SMS.SMSType": {
            DataType: "String",
            StringValue: "Transactional",
          },
          ...(env.AWS_SNS_SENDER_ID
            ? {
                "AWS.SNS.SMS.SenderID": {
                  DataType: "String",
                  StringValue: env.AWS_SNS_SENDER_ID,
                },
              }
            : {}),
        },
      }),
    );
    return { provider: "sns", providerMessageId: sent.MessageId };
  });
}
