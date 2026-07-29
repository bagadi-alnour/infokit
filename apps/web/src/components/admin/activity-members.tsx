"use client";

import {
  Check,
  Clock3,
  Eye,
  LockKeyhole,
  Mail,
  MailPlus,
  Phone,
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
import {
  SearchableMultiSelect,
  SearchableSelect,
  type SearchableOption,
} from "~/components/admin/searchable-select";
import { Chip } from "~/components/admin/workspace";
import { PendingButton } from "~/components/pending-button";
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
import { memberFullName, memberInitials } from "~/lib/member-name";

export interface AssignedMember {
  memberId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  /** The roster's number for them — always present, the column is NOT NULL. */
  phone: string;
  status: string;
  title: string;
  expertise: string;
  visibility: string;
  isLead: boolean;
  languages: string[];
  skills: string[];
}

export interface MemberOption {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  title: string;
  phone: string;
  languages: string[];
  /** Catalogue ids, so prefilling an existing member re-selects the same rows. */
  skillIds: string[];
}

export interface LanguageOption {
  code: string;
  label: string;
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
            ? "border-warn/50 bg-warn-soft text-warn border border-dashed"
            : "bg-brand-soft text-brand-deep"
        }`}
        aria-hidden
      >
        {memberInitials(member)}
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
  skillOptions,
  labels,
}: {
  activityId: string;
  locale: string;
  assigned: AssignedMember[];
  options: MemberOption[];
  languageOptions: LanguageOption[];
  /** The catalogue rows this organisation may point at — global plus its own. */
  skillOptions: SearchableOption[];
  labels: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const [visibility, setVisibility] = useState<"workspace" | "public">(
    "workspace",
  );
  const [email, setEmail] = useState("");
  const [skillIds, setSkillIds] = useState<string[]>([]);
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
  const knownMembers = useMemo(
    () =>
      new Map(
        options.map((option) => [option.email.toLowerCase(), option] as const),
      ),
    [options],
  );
  const fieldId = (name: string) => `members-${activityId}-${name}`;
  const trimmedEmail = email.trim().toLowerCase();
  const matchedMember = knownMembers.get(trimmedEmail) ?? null;
  /**
   * An address nobody in the association carries yet. Assigning it creates the
   * member row, so the five fields `core.organization_members` requires are asked
   * for here; a matched address keeps the identity the roster already holds.
   */
  const isNewPerson = trimmedEmail.includes("@") && matchedMember === null;

  const resetForm = () => {
    setEmail("");
    setSkillIds([]);
    setSelectedLanguages([]);
    setSelectedMember(null);
    setVisibility("workspace");
  };

  const prefillFrom = (member: MemberOption) => {
    setEmail(member.email);
    setSkillIds(member.skillIds);
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
                    aria-label={memberFullName(member)}
                    title={`${memberFullName(member)} · ${member.title}`}
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
                    {memberFullName(member)}
                    {member.isLead ? (
                      <Star
                        className="text-warn size-3.5 fill-current"
                        aria-label={labels.lead}
                      />
                    ) : null}
                  </p>
                  <p className="text-copy-muted text-xs">{member.title}</p>
                  <p className="text-copy-muted mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
                    {member.email ? (
                      <span className="inline-flex items-center gap-1">
                        <Mail className="text-brand size-3" aria-hidden />
                        {member.email}
                      </span>
                    ) : null}
                    <span className="inline-flex items-center gap-1">
                      <Phone className="text-brand size-3" aria-hidden />
                      <span dir="ltr">{member.phone}</span>
                    </span>
                  </p>
                  <p className="text-copy-muted mt-1 text-xs">
                    {member.expertise}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {member.status === "invited" ? (
                      <Chip tone="warn">
                        <Clock3 className="size-3" aria-hidden />
                        {labels.pending}
                      </Chip>
                    ) : (
                      <Chip tone="ok">
                        <Check className="size-3" aria-hidden />
                        {labels.active}
                      </Chip>
                    )}
                    <Chip
                      tone={
                        member.visibility === "public" ? "accent" : "neutral"
                      }
                    >
                      {member.visibility === "public" ? (
                        <Eye className="size-3" aria-hidden />
                      ) : (
                        <LockKeyhole className="size-3" aria-hidden />
                      )}
                      {member.visibility === "public"
                        ? labels.public
                        : labels.workspace}
                    </Chip>
                  </div>
                  {member.languages.length > 0 || member.skills.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {member.languages.map((code) => (
                        <Chip key={code} tone="accent">
                          {languageLabels.get(code) ?? code}
                        </Chip>
                      ))}
                      {member.skills.map((skill) => (
                        <Chip key={skill}>{skill}</Chip>
                      ))}
                    </div>
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
                  `${memberFullName(member)} ${member.email} ${member.title}`
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
                        <span className="bg-brand-soft text-brand-deep flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                          {memberInitials(member)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate">
                            {memberFullName(member)}
                          </span>
                          <span className="text-copy-muted block truncate text-xs">
                            {member.title} · {member.email}
                          </span>
                        </span>
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
              {isNewPerson ? (
                <p className="bg-brand-soft text-brand-deep flex items-start gap-2 rounded-lg p-2.5 text-xs">
                  <MailPlus className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  {labels.inviteNote}
                </p>
              ) : (
                <FieldDescription>{labels.emailHint}</FieldDescription>
              )}
            </Field>
            {isNewPerson ? (
              <div className="border-line grid gap-4 rounded-lg border border-dashed p-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor={fieldId("first-name")}>
                    {labels.firstName}
                  </FieldLabel>
                  <Input
                    id={fieldId("first-name")}
                    name="firstName"
                    autoComplete="off"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor={fieldId("last-name")}>
                    {labels.lastName}
                  </FieldLabel>
                  <Input
                    id={fieldId("last-name")}
                    name="lastName"
                    autoComplete="off"
                    required
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
                    required
                  />
                  <FieldDescription>{labels.titleHint}</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor={fieldId("phone")}>
                    {labels.phone}
                  </FieldLabel>
                  <Input
                    id={fieldId("phone")}
                    name="phone"
                    type="tel"
                    dir="ltr"
                    autoComplete="off"
                    required
                  />
                  <FieldDescription>{labels.phoneHint}</FieldDescription>
                </Field>
              </div>
            ) : matchedMember ? (
              /**
               * Read, not editable: who somebody is belongs to the roster, so an
               * assignment shows it to confirm the right person and sends nobody
               * to the wrong dialog to correct a name.
               */
              <p className="text-copy-muted flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                <span className="text-foreground font-medium">
                  {memberFullName(matchedMember)}
                </span>
                <span>{matchedMember.title}</span>
                <span className="text-brand" dir="ltr">
                  {matchedMember.phone}
                </span>
              </p>
            ) : null}
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
                          ? "border-brand bg-brand-soft text-brand-deep"
                          : "border-line text-copy-muted hover:border-brand/50 hover:text-brand-deep"
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
              <FieldLabel>{labels.skills}</FieldLabel>
              <SearchableMultiSelect
                name="skillIds"
                options={skillOptions}
                value={skillIds}
                onValueChange={setSkillIds}
                label={labels.skills}
                placeholder={labels.skillsPlaceholder}
                emptyLabel={labels.skillsEmpty}
                maxSelections={40}
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
