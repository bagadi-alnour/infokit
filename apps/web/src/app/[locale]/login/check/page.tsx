import { loadPageCatalog } from "@infokit/shared/i18n/catalogs";
import type { Metadata } from "next";

import { AuthShell } from "~/components/auth/auth-shell";
import { ActionLink } from "~/components/public/primitives";
import { requireRouteLocale } from "~/i18n/route-locale";
import { authPath } from "~/i18n/routing";
import { localizedAuthMetadata } from "~/seo/site";

interface CheckEmailPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: CheckEmailPageProps): Promise<Metadata> {
  const locale = requireRouteLocale((await params).locale);
  const messages = await loadPageCatalog(locale, "login-check");
  return localizedAuthMetadata({
    route: "check",
    locale,
    title: messages["auth.check.title"],
    description: messages["auth.check.description"],
  });
}

export default async function CheckEmailPage({ params }: CheckEmailPageProps) {
  const locale = requireRouteLocale((await params).locale);
  const messages = await loadPageCatalog(locale, "login-check");
  return (
    <AuthShell
      locale={locale}
      pathname="/login/check"
      eyebrow={messages["auth.check.eyebrow"]}
      title={messages["auth.check.title"]}
      description={messages["auth.check.description"]}
      messages={messages}
    >
      <div className="flex flex-col gap-5">
        <p className="bg-subtle border-line text-copy-muted rounded-control border p-4 text-[0.95rem] leading-relaxed">
          {messages["auth.check.next"]}
        </p>
        <ActionLink
          href={authPath("login", locale)}
          tone="outline"
          size="block"
        >
          {messages["auth.check.back"]}
        </ActionLink>
      </div>
    </AuthShell>
  );
}
