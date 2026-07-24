import { loadPageCatalog } from "@calais/shared/i18n/catalogs";
import { eq } from "drizzle-orm";

import { updatePassword } from "../../login/actions";
import {
  Button,
  Card,
  Field,
  PageHeader,
  TextInput,
} from "~/components/admin/workspace";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { requireRouteLocale } from "~/i18n/route-locale";
import { requireEditor } from "~/server/auth/require";
import { db } from "~/server/db";
import { users } from "~/server/db/schema";

export default async function AccountSecurityPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string; status?: string; reset?: string }>;
}) {
  const locale = requireRouteLocale((await params).locale);
  const user = await requireEditor(locale);
  const query = await searchParams;
  const isReset = query.reset === "1";
  const messages = await loadPageCatalog(locale, "login");
  const [account] = await db
    .select({ passwordUpdatedAt: users.passwordUpdatedAt })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 md:px-6">
      <PageHeader
        title={messages["auth.account.title"]}
        sub={messages["auth.account.description"]}
      />
      <Card
        title={
          isReset
            ? messages["auth.account.resetHeading"]
            : messages["auth.account.passwordHeading"]
        }
      >
        <form action={updatePassword} className="max-w-md space-y-4">
          <input type="hidden" name="locale" value={locale} />
          {isReset && query.status !== "updated" ? (
            <Alert>
              <AlertDescription>
                {messages["auth.account.resetNotice"]}
              </AlertDescription>
            </Alert>
          ) : null}
          {query.status === "updated" ? (
            <Alert>
              <AlertDescription>
                {messages["auth.account.updated"]}
              </AlertDescription>
            </Alert>
          ) : null}
          {query.error ? (
            <Alert variant="destructive">
              <AlertDescription>
                {messages["auth.account.error"]}
              </AlertDescription>
            </Alert>
          ) : null}
          <p className="text-copy-muted text-sm">
            {account?.passwordUpdatedAt
              ? messages["auth.account.passwordExists"]
              : messages["auth.account.passwordMissing"]}
          </p>
          <Field
            label={messages["auth.account.passwordLabel"]}
            hint={messages["auth.account.passwordHint"]}
          >
            <TextInput
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
            />
          </Field>
          <Field label={messages["auth.account.passwordConfirmationLabel"]}>
            <TextInput
              name="passwordConfirmation"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
            />
          </Field>
          <Button>{messages["auth.account.passwordSubmit"]}</Button>
        </form>
      </Card>
    </main>
  );
}
