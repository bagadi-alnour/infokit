import { IdCard } from "lucide-react";
import Link from "next/link";

/**
 * The invitation to fill in a translator profile, shown on the assignment the
 * link opened.
 *
 * Sending content to a translator *is* the invitation: the session that lets
 * them work on this one item also lets them say which languages they work in
 * and what they can do. Render it only when the assignment names a directory
 * entry — a link mailed to a typed address has no row to write to, and the
 * profile page would only be able to explain that.
 */
export function TranslatorProfileInvitation({
  locale,
  labels,
}: {
  locale: string;
  labels: Record<string, string>;
}) {
  return (
    <Link
      href={`/${locale}/translate/profile`}
      className="border-line hover:border-line-strong bg-subtle mb-5 flex items-start gap-3 rounded-lg border p-3 text-sm transition-colors"
    >
      <span className="bg-brand-soft text-brand flex size-9 shrink-0 items-center justify-center rounded-lg">
        <IdCard className="size-4" aria-hidden />
      </span>
      <span>
        <span className="text-brand block font-medium">
          {labels["translator.profile.open"]}
        </span>
        <span className="text-copy-muted mt-0.5 block">
          {labels["translator.profile.openHint"]}
        </span>
      </span>
    </Link>
  );
}
