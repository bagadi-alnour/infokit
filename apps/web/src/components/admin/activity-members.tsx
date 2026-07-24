"use client";

import {
  Eye,
  LockKeyhole,
  Mail,
  MailPlus,
  Star,
  UserRoundPlus,
  UserRoundX,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  assignMemberToActivity,
  unassignMemberFromActivity,
} from "~/app/[locale]/dashboard/activities/actions";
import { useActionErrorToast } from "~/components/admin/admin-ui-provider";
import { SearchableSelect } from "~/components/admin/searchable-select";
import { PendingButton } from "~/components/pending-button";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "~/components/ui/combobox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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

export interface AssignedMember {
  memberId: string;
  displayName: string;
  email: string | null;
  status: string;
  title: string | null;
  expertise: string;
  visibility: string;
  isLead: boolean;
  languages: string[];
  skills: string[];
}

export interface MemberOption {
  id: string;
  email: string;
  displayName: string;
  status: string;
  title: string | null;
  languages: string[];
  skills: string[];
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

function MemberAvatar({
  member,
  leadLabel,
  pendingLabel,
}: {
  member: AssignedMember;
  leadLabel: string;
  pendingLabel: string;
}) {
  const pending = member.status === "invited";
  return (
    <span className="relative inline-flex" title={undefined}>
      <span
        className={`ring-card flex size-11 items-center justify-center rounded-full text-sm font-bold ring-2 ${
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
          title={leadLabel}
        >
          <Star className="size-2.5 fill-current" aria-hidden />
          <span className="sr-only">{leadLabel}</span>
        </span>
      ) : pending ? (
        <span
          className="bg-brand ring-card text-canvas size-4.5 absolute -bottom-0.5 -end-0.5 flex items-center justify-center rounded-full ring-2"
          title={pendingLabel}
        >
          <Mail className="size-2.5" aria-hidden />
          <span className="sr-only">{pendingLabel}</span>
        </span>
      ) : null}
    </span>
  );
}

export function ActivityMembers({
  activityId,
  locale,
  assigned,
  options,
  languageOptions,
  labels,
}: {
  activityId: string;
  locale: string;
  assigned: AssignedMember[];
  options: MemberOption[];
  languageOptions: LanguageOption[];
  labels: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const [visibility, setVisibility] = useState<"workspace" | "public">(
    "workspace",
  );
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [title, setTitle] = useState("");
  const [skills, setSkills] = useState("");
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [selectedMember, setSelectedMember] = useState<MemberOption | null>(
    null,
  );
  const [, startTransition] = useTransition();
  const showActionError = useActionErrorToast();

  const languageLabels = useMemo(
    () => new Map(languageOptions.map((option) => [option.code, option.label])),
    [languageOptions],
  );
  const knownEmails = useMemo(
    () => new Set(options.map((option) => option.email.toLowerCase())),
    [options],
  );
  const fieldId = (name: string) => `members-${activityId}-${name}`;
  const trimmedEmail = email.trim().toLowerCase();
  const isOutsideCityTeam =
    trimmedEmail.includes("@") && !knownEmails.has(trimmedEmail);

  const resetForm = () => {
    setEmail("");
    setDisplayName("");
    setTitle("");
    setSkills("");
    setSelectedLanguages([]);
    setSelectedMember(null);
    setVisibility("workspace");
  };

  const prefillFrom = (member: MemberOption) => {
    setEmail(member.email);
    setDisplayName(member.displayName);
    setTitle(member.title ?? "");
    setSkills(member.skills.join(", "));
    setSelectedLanguages(member.languages);
  };

  const submit = async (formData: FormData) => {
    try {
      await assignMemberToActivity(formData);
      toast.success(labels.saved);
      setOpen(false);
      resetForm();
    } catch (error) {
      showActionError(error, labels.saveError ?? "");
    }
  };

  const remove = (memberId: string) => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("locale", locale);
      formData.set("activityId", activityId);
      formData.set("memberId", memberId);
      try {
        await unassignMemberFromActivity(formData);
        toast.success(labels.removed);
      } catch (error) {
        showActionError(error, labels.removeError ?? "");
      }
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-4">
      {assigned.length === 0 ? (
        <p className="text-copy-muted text-sm">{labels.empty}</p>
      ) : (
        <div className="flex items-center">
          {assigned.map((member, index) => (
            <DropdownMenu key={member.memberId}>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    className={`focus-visible:ring-brand/50 rounded-full outline-none transition-transform hover:-translate-y-0.5 focus-visible:ring-2 ${
                      index > 0 ? "-ms-2" : ""
                    }`}
                    aria-label={member.displayName}
                    title={`${member.displayName}${member.title ? ` · ${member.title}` : ""}`}
                  />
                }
              >
                <MemberAvatar
                  member={member}
                  leadLabel={labels.lead ?? ""}
                  pendingLabel={labels.pending ?? ""}
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-72">
                <div className="px-2 py-1.5">
                  <p className="flex items-center gap-1.5 text-sm font-semibold">
                    {member.displayName}
                    {member.isLead ? (
                      <Star
                        className="text-warn size-3.5 fill-current"
                        aria-label={labels.lead}
                      />
                    ) : null}
                  </p>
                  {member.title ? (
                    <p className="text-copy-muted text-xs">{member.title}</p>
                  ) : null}
                  {member.email ? (
                    <p className="text-copy-muted mt-0.5 flex items-center gap-1 text-xs">
                      <Mail className="size-3" aria-hidden />
                      {member.email}
                    </p>
                  ) : null}
                  <p className="text-copy-muted mt-1 text-xs">
                    {member.expertise}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Badge variant="secondary">
                      {member.status === "invited"
                        ? labels.pending
                        : labels.active}
                    </Badge>
                    <Badge variant="outline">
                      {member.visibility === "public" ? (
                        <Eye aria-hidden />
                      ) : (
                        <LockKeyhole aria-hidden />
                      )}
                      {member.visibility === "public"
                        ? labels.public
                        : labels.workspace}
                    </Badge>
                  </div>
                  {member.languages.length > 0 || member.skills.length > 0 ? (
                    <p className="text-copy-muted mt-2 text-xs">
                      {[
                        member.languages
                          .map((code) => languageLabels.get(code) ?? code)
                          .join(" · "),
                        member.skills.join(" · "),
                      ]
                        .filter(Boolean)
                        .join(" — ")}
                    </p>
                  ) : null}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => {
                    remove(member.memberId);
                  }}
                >
                  <UserRoundX aria-hidden />
                  {labels.removeFromActivity}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ))}
        </div>
      )}

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) resetForm();
        }}
      >
        <DialogTrigger
          render={
            <Button
              variant="outline"
              className="text-copy-muted hover:text-foreground h-11 gap-2 rounded-full border-dashed px-4"
            />
          }
        >
          <UserRoundPlus className="size-4" aria-hidden />
          {labels.assignCta}
        </DialogTrigger>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{labels.dialogTitle}</DialogTitle>
            <DialogDescription>{labels.dialogHint}</DialogDescription>
          </DialogHeader>
          <form action={submit} className="grid gap-4">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="activityId" value={activityId} />
            <Field>
              <FieldLabel htmlFor={fieldId("email")}>{labels.email}</FieldLabel>
              <Combobox
                items={options}
                value={selectedMember}
                inputValue={email}
                onInputValueChange={(value) => {
                  setEmail(value);
                  if (selectedMember?.email !== value) setSelectedMember(null);
                }}
                onValueChange={(member) => {
                  setSelectedMember(member);
                  if (member) prefillFrom(member);
                }}
                filter={(member, query) =>
                  `${member.displayName} ${member.email}`
                    .toLocaleLowerCase()
                    .includes(query.toLocaleLowerCase())
                }
                itemToStringLabel={(member) => member.email}
                itemToStringValue={(member) => member.email}
                isItemEqualToValue={(left, right) => left.email === right.email}
                autoHighlight
              >
                <input type="hidden" name="email" value={email} />
                <ComboboxInput
                  id={fieldId("email")}
                  type="email"
                  aria-label={labels.email}
                  placeholder={labels.searchPlaceholder}
                  autoComplete="email"
                  required
                  className="w-full"
                />
                <ComboboxContent>
                  <ComboboxEmpty>{labels.noMatch}</ComboboxEmpty>
                  <ComboboxList>
                    {(member: MemberOption) => (
                      <ComboboxItem key={member.email} value={member}>
                        <span className="bg-brand-soft text-brand flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                          {initialsOf(member.displayName)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate">
                            {member.displayName}
                          </span>
                          <span className="text-copy-muted block truncate text-xs">
                            {member.email}
                          </span>
                        </span>
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
              {isOutsideCityTeam ? (
                <p className="bg-brand-soft text-brand flex items-start gap-2 rounded-lg p-2.5 text-xs">
                  <MailPlus className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  {labels.inviteNote}
                </p>
              ) : (
                <FieldDescription>{labels.emailHint}</FieldDescription>
              )}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor={fieldId("display-name")}>
                  {labels.displayName}
                </FieldLabel>
                <Input
                  id={fieldId("display-name")}
                  name="displayName"
                  autoComplete="off"
                  value={displayName}
                  onChange={(event) => {
                    setDisplayName(event.target.value);
                  }}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={fieldId("title")}>
                  {labels.title}
                </FieldLabel>
                <Input
                  id={fieldId("title")}
                  name="title"
                  autoComplete="off"
                  value={title}
                  onChange={(event) => {
                    setTitle(event.target.value);
                  }}
                />
              </Field>
            </div>
            <Field>
              <FieldLabel>{labels.languagesSpoken}</FieldLabel>
              <div className="flex flex-wrap gap-1.5">
                {languageOptions.map((option) => {
                  const active = selectedLanguages.includes(option.code);
                  return (
                    <button
                      key={option.code}
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        setSelectedLanguages((current) =>
                          active
                            ? current.filter((code) => code !== option.code)
                            : [...current, option.code],
                        );
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
              </div>
              {selectedLanguages.map((code) => (
                <input key={code} type="hidden" name="languages" value={code} />
              ))}
            </Field>
            <Field>
              <FieldLabel htmlFor={fieldId("skills")}>
                {labels.skills}
              </FieldLabel>
              <Input
                id={fieldId("skills")}
                name="skills"
                value={skills}
                onChange={(event) => {
                  setSkills(event.target.value);
                }}
              />
              <FieldDescription>{labels.skillsHint}</FieldDescription>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor={fieldId("expertise")}>
                  {labels.expertise}
                </FieldLabel>
                <Input id={fieldId("expertise")} name="expertise" required />
              </Field>
              <Field>
                <FieldLabel>{labels.visibility}</FieldLabel>
                <SearchableSelect
                  name="visibility"
                  options={[
                    { value: "workspace", label: labels.workspace ?? "" },
                    { value: "public", label: labels.public ?? "" },
                  ]}
                  value={visibility}
                  onValueChange={(value) => {
                    setVisibility(value as "workspace" | "public");
                  }}
                  label={labels.visibility}
                  placeholder={labels.visibility}
                  emptyLabel={labels.noMatch}
                  required
                />
              </Field>
            </div>
            {visibility === "public" ? (
              <div className="bg-brand-soft border-brand/30 grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
                <div className="text-brand flex items-start gap-2 sm:col-span-2">
                  <Eye className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <p className="text-xs">{labels.publicHint}</p>
                </div>
                <Field>
                  <FieldLabel htmlFor={fieldId("public-name")}>
                    {labels.publicName}
                  </FieldLabel>
                  <Input
                    id={fieldId("public-name")}
                    name="publicDisplayName"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor={fieldId("public-expertise")}>
                    {labels.publicExpertise}
                  </FieldLabel>
                  <Input
                    id={fieldId("public-expertise")}
                    name="publicExpertise"
                    required
                  />
                </Field>
              </div>
            ) : (
              <p className="text-copy-muted flex items-start gap-2 text-xs">
                <LockKeyhole className="mt-0.5 size-4 shrink-0" aria-hidden />
                {labels.workspaceHint}
              </p>
            )}
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>
                {labels.cancel}
              </DialogClose>
              <PendingButton>
                <UserRoundPlus aria-hidden />
                {labels.assign}
              </PendingButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
