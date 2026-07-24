import { SendEmailCommand, SESv2Client } from "@aws-sdk/client-sesv2";
import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import { fromIni } from "@aws-sdk/credential-providers";
import {
  formatMessage,
  localeMetadata,
  type Locale,
} from "@calais/shared/i18n";
import { loadCatalog } from "@calais/shared/i18n/catalogs";

import { env } from "~/env";
import type { EditorialLanguage } from "~/lib/editorial-languages";
import { editorRecipient } from "./editors";

const credentials = fromIni({ profile: env.AWS_PROFILE });
const ses = new SESv2Client({ region: env.AWS_REGION, credentials });
const sns = new SNSClient({ region: env.AWS_REGION, credentials });

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
  // Auth.js still completes the generic verification-request response for an
  // unapproved address, but no recipient data leaves this process.
  if (!editorRecipient(email)) return;
  if (env.AUTH_DEV_LOG_DELIVERY) {
    console.warn(`\n[auth:dev] Magic link for ${email}:\n${url}\n`);
    return;
  }
  if (!env.AUTH_EMAIL_FROM) {
    throw new Error(
      "AUTH_EMAIL_FROM must be configured before an editor can sign in",
    );
  }

  const messages = await loadCatalog(locale, "auth-delivery");
  const safeUrl = escapeHtml(url);
  const { direction } = localeMetadata[locale];
  const text = `${messages["auth.email.heading"]}\n\n${messages["auth.email.body"]}\n${url}\n\n${messages["auth.email.ignore"]}`;
  const html = `<section lang="${locale}" dir="${direction}"><h1>${escapeHtml(messages["auth.email.heading"])}</h1><p>${escapeHtml(messages["auth.email.body"])}</p><p><a href="${safeUrl}">${escapeHtml(messages["auth.email.action"])}</a></p><p>${escapeHtml(messages["auth.email.ignore"])}</p></section>`;

  await ses.send(
    new SendEmailCommand({
      FromEmailAddress: env.AUTH_EMAIL_FROM,
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
  if (env.AUTH_DEV_LOG_DELIVERY) {
    console.warn(`\n[auth:dev] Password reset for ${email}:\n${url}\n`);
    return;
  }
  if (!env.AUTH_EMAIL_FROM) {
    throw new Error(
      "AUTH_EMAIL_FROM must be configured before password resets can be sent",
    );
  }

  const messages = await loadCatalog(locale, "auth-delivery");
  const safeUrl = escapeHtml(url);
  const { direction } = localeMetadata[locale];
  const text = `${messages["auth.reset.heading"]}\n\n${messages["auth.reset.body"]}\n${url}\n\n${messages["auth.reset.ignore"]}`;
  const html = `<section lang="${locale}" dir="${direction}"><h1>${escapeHtml(messages["auth.reset.heading"])}</h1><p>${escapeHtml(messages["auth.reset.body"])}</p><p><a href="${safeUrl}">${escapeHtml(messages["auth.reset.action"])}</a></p><p>${escapeHtml(messages["auth.reset.ignore"])}</p></section>`;

  await ses.send(
    new SendEmailCommand({
      FromEmailAddress: env.AUTH_EMAIL_FROM,
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
}

/**
 * Team invitation for a person who may not have an account yet. Sent only on
 * an admin-initiated action inside the workspace — never from a public form —
 * so it does not go through the sign-in anti-enumeration gate.
 */
export async function sendInvitationEmail({
  email,
  url,
  locale,
  organizationName,
  teamName,
  inviterName,
  expiresAt,
}: {
  email: string;
  url: string;
  locale: Locale;
  organizationName: string;
  teamName: string;
  inviterName: string;
  expiresAt: Date;
}) {
  if (env.AUTH_DEV_LOG_DELIVERY) {
    console.warn(
      `\n[auth:dev] Invitation for ${email} to ${organizationName} / ${teamName} (by ${inviterName}):\n${url}\n`,
    );
    return;
  }
  if (!env.AUTH_EMAIL_FROM) {
    throw new Error(
      "AUTH_EMAIL_FROM must be configured before invitations can be sent",
    );
  }

  const messages = await loadCatalog(locale, "auth-delivery");
  const { direction } = localeMetadata[locale];
  const values = {
    organization: organizationName,
    team: teamName,
    inviter: inviterName,
  };
  const heading = formatMessage(messages["invite.heading"], values);
  const body = formatMessage(messages["invite.body"], values);
  const expires = formatMessage(messages["invite.expires"], {
    date: new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(
      expiresAt,
    ),
  });
  const safeUrl = escapeHtml(url);
  const text = `${heading}\n\n${body}\n${url}\n\n${expires}\n${messages["invite.ignore"]}`;
  const html = `<section lang="${locale}" dir="${direction}"><h1>${escapeHtml(heading)}</h1><p>${escapeHtml(body)}</p><p><a href="${safeUrl}">${escapeHtml(messages["invite.action"])}</a></p><p>${escapeHtml(expires)}</p><p>${escapeHtml(messages["invite.ignore"])}</p></section>`;

  await ses.send(
    new SendEmailCommand({
      FromEmailAddress: env.AUTH_EMAIL_FROM,
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
}

/** One-item, one-language external translator assignment. */
export async function sendTranslationAssignmentEmail({
  email,
  url,
  locale,
  language,
  senderName,
  expiresAt,
}: {
  email: string;
  url: string;
  locale: Locale;
  language: EditorialLanguage;
  senderName: string;
  expiresAt: Date;
}) {
  if (env.AUTH_DEV_LOG_DELIVERY) {
    console.warn(
      `\n[translation:dev] ${language} assignment for ${email} (by ${senderName}):\n${url}\n`,
    );
    return;
  }
  if (!env.AUTH_EMAIL_FROM) {
    throw new Error(
      "AUTH_EMAIL_FROM must be configured before translation assignments can be sent",
    );
  }

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

  await ses.send(
    new SendEmailCommand({
      FromEmailAddress: env.AUTH_EMAIL_FROM,
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
}

export async function sendSmsCode({
  phone,
  code,
  locale,
}: {
  phone: string;
  code: string;
  locale: Locale;
}) {
  if (env.AUTH_DEV_LOG_DELIVERY) {
    console.warn(`\n[auth:dev] SMS code for ${phone}: ${code}\n`);
    return;
  }
  const messages = await loadCatalog(locale, "auth-delivery");
  await sns.send(
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
}
