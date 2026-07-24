"use client";

import {
  CalendarDays,
  Mail,
  MailPlus,
  MoreHorizontal,
  Pencil,
  Star,
  StarOff,
  UserRoundPlus,
  UserRoundX,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  inviteTeamMember,
  removeTeamMember,
  resendMemberInvitation,
  setTeamLead,
  updateMemberProfile,
} from "~/app/[locale]/dashboard/team/actions";
import { useActionErrorToast } from "~/components/admin/admin-ui-provider";
import { PendingButton } from "~/components/pending-button";
import { Badge } from "~/components/ui/badge";
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
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Field, FieldDescription, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";

export interface TeamMember {
  memberId: string;
  displayName: string;
  email: string | null;
  status: string;
  title: string | null;
  isLead: boolean;
  languages: string[];
  skills: string[];
  activityCount: number;
}

export interface LanguageOption {
  code: string;
  label: string;
}

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .map((part) => part.slice(0, 1))
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

function LanguageChips({
  selected,
  options,
  onToggle,
}: {
  selected: string[];
  options: LanguageOption[];
  onToggle: (code: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const active = selected.includes(option.code);
        return (
          <button
            key={option.code}
            type="button"
            aria-pressed={active}
            onClick={() => {
              onToggle(option.code);
            }}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              active
                ? "border-brand bg-brand-soft text-brand"
                : "border-line text-copy-muted hover:border-line-strong hover:text-foreground"
            }`}
          >
            {option.label}
          </button>
        );
      })}
      {selected.map((code) => (
        <input key={code} type="hidden" name="languages" value={code} />
      ))}
    </div>
  );
}

export function TeamRoster({
  teamId,
  locale,
  members,
  languageOptions,
  labels,
}: {
  teamId: string;
  locale: string;
  members: TeamMember[];
  languageOptions: LanguageOption[];
  labels: Record<string, string>;
}) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteLanguages, setInviteLanguages] = useState<string[]>([]);
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [editLanguages, setEditLanguages] = useState<string[]>([]);
  const [, startTransition] = useTransition();
  const showActionError = useActionErrorToast();

  const languageLabels = useMemo(
    () => new Map(languageOptions.map((option) => [option.code, option.label])),
    [languageOptions],
  );

  const runRowAction = (
    action: (formData: FormData) => Promise<unknown>,
    values: Record<string, string>,
    successMessage: string | undefined,
  ) => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("locale", locale);
      formData.set("teamId", teamId);
      for (const [key, value] of Object.entries(values)) {
        formData.set(key, value);
      }
      try {
        await action(formData);
        toast.success(successMessage ?? "");
      } catch (error) {
        showActionError(error, labels.actionError ?? "");
      }
    });
  };

  const invite = async (formData: FormData) => {
    try {
      await inviteTeamMember(formData);
      toast.success(labels.invited);
      setInviteOpen(false);
      setInviteLanguages([]);
    } catch (error) {
      showActionError(error, labels.inviteError ?? "");
    }
  };

  const saveProfile = async (formData: FormData) => {
    try {
      await updateMemberProfile(formData);
      toast.success(labels.profileSaved);
      setEditing(null);
    } catch (error) {
      showActionError(error, labels.actionError ?? "");
    }
  };

  return (
    <div className="grid gap-2">
      {members.map((member) => {
        const pending = member.status === "invited";
        return (
          <div
            key={member.memberId}
            className="border-line hover:border-line-strong flex flex-wrap items-center gap-3 rounded-lg border p-3 transition-colors"
          >
            <span className="relative inline-flex shrink-0">
              <span
                className={`flex size-11 items-center justify-center rounded-full text-sm font-bold ${
                  pending
                    ? "border-line text-copy-muted bg-subtle border border-dashed"
                    : "bg-brand-soft text-brand"
                }`}
                aria-hidden
              >
                {initialsOf(member.displayName)}
              </span>
              {member.isLead ? (
                <span
                  className="bg-warn ring-card size-4.5 absolute -bottom-0.5 -end-0.5 flex items-center justify-center rounded-full text-white ring-2"
                  title={labels.lead}
                >
                  <Star className="size-2.5 fill-current" aria-hidden />
                  <span className="sr-only">{labels.lead}</span>
                </span>
              ) : null}
            </span>

            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="text-sm font-semibold">
                  {member.displayName}
                </span>
                {member.isLead ? (
                  <Badge variant="outline" className="text-warn border-warn/40">
                    <Star className="fill-current" aria-hidden />
                    {labels.lead}
                  </Badge>
                ) : null}
                <Badge variant={pending ? "secondary" : "ghost"}>
                  {pending ? labels.pending : labels.active}
                </Badge>
              </span>
              <span className="text-copy-muted mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                {member.title ? <span>{member.title}</span> : null}
                {member.email ? (
                  <span className="flex items-center gap-1">
                    <Mail className="size-3" aria-hidden />
                    {member.email}
                  </span>
                ) : null}
                <span className="flex items-center gap-1">
                  <CalendarDays className="size-3" aria-hidden />
                  {member.activityCount} {labels.activities}
                </span>
              </span>
              {member.languages.length > 0 || member.skills.length > 0 ? (
                <span className="mt-1.5 flex flex-wrap gap-1">
                  {member.languages.map((code) => (
                    <Badge key={code} variant="secondary">
                      {languageLabels.get(code) ?? code}
                    </Badge>
                  ))}
                  {member.skills.map((skill) => (
                    <Badge key={skill} variant="outline">
                      {skill}
                    </Badge>
                  ))}
                </span>
              ) : null}
            </span>

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={labels.rowMenu}
                  />
                }
              >
                <MoreHorizontal aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuItem
                  onClick={() => {
                    runRowAction(
                      setTeamLead,
                      {
                        memberId: member.memberId,
                        lead: member.isLead ? "false" : "true",
                      },
                      labels.leadChanged,
                    );
                  }}
                >
                  {member.isLead ? (
                    <StarOff aria-hidden />
                  ) : (
                    <Star aria-hidden />
                  )}
                  {member.isLead ? labels.removeLead : labels.makeLead}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setEditing(member);
                    setEditLanguages(member.languages);
                  }}
                >
                  <Pencil aria-hidden />
                  {labels.editProfile}
                </DropdownMenuItem>
                {pending && member.email ? (
                  <DropdownMenuItem
                    onClick={() => {
                      runRowAction(
                        resendMemberInvitation,
                        { memberId: member.memberId },
                        labels.inviteResent,
                      );
                    }}
                  >
                    <MailPlus aria-hidden />
                    {labels.resendInvite}
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => {
                    runRowAction(
                      removeTeamMember,
                      { memberId: member.memberId },
                      labels.memberRemoved,
                    );
                  }}
                >
                  <UserRoundX aria-hidden />
                  {labels.removeMember}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      })}

      {members.length === 0 ? (
        <p className="text-copy-muted py-2 text-sm">{labels.empty}</p>
      ) : null}

      <div className="mt-1">
        <Button
          variant="outline"
          className="text-copy-muted hover:text-foreground h-11 gap-2 rounded-full border-dashed px-4"
          onClick={() => {
            setInviteOpen(true);
          }}
        >
          <UserRoundPlus className="size-4" aria-hidden />
          {labels.invite}
        </Button>
      </div>

      <Dialog
        open={inviteOpen}
        onOpenChange={(next) => {
          setInviteOpen(next);
          if (!next) setInviteLanguages([]);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{labels.inviteTitle}</DialogTitle>
            <DialogDescription>{labels.inviteHint}</DialogDescription>
          </DialogHeader>
          <form action={invite} className="grid gap-4">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="teamId" value={teamId} />
            <Field>
              <FieldLabel htmlFor={`invite-${teamId}-email`}>
                {labels.email}
              </FieldLabel>
              <Input
                id={`invite-${teamId}-email`}
                name="email"
                type="email"
                autoComplete="email"
                required
              />
              <FieldDescription>{labels.inviteNote}</FieldDescription>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor={`invite-${teamId}-name`}>
                  {labels.displayName}
                </FieldLabel>
                <Input
                  id={`invite-${teamId}-name`}
                  name="displayName"
                  autoComplete="off"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`invite-${teamId}-title`}>
                  {labels.title}
                </FieldLabel>
                <Input
                  id={`invite-${teamId}-title`}
                  name="title"
                  autoComplete="off"
                />
              </Field>
            </div>
            <Field>
              <FieldLabel>{labels.languagesSpoken}</FieldLabel>
              <LanguageChips
                selected={inviteLanguages}
                options={languageOptions}
                onToggle={(code) => {
                  setInviteLanguages((current) =>
                    current.includes(code)
                      ? current.filter((entry) => entry !== code)
                      : [...current, code],
                  );
                }}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`invite-${teamId}-skills`}>
                {labels.skills}
              </FieldLabel>
              <Input id={`invite-${teamId}-skills`} name="skills" />
              <FieldDescription>{labels.skillsHint}</FieldDescription>
            </Field>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>
                {labels.cancel}
              </DialogClose>
              <PendingButton>
                <MailPlus aria-hidden />
                {labels.inviteAction}
              </PendingButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editing !== null}
        onOpenChange={(next) => {
          if (!next) setEditing(null);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{labels.editProfile}</DialogTitle>
            {editing?.email ? (
              <DialogDescription>{editing.email}</DialogDescription>
            ) : null}
          </DialogHeader>
          {editing ? (
            <form
              action={saveProfile}
              className="grid gap-4"
              key={editing.memberId}
            >
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="memberId" value={editing.memberId} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor={`edit-${editing.memberId}-name`}>
                    {labels.displayName}
                  </FieldLabel>
                  <Input
                    id={`edit-${editing.memberId}-name`}
                    name="displayName"
                    defaultValue={editing.displayName}
                    required
                    minLength={2}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`edit-${editing.memberId}-title`}>
                    {labels.title}
                  </FieldLabel>
                  <Input
                    id={`edit-${editing.memberId}-title`}
                    name="title"
                    defaultValue={editing.title ?? ""}
                  />
                </Field>
              </div>
              <Field>
                <FieldLabel>{labels.languagesSpoken}</FieldLabel>
                <LanguageChips
                  selected={editLanguages}
                  options={languageOptions}
                  onToggle={(code) => {
                    setEditLanguages((current) =>
                      current.includes(code)
                        ? current.filter((entry) => entry !== code)
                        : [...current, code],
                    );
                  }}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`edit-${editing.memberId}-skills`}>
                  {labels.skills}
                </FieldLabel>
                <Input
                  id={`edit-${editing.memberId}-skills`}
                  name="skills"
                  defaultValue={editing.skills.join(", ")}
                />
                <FieldDescription>{labels.skillsHint}</FieldDescription>
              </Field>
              <DialogFooter>
                <DialogClose render={<Button variant="outline" />}>
                  {labels.cancel}
                </DialogClose>
                <PendingButton>{labels.save}</PendingButton>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
