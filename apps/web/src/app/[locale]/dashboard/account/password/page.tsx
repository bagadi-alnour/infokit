import { loadCatalog, loadPageCatalog } from "@infokit/shared/i18n/catalogs";
import { eq } from "drizzle-orm";

import { updatePassword } from "../../../login/actions";
import { Card, Field, TextInput } from "~/components/admin/workspace";
import { PendingButton } from "~/components/pending-button";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { requireRouteLocale } from "~/i18n/route-locale";
import { requireEditor } from "~/server/auth/require";
import { db } from "~/server/db";
import { users } from "~/server/db/schema";

/**
 * Password sign-in, on its own route: the reset link the sign-in flow sends
 * lands here (`?reset=1`), and the sentences it needs are the ones the auth
 * pages already speak, so this section reads the `login` catalogue.
 */
export default async function AccountPasswordPage({
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
  const [messages, auth] = await Promise.all([
    loadPageCatalog(locale, "dashboard-account"),
    loadCatalog(locale, "login"),
  ]);
  const [account] = await db
    .select({ passwordUpdatedAt: users.passwordUpdatedAt })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  return (
    <div className="grid gap-5">
      <Card
        title={
          isReset
            ? auth["auth.account.resetHeading"]
            : auth["auth.account.passwordHeading"]
        }
        hint={messages["password.hint"]}
      >
        <form action={updatePassword} className="grid max-w-md gap-4">
          <input type="hidden" name="locale" value={locale} />
          {isReset && query.status !== "updated" ? (
            <Alert>
              <AlertDescription>
                {auth["auth.account.resetNotice"]}
              </AlertDescription>
            </Alert>
          ) : null}
          {query.status === "updated" ? (
            <Alert>
              <AlertDescription>
                {auth["auth.account.updated"]}
              </AlertDescription>
            </Alert>
          ) : null}
          {query.error ? (
            <Alert variant="destructive">
              <AlertDescription>{auth["auth.account.error"]}</AlertDescription>
            </Alert>
          ) : null}
          <p className="text-copy-muted text-sm">
            {account?.passwordUpdatedAt
              ? auth["auth.account.passwordExists"]
              : auth["auth.account.passwordMissing"]}
          </p>
          <Field
            label={auth["auth.account.passwordLabel"]}
            hint={auth["auth.account.passwordHint"]}
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
          <Field label={auth["auth.account.passwordConfirmationLabel"]}>
            <TextInput
              name="passwordConfirmation"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
            />
          </Field>
          <div>
            <PendingButton>{auth["auth.account.passwordSubmit"]}</PendingButton>
          </div>
        </form>
      </Card>
    </div>
  );
}
