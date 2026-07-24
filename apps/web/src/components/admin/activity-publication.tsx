"use client";

import type { Locale } from "@calais/shared/i18n";
import { CalendarClock, Globe } from "lucide-react";
import { toast } from "sonner";

import {
  publishActivityLanguage,
  unpublishActivityLanguage,
} from "~/app/[locale]/dashboard/activities/actions";
import { useActionErrorToast } from "~/components/admin/admin-ui-provider";
import { SchedulePublicationDialog } from "~/components/admin/schedule-publication-dialog";
import { PendingButton } from "~/components/pending-button";
import { Badge } from "~/components/ui/badge";
import type { EditorialLanguage } from "~/lib/editorial-languages";

type LanguagePublication = {
  code: EditorialLanguage;
  title: string | null;
  publishedAt: string | null;
  scheduledFor: string | null;
};

export function ActivityPublication({
  locale,
  activityId,
  languages,
  labels,
}: {
  locale: string;
  activityId: string;
  languages: LanguagePublication[];
  labels: Record<string, string>;
}) {
  const showActionError = useActionErrorToast();
  const publish = async (formData: FormData) => {
    try {
      await publishActivityLanguage(formData);
      toast.success(
        formData.get("publishAt")
          ? labels["toast.scheduled"]
          : labels["toast.published"],
      );
    } catch (error) {
      showActionError(
        error,
        labels["toast.publishError"] ?? "Could not publish",
      );
    }
  };
  const unpublish = async (formData: FormData) => {
    try {
      await unpublishActivityLanguage(formData);
      toast.success(labels["toast.unpublished"]);
    } catch (error) {
      showActionError(
        error,
        labels["toast.actionError"] ?? "Something went wrong",
      );
    }
  };

  return (
    <ul className="grid gap-3">
      {languages.map((language) => (
        <ActivityLanguagePublication
          key={language.code}
          locale={locale}
          activityId={activityId}
          language={language}
          labels={labels}
          publish={publish}
          unpublish={unpublish}
        />
      ))}
    </ul>
  );
}

function ActivityLanguagePublication({
  locale,
  activityId,
  language,
  labels,
  publish,
  unpublish,
}: {
  locale: string;
  activityId: string;
  language: LanguagePublication;
  labels: Record<string, string>;
  publish: (formData: FormData) => Promise<void>;
  unpublish: (formData: FormData) => Promise<void>;
}) {
  const authored = Boolean(language.title);
  const published = Boolean(language.publishedAt);
  const scheduled = Boolean(language.scheduledFor);

  return (
    <li className="border-line grid gap-3 border-b py-4 first:pt-0 last:border-b-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">
          {labels[`language.${language.code}`]}
        </span>
        <Badge
          variant={published ? "default" : scheduled ? "secondary" : "outline"}
        >
          {published
            ? labels["state.published"]
            : scheduled
              ? labels["state.scheduled"]
              : labels["state.draft"]}
        </Badge>
      </div>
      {language.scheduledFor ? (
        <p className="text-brand flex items-center gap-1.5 text-xs font-medium tabular-nums">
          <CalendarClock className="size-3.5" aria-hidden />
          {labels["publication.scheduledFor"]}: {language.scheduledFor}
        </p>
      ) : language.publishedAt ? (
        <p className="text-success text-xs font-medium tabular-nums">
          {labels["publication.publishedAt"]}: {language.publishedAt}
        </p>
      ) : null}
      {published || scheduled ? (
        <form action={unpublish}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="activityId" value={activityId} />
          <input type="hidden" name="languageCode" value={language.code} />
          <PendingButton variant="ghost" className="text-danger w-full">
            {scheduled
              ? labels["publication.cancelSchedule"]
              : labels["publication.unpublish"]}
          </PendingButton>
        </form>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <form action={publish}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="activityId" value={activityId} />
            <input type="hidden" name="languageCode" value={language.code} />
            <PendingButton
              variant="secondary"
              className="min-h-10 w-full min-w-0 whitespace-normal"
              disabled={!authored}
            >
              <Globe aria-hidden />
              {labels["publication.now"]}
            </PendingButton>
          </form>
          <SchedulePublicationDialog
            locale={locale as Locale}
            fields={{
              locale,
              activityId,
              languageCode: language.code,
            }}
            action={publishActivityLanguage}
            disabled={!authored}
            labels={labels}
          />
        </div>
      )}
    </li>
  );
}
