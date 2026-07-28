"use client";

import { formatMessage } from "@infokit/shared/i18n";
import {
  BadgeCheck,
  CalendarClock,
  CalendarX,
  EyeOff,
  Globe,
  MailPlus,
  MoreHorizontal,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  decideLanguageReview,
  requestLanguageReview,
} from "~/app/[locale]/dashboard/review-actions";
import { useActionErrorToast } from "~/components/admin/admin-ui-provider";
import { TranslationRequestDialog } from "~/components/admin/language-publication";
import { SchedulePublicationDialog } from "~/components/admin/schedule-publication-dialog";
import { PendingButton } from "~/components/pending-button";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Field, FieldDescription, FieldLabel } from "~/components/ui/field";
import { Textarea } from "~/components/ui/textarea";
import type { EditorialLanguage } from "~/lib/editorial-languages";
import type {
  LanguageReviewStage,
  ReviewEntityKind,
} from "~/lib/language-review";
import type { Locale } from "@infokit/shared/i18n";

/**
 * Everything one language can be asked to do, in one menu.
 *
 * The order is the life of a language: write it (generate, or hand it to a
 * translator), have it read (a colleague, then the platform), then publish it.
 * Nothing here is a permission check — every item re-checks on the server, and
 * an item that is only ever refused is not offered at all.
 */

type Labels = Record<string, string>;
type Action = (formData: FormData) => Promise<void>;

/** Which record the menu acts on, and where the answer lands. */
export interface LanguageMenuTarget {
  entityKind: ReviewEntityKind;
  /** Absent on a creation form: nothing has an id to act on yet. */
  entityId?: string;
  /** The hidden field the record posts as: `entryId`, `activityId`. */
  ownerField: string;
  locale: string;
  /** Dashboard path to revalidate after a review moves. */
  returnPath?: string;
}

/** What this actor is allowed to reach for. */
export interface LanguageMenuAbilities {
  /** False when the deployment has no translation provider configured. */
  aiEnabled: boolean;
  canPublish: boolean;
  /** Holds the entity's own review grant: may validate as a colleague. */
  canTeamValidate: boolean;
  /** Holds the platform's verify grant: may clear a language for the public. */
  canPlatformVerify: boolean;
  /** May hand a language to an outside translator. */
  canInvite: boolean;
  /** The edit page only: inviting someone to work on a saved record. */
  canGiveAccess: boolean;
}

/** How this one language stands, right now, on screen and in the database. */
export interface LanguageMenuState {
  code: EditorialLanguage;
  isSource: boolean;
  /** Something is written in this language in the form as it stands. */
  hasText: boolean;
  /** A row for this language exists server-side. */
  saved: boolean;
  /** The form holds edits this language's saved row does not. */
  dirty: boolean;
  published: boolean;
  scheduled: boolean;
  reviewStage: LanguageReviewStage;
  /** Shown to a translator being asked to quote for the work. */
  wordCount?: number;
}

export interface LanguageMenuActions {
  /** Fill this language from the source with the machine. */
  generate?: () => void;
  /** Email an outside translator a one-off link. */
  requestTranslation?: Action;
  /** Publish now, and — with `publishAt` — schedule. */
  publish?: Action;
  unpublish?: Action;
}

type OpenDialog =
  | { kind: "request" }
  | { kind: "access" }
  | { kind: "schedule" }
  | { kind: "review"; stage: "team" | "platform" }
  | { kind: "decide"; decision: "team_validated" | "platform_verified" }
  | { kind: "changes" };

