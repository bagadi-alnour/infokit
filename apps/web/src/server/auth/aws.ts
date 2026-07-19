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
