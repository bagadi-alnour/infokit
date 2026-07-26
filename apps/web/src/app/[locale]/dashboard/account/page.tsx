import { loadPageCatalog } from "@infokit/shared/i18n/catalogs";
import { eq } from "drizzle-orm";

import { updateAccountProfile } from "./actions";
import { AccountStatus } from "./parts";
import {
  Card,
  Field,
  ReadOnlyField,
  TextInput,
} from "~/components/admin/workspace";
import { PendingButton } from "~/components/pending-button";
import { requireRouteLocale } from "~/i18n/route-locale";
import { requireEditor } from "~/server/auth/require";
import { db } from "~/server/db";
import { users } from "~/server/db/schema";

export default async function AccountProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string; error?: string }>;
}) {
  const locale = requireRouteLocale((await params).locale);
  const user = await requireEditor(locale);
  const query = await searchParams;
  const messages = await loadPageCatalog(locale, "dashboard-account");
  const [account] = await db
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  return (
    <div className="grid gap-5">
      <AccountStatus
        status={query.status}
        error={query.error}
        savedLabel={messages["account.status.saved"]}
        errorLabels={{ invalid: messages["account.status.error"] }}
      />
      <Card title={messages["profile.heading"]} hint={messages["profile.hint"]}>
        <form action={updateAccountProfile} className="grid max-w-md gap-4">
          <input type="hidden" name="locale" value={locale} />
          <Field
            label={messages["profile.name"]}
            hint={messages["profile.nameHint"]}
          >
            <TextInput
              name="displayName"
              defaultValue={account?.name ?? ""}
              autoComplete="name"
              maxLength={255}
              required
            />
          </Field>
          {/* The sign-in address is the identity itself: changing it would move
           * every session, audit line and membership with it, so it is read
           * here and changed by a platform administrator. */}
          <ReadOnlyField
            label={messages["profile.email"]}
            value={account?.email ?? user.email}
            dir="ltr"
          />
          <p className="text-copy-muted text-xs">
            {messages["profile.emailHint"]}
          </p>
          <div>
            <PendingButton>{messages["account.save"]}</PendingButton>
          </div>
        </form>
      </Card>
    </div>
  );
}
