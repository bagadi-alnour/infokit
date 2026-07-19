import type { Locale } from "@calais/shared/i18n";
import { redirect } from "next/navigation";

import { getActionLocale } from "~/i18n/request-locale";
import { authPath } from "~/i18n/routing";
import { auth } from "~/server/auth";

/**
 * Server-side auth gate — call it at the top of every protected layout and
 * server action (defense in depth, RISKS.md R10).
 */
export async function requireEditor(candidateLocale?: Locale) {
  const locale = await getActionLocale(candidateLocale);
  const session = await auth();
  if (!session?.user) redirect(authPath("login", locale));
  if (!session.secondFactorVerified) redirect(authPath("verify", locale));
  return session.user;
}

export function protectedEditorAction<Result>(
  action: (formData: FormData, locale: Locale) => Promise<Result>,
): (formData: FormData) => Promise<Result> {
  return async (formData) => {
    const locale = await getActionLocale(formData.get("locale"));
    await requireEditor(locale);
    return action(formData, locale);
  };
}