export function LanguageActionsMenu({
  target,
  abilities,
  state,
  actions,
  labels,
  disabled = false,
}: {
  target: LanguageMenuTarget;
  abilities: LanguageMenuAbilities;
  state: LanguageMenuState;
  actions: LanguageMenuActions;
  labels: Labels;
  /** An archived record answers every one of these with an error. */
  disabled?: boolean;
}) {
  const [dialog, setDialog] = useState<OpenDialog | null>(null);
  const [pending, startTransition] = useTransition();
  const showActionError = useActionErrorToast();
  const hintId = useId();
  const dirtyHintId = `${hintId}-unsaved`;
  const publishHintId = `${hintId}-publish`;
  const languageName = labels[`language.${state.code}`] ?? state.code;
  const copy = (key: string) => labels[key] ?? key;

  const saved = state.saved && Boolean(target.entityId);
  const live = state.published || state.scheduled;
  /** Nothing has been written here, so there is nothing to do to it yet. */
  const actionable = saved && state.hasText && !disabled;
  const cleared = state.reviewStage === "platform_verified";
  /**
   * Whoever holds the platform's grant is the check the gate waits for, so they
   * are never told to wait for it — the server agrees (`platformCleared`).
   */
  const publishable = cleared || abilities.canPlatformVerify;
  /**
   * The gate names the record, not the language: it is the article or the
   * activity the platform reads, once, and its clearance is what every language
   * waits on. Each kind gets its own sentence rather than a placeholder, so
   * French and Arabic can agree with the noun they are about.
   */
  const needsPlatform =
    target.entityKind === "activity"
      ? "review.needsPlatformActivity"
      : "review.needsPlatformArticle";

  const run = (action: Action, formData: FormData, success: string) => {
    startTransition(async () => {
      try {
        await action(formData);
        toast.success(success);
      } catch (error) {
        showActionError(error, copy("toast.actionError"));
      }
    });
  };

  /** The fields every review call carries, whichever direction it travels. */
  const reviewFields = () => {
    const formData = new FormData();
    formData.set("locale", target.locale);
    formData.set("entityKind", target.entityKind);
    formData.set("entityId", target.entityId ?? "");
    formData.set("languageCode", state.code);
    if (target.returnPath) formData.set("returnPath", target.returnPath);
    return formData;
  };

  const ownerFields = () => {
    const formData = new FormData();
    formData.set("locale", target.locale);
    formData.set(target.ownerField, target.entityId ?? "");
    formData.set("languageCode", state.code);
    return formData;
  };

  const publishNow = () => {
    if (!actions.publish) return;
    run(actions.publish, ownerFields(), copy("toast.published"));
  };

  const unpublish = () => {
    if (!actions.unpublish) return;
    run(
      actions.unpublish,
      ownerFields(),
      copy(state.scheduled ? "toast.scheduleCancelled" : "toast.unpublished"),
    );
  };

  const askForReview = async (formData: FormData) => {
    const request = reviewFields();
    request.set("stage", dialog?.kind === "review" ? dialog.stage : "team");
    const note = formData.get("note");
    if (typeof note === "string" && note.trim()) request.set("note", note);
    await requestLanguageReview(request);
  };

  const decide = async (formData: FormData) => {
    const request = reviewFields();
    request.set(
      "decision",
      dialog?.kind === "decide" ? dialog.decision : "changes_requested",
    );
    const note = formData.get("note");
    if (typeof note === "string" && note.trim()) request.set("note", note);
    await decideLanguageReview(request);
  };

  /* Reviewer items appear only for the person the language is waiting on. */
  const teamMayValidate =
    abilities.canTeamValidate &&
    actionable &&
    state.reviewStage === "team_requested";
  const platformMayVerify =
    abilities.canPlatformVerify && actionable && !cleared;
  const mayReturn =
    actionable &&
    ((abilities.canTeamValidate && state.reviewStage === "team_requested") ||
      (abilities.canPlatformVerify &&
        state.reviewStage === "platform_requested"));

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={pending}
              aria-label={formatMessage(copy("language.actionsFor"), {
                language: languageName,
              })}
            />
          }
        >
          <MoreHorizontal aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          {state.isSource ? null : (
            <DropdownMenuGroup>
              <DropdownMenuLabel>{copy("language.writeIt")}</DropdownMenuLabel>
              {actions.generate ? (
                <DropdownMenuItem
                  disabled={disabled || !abilities.aiEnabled}
                  onClick={actions.generate}
                >
                  <Sparkles aria-hidden />
                  {copy(
                    state.hasText
                      ? "language.regenerateAi"
                      : "language.generateAi",
                  )}
                </DropdownMenuItem>
              ) : null}
              {/* Handing a language to somebody needs a record for them to open,
               * so on a form that has never been saved these are absent rather
               * than offered and refused. */}
              {actions.requestTranslation && abilities.canInvite && saved ? (
                <DropdownMenuItem
                  disabled={disabled}
                  onClick={() => {
                    setDialog({ kind: "request" });
                  }}
                >
                  <MailPlus aria-hidden />
                  {copy("translation.request")}
                </DropdownMenuItem>
              ) : null}
              {actions.requestTranslation &&
              abilities.canInvite &&
              abilities.canGiveAccess &&
              saved ? (
                <DropdownMenuItem
                  disabled={disabled}
                  onClick={() => {
                    setDialog({ kind: "access" });
                  }}
                >
                  <UserPlus aria-hidden />
                  {copy("language.giveAccess")}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuGroup>
          )}

          {actionable ? (
            <>
              {state.isSource ? null : <DropdownMenuSeparator />}
              <DropdownMenuGroup>
                <DropdownMenuLabel>
                  {copy("language.haveItRead")}
                </DropdownMenuLabel>
                <DropdownMenuItem
                  disabled={state.dirty}
                  aria-describedby={state.dirty ? dirtyHintId : undefined}
                  onClick={() => {
                    setDialog({ kind: "review", stage: "team" });
                  }}
                >
                  <Users aria-hidden />
                  {copy("review.sendToTeam")}
                  {/* Which of the two reads publishing actually waits for,
                   * said where the choice is made rather than one dialog
                   * later. */}
                  <span className="text-copy-muted ms-auto ps-2 text-xs">
                    {copy("optional")}
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={state.dirty}
                  aria-describedby={state.dirty ? dirtyHintId : undefined}
                  onClick={() => {
                    setDialog({ kind: "review", stage: "platform" });
                  }}
                >
                  <ShieldCheck aria-hidden />
                  {copy("review.sendToPlatform")}
                  <span className="text-copy-muted ms-auto ps-2 text-xs">
                    {copy("required")}
                  </span>
                </DropdownMenuItem>
                {teamMayValidate ? (
                  <DropdownMenuItem
                    onClick={() => {
                      setDialog({ kind: "decide", decision: "team_validated" });
                    }}
                  >
                    <BadgeCheck aria-hidden />
                    {copy("review.validate")}
                  </DropdownMenuItem>
                ) : null}
                {platformMayVerify ? (
                  <DropdownMenuItem
                    onClick={() => {
                      setDialog({
                        kind: "decide",
                        decision: "platform_verified",
                      });
                    }}
                  >
                    <ShieldCheck aria-hidden />
                    {copy("review.verify")}
                  </DropdownMenuItem>
                ) : null}
                {mayReturn ? (
                  <DropdownMenuItem
                    onClick={() => {
                      setDialog({ kind: "changes" });
                    }}
                  >
                    <RotateCcw aria-hidden />
                    {copy("review.sendBack")}
                  </DropdownMenuItem>
                ) : null}
                {/* Nobody should be sent text the record does not hold yet. */}
                {state.dirty ? (
                  <p
                    id={dirtyHintId}
                    role="presentation"
                    /* A sentence wraps; the items above do not. Without a width
                     * of its own it would set the menu's, and one explanation
                     * would stretch the menu across the screen. */
                    className="text-copy-muted max-w-52 px-1.5 py-1 text-xs"
                  >
                    {copy("language.saveFirst")}
                  </p>
                ) : null}
              </DropdownMenuGroup>
            </>
          ) : null}

          {/* Publication is offered only when there is something to publish. */}
          {actionable && abilities.canPublish ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>
                  {copy("language.publishIt")}
                </DropdownMenuLabel>
                {live ? (
                  <DropdownMenuItem variant="destructive" onClick={unpublish}>
                    {state.scheduled ? (
                      <CalendarX aria-hidden />
                    ) : (
                      <EyeOff aria-hidden />
                    )}
                    {copy(
                      state.scheduled
                        ? "publication.cancelSchedule"
                        : "translation.unpublish",
                    )}
                  </DropdownMenuItem>
                ) : (
                  <>
                    <DropdownMenuItem
                      disabled={!publishable || state.dirty}
                      aria-describedby={publishHintId}
                      onClick={publishNow}
                    >
                      <Globe aria-hidden />
                      {copy("publication.now")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={!publishable || state.dirty}
                      aria-describedby={publishHintId}
                      onClick={() => {
                        setDialog({ kind: "schedule" });
                      }}
                    >
                      <CalendarClock aria-hidden />
                      {copy("publication.scheduleAction")}
                    </DropdownMenuItem>
                  </>
                )}
                {/* Why the two items above are refused, before they are tried. */}
                {!live && (!publishable || state.dirty) ? (
                  <p
                    id={publishHintId}
                    role="presentation"
                    className="text-copy-muted max-w-52 px-1.5 py-1 text-xs"
                  >
                    {publishable
                      ? copy("language.saveFirst")
                      : copy(needsPlatform)}
                  </p>
                ) : null}
              </DropdownMenuGroup>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Dialogs are siblings of the menu: the menu has closed by the time one
       * of them is on screen. */}
      {actions.requestTranslation && target.entityId ? (
        <TranslationRequestDialog
          action={actions.requestTranslation}
          locale={target.locale}
          ownerField={target.ownerField}
          ownerId={target.entityId}
          language={state.code}
          labels={labels}
          wordCount={state.wordCount}
          open={dialog?.kind === "request" || dialog?.kind === "access"}
          onOpenChange={(open) => {
            if (!open) setDialog(null);
          }}
          title={
            dialog?.kind === "access"
              ? formatMessage(copy("language.giveAccessTitle"), {
                  language: languageName,
                })
              : undefined
          }
          description={
            dialog?.kind === "access"
              ? copy("language.giveAccessHint")
              : undefined
          }
        />
      ) : null}

      {actions.publish && target.entityId ? (
        <SchedulePublicationDialog
          locale={target.locale as Locale}
          fields={{
            locale: target.locale,
            [target.ownerField]: target.entityId,
            languageCode: state.code,
          }}
          action={actions.publish}
          disabled={false}
          labels={labels}
          open={dialog?.kind === "schedule"}
          onOpenChange={(open) => {
            if (!open) setDialog(null);
          }}
        />
      ) : null}

      <NoteDialog
        open={dialog?.kind === "review"}
        onClose={() => {
          setDialog(null);
        }}
        action={askForReview}
        title={formatMessage(
          copy(
            dialog?.kind === "review" && dialog.stage === "platform"
              ? "review.sendToPlatformTitle"
              : "review.sendToTeamTitle",
          ),
          { language: languageName },
        )}
        description={copy(
          dialog?.kind === "review" && dialog.stage === "platform"
            ? "review.sendToPlatformHint"
            : "review.sendToTeamHint",
        )}
        noteLabel={copy("review.note")}
        noteHint={copy("review.noteHint")}
        submitLabel={copy("review.send")}
        successMessage={copy("review.sent")}
        errorMessage={copy("toast.actionError")}
        cancelLabel={copy("action.cancel")}
      />

      <NoteDialog
        open={dialog?.kind === "decide" || dialog?.kind === "changes"}
        onClose={() => {
          setDialog(null);
        }}
        action={decide}
        title={formatMessage(
          copy(
            dialog?.kind === "changes"
              ? "review.sendBackTitle"
              : dialog?.kind === "decide" &&
                  dialog.decision === "platform_verified"
                ? "review.verifyTitle"
                : "review.validateTitle",
          ),
          { language: languageName },
        )}
        description={copy(
          dialog?.kind === "changes"
            ? "review.sendBackHint"
            : "review.decideHint",
        )}
        noteLabel={copy("review.note")}
        noteHint={copy("review.noteHint")}
        /* Sending work back without saying why is not a review. */
        noteRequired={dialog?.kind === "changes"}
        submitLabel={copy(
          dialog?.kind === "changes" ? "review.sendBack" : "review.confirm",
        )}
        successMessage={copy("review.decided")}
        errorMessage={copy("toast.actionError")}
        cancelLabel={copy("action.cancel")}
        destructive={dialog?.kind === "changes"}
      />
    </>
  );
}

/**
 * A word to whoever is being asked, or the reason it came back — the only field
 * every step of the chain has in common.
 */
function NoteDialog({
  open,
  onClose,
  action,
  title,
  description,
  noteLabel,
  noteHint,
  noteRequired = false,
  submitLabel,
  successMessage,
  errorMessage,
  cancelLabel,
  destructive = false,
}: {
  open: boolean;
  onClose: () => void;
  action: Action;
  title: string;
  description: string;
  noteLabel: string;
  noteHint: string;
  noteRequired?: boolean;
  submitLabel: string;
  successMessage: string;
  errorMessage: string;
  cancelLabel: string;
  destructive?: boolean;
}) {
  const showActionError = useActionErrorToast();
  const submit = async (formData: FormData) => {
    try {
      await action(formData);
      toast.success(successMessage);
      onClose();
    } catch (error) {
      showActionError(error, errorMessage);
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form action={submit} className="grid gap-4">
          <Field>
            <FieldLabel htmlFor="language-review-note">{noteLabel}</FieldLabel>
            <Textarea
              id="language-review-note"
              name="note"
              rows={3}
              maxLength={2000}
              required={noteRequired}
            />
            <FieldDescription>{noteHint}</FieldDescription>
          </Field>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {cancelLabel}
            </DialogClose>
            <PendingButton variant={destructive ? "danger" : "primary"}>
              {submitLabel}
            </PendingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
