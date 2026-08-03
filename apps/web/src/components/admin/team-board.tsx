"use client";

import { formatMessage } from "@infokit/shared/i18n";
import {
  BadgeCheck,
  Building2,
  CalendarDays,
  Check,
  Clock3,
  GripVertical,
  Mail,
  MailPlus,
  MoreHorizontal,
  Pencil,
  Phone,
  Star,
  StarOff,
  TriangleAlert,
  UserRoundPlus,
  UserRoundX,
  Users,
  X,
} from "lucide-react";
import {
  useMemo,
  useOptimistic,
  useState,
  useTransition,
  type DragEvent,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import {
  inviteMember,
  moveMemberToTeam,
  resendMemberInvitation,
  setTeamLead,
  updateMemberProfile,
} from "~/app/[locale]/dashboard/my-organization/city-team/actions";
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
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Field, FieldDescription, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { memberFullName, memberInitials } from "~/lib/member-name";
import { cn } from "~/lib/utils";

/**
 * One declaration the member made from the shared catalogue. The state travels
 * with it because the states read differently to a coordinator: somebody's own
 * word, a claim waiting for a verifier, a checked one, and one that has run out.
 */
export interface MemberSkill {
  id: string;
  label: string;
  state:
    | "self_declared"
    | "awaiting_verification"
    | "verified"
    | "rejected"
    | "expired";
}

export interface LanguageOption {
  code: string;
  label: string;
}

/** A column of the board: one city team of this organisation. */
export interface BoardTeam {
  id: string;
  name: string;
  cityLabel: string;
}

/**
 * A person on the organisation's books. Everything here is required of every
 * member (`core.organization_members`), so nothing on the card is nullable —
 * a half-filled row is what the board exists to prevent.
 */
export interface BoardMember {
  memberId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  title: string;
  status: string;
  languages: string[];
  skills: MemberSkill[];
}

/**
 * A member sitting on one team. Kept apart from the member so the same person
 * can be on two city teams — an association working in Calais and Grande-Synthe
 * does that — without their profile being stored twice.
 */
export interface BoardPlacement {
  memberId: string;
  teamId: string;
  isLead: boolean;
  activityCount: number;
}

export interface BoardLabels {
  organizationTeams: string;
  membersCount: string;
  unassignedTitle: string;
  unassignedHint: string;
  unassignedEmpty: string;
  noTeamHere: string;
  dragHint: string;
  dropHere: string;
  noTeam: string;
  cityTeam: string;
  moveTo: string;
  moved: string;
  memberRemoved: string;
  lead: string;
  pending: string;
  active: string;
  activities: string;
  rowMenu: string;
  makeLead: string;
  removeLead: string;
  leadChanged: string;
  editProfile: string;
  profileSaved: string;
  resendInvite: string;
  inviteResent: string;
  removeMember: string;
  actionError: string;
  addMember: string;
  addMemberTitle: string;
  addMemberHint: string;
  addMemberAction: string;
  addToTeam: string;
  invited: string;
  inviteError: string;
  inviteNote: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  phoneHint: string;
  title: string;
  titleHint: string;
  languagesSpoken: string;
  languagesSpokenHint: string;
  skills: string;
  skillsHint: string;
  skillsPlaceholder: string;
  skillsEmpty: string;
  noMatch: string;
  cancel: string;
  save: string;
}

/** The column for people the association has taken on but not yet placed. */
const UNASSIGNED = "unassigned";

type Move = { memberId: string; from: string | null; to: string | null };

function StateChip({ skill }: { skill: MemberSkill }) {
  if (skill.state === "verified") {
    return (
      <Chip tone="ok">
        <BadgeCheck className="size-3" aria-hidden />
        {skill.label}
      </Chip>
    );
  }
  if (skill.state === "awaiting_verification") {
    return (
      <Chip tone="warn">
        <Clock3 className="size-3" aria-hidden />
        {skill.label}
      </Chip>
    );
  }
  if (skill.state === "expired") {
    return (
      <Chip tone="danger">
        <TriangleAlert className="size-3" aria-hidden />
        {skill.label}
      </Chip>
    );
  }
  if (skill.state === "rejected") {
    return (
      <Chip tone="neutral">
        <X className="size-3" aria-hidden />
        {skill.label}
      </Chip>
    );
  }
  return <Chip tone="neutral">{skill.label}</Chip>;
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
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              active
                ? "border-brand bg-brand-soft text-brand-deep"
                : "border-line text-copy-muted hover:border-brand/50 hover:text-brand-deep",
            )}
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

/**
 * Every city team of one organisation, side by side, plus the column for members
 * who are on its books without a team yet.
 *
 * One component owns all the columns because a move crosses them: dragging a
 * card out of Calais and into Grande-Synthe is a single act, and the optimistic
 * state that makes it feel instant has to live above both. It stops at the
 * organisation on purpose — `core.city_team_members` carries a composite foreign
 * key to the member's own organisation, so a card can never land on another
 * association's team, and a board that let you try would be lying.
 */
export function TeamBoard({
  locale,
  organizationId,
  organizationName,
  teams,
  members,
  placements,
  languageOptions,
  skillOptions,
  labels,
}: {
  locale: string;
  organizationId: string;
  organizationName: string;
  teams: BoardTeam[];
  members: BoardMember[];
  placements: BoardPlacement[];
  languageOptions: LanguageOption[];
  /** The catalogue rows this organisation may point at — global plus its own. */
  skillOptions: SearchableOption[];
  labels: BoardLabels;
}) {
  const [optimisticPlacements, applyMove] = useOptimistic(
    placements,
    (current: BoardPlacement[], move: Move) => {
      const rest = current.filter(
        (placement) =>
          placement.memberId !== move.memberId ||
          (placement.teamId !== move.from && placement.teamId !== move.to),
      );
      if (move.to === null) return rest;
      return [
        ...rest,
        {
          memberId: move.memberId,
          teamId: move.to,
          /** Leading is a decision about a team; it does not travel with a card. */
          isLead: false,
          /** Assignments belong to the activities of the team just left. */
          activityCount: 0,
        },
      ];
    },
  );
  const [dragging, setDragging] = useState<Move | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addTeamId, setAddTeamId] = useState("");
  const [addLanguages, setAddLanguages] = useState<string[]>([]);
  const [addSkills, setAddSkills] = useState<string[]>([]);
  const [editing, setEditing] = useState<BoardMember | null>(null);
  const [editLanguages, setEditLanguages] = useState<string[]>([]);
  const [editSkills, setEditSkills] = useState<string[]>([]);
  const [, startTransition] = useTransition();
  const showActionError = useActionErrorToast();

  const languageLabels = useMemo(
    () => new Map(languageOptions.map((option) => [option.code, option.label])),
    [languageOptions],
  );
  const memberById = useMemo(
    () => new Map(members.map((member) => [member.memberId, member])),
    [members],
  );
  const teamOptions = useMemo(
    () =>
      teams.map((team) => ({
        value: team.id,
        label: team.name,
        description: team.cityLabel,
      })),
    [teams],
  );
  const placed = new Set(
    optimisticPlacements.map((placement) => placement.memberId),
  );
  const unplaced = members.filter((member) => !placed.has(member.memberId));

  const runRowAction = (
    action: (formData: FormData) => Promise<unknown>,
    values: Record<string, string>,
    successMessage: string,
  ) => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("locale", locale);
      for (const [key, value] of Object.entries(values)) {
        formData.set(key, value);
      }
      try {
        await action(formData);
        toast.success(successMessage);
      } catch (error) {
        showActionError(error, labels.actionError);
      }
    });
  };

  const move = (target: Move) => {
    if (target.from === target.to) return;
    startTransition(async () => {
      applyMove(target);
      const formData = new FormData();
      formData.set("locale", locale);
      formData.set("memberId", target.memberId);
      formData.set("teamId", target.to ?? "");
      formData.set("fromTeamId", target.from ?? "");
      try {
        await moveMemberToTeam(formData);
        toast.success(target.to ? labels.moved : labels.memberRemoved);
      } catch (error) {
        showActionError(error, labels.actionError);
      }
    });
  };

  const addMember = async (formData: FormData) => {
    try {
      await inviteMember(formData);
      toast.success(labels.invited);
      setAddOpen(false);
      setAddTeamId("");
      setAddLanguages([]);
      setAddSkills([]);
    } catch (error) {
      showActionError(error, labels.inviteError);
    }
  };

  const saveProfile = async (formData: FormData) => {
    try {
      await updateMemberProfile(formData);
      toast.success(labels.profileSaved);
      setEditing(null);
    } catch (error) {
      showActionError(error, labels.actionError);
    }
  };

  const openAdd = (teamId: string) => {
    setAddTeamId(teamId);
    setAddLanguages([]);
    setAddSkills([]);
    setAddOpen(true);
  };

  const openEdit = (member: BoardMember) => {
    setEditing(member);
    setEditLanguages(member.languages);
    setEditSkills(member.skills.map((skill) => skill.id));
  };

  /**
   * Drop handling per column. A drag that starts in another organisation's board
   * leaves `dragging` null here, so nothing calls `preventDefault` and the
   * browser refuses the drop — the scope rule enforces itself.
   */
  const dropProps = (columnId: string | null) => {
    const key = columnId ?? UNASSIGNED;
    const accepts = dragging !== null && dragging.from !== columnId;
    return {
      isOver: accepts && over === key,
      handlers: {
        onDragOver: (event: DragEvent) => {
          if (!accepts) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          setOver(key);
        },
        onDragLeave: (event: DragEvent) => {
          if (
            event.relatedTarget instanceof Node &&
            event.currentTarget.contains(event.relatedTarget)
          ) {
            return;
          }
          setOver((current) => (current === key ? null : current));
        },
        onDrop: (event: DragEvent) => {
          if (!accepts) return;
          event.preventDefault();
          move({ ...dragging, to: columnId });
          setDragging(null);
          setOver(null);
        },
      },
    };
  };

  const card = (member: BoardMember, placement: BoardPlacement | null) => {
    const teamId = placement?.teamId ?? null;
    const pending = member.status === "invited";
    const name = memberFullName(member);
    const isDragging =
      dragging?.memberId === member.memberId && dragging.from === teamId;
    const elsewhere = teams.filter((team) => team.id !== teamId);
    return (
      <div
        key={`${teamId ?? UNASSIGNED}:${member.memberId}`}
        draggable
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", member.memberId);
          setDragging({ memberId: member.memberId, from: teamId, to: teamId });
        }}
        onDragEnd={() => {
          setDragging(null);
          setOver(null);
        }}
        className={cn(
          "border-line bg-card rounded-control group flex cursor-grab items-start gap-2.5 border p-2.5 transition-colors active:cursor-grabbing",
          isDragging ? "border-brand opacity-40" : "hover:border-brand/40",
        )}
      >
        <GripVertical
          className="text-line-strong group-hover:text-brand mt-2 size-4 shrink-0 transition-colors"
          aria-hidden
        />
        <span className="relative inline-flex shrink-0">
          <span
            className={cn(
              "flex size-10 items-center justify-center rounded-full text-sm font-bold",
              pending
                ? "border-warn/50 text-warn bg-warn-soft border border-dashed"
                : "bg-brand-soft text-brand-deep",
            )}
            aria-hidden
          >
            {memberInitials(member)}
          </span>
          {placement?.isLead ? (
            <span
              className="bg-brand ring-card size-4.5 absolute -bottom-0.5 -end-0.5 flex items-center justify-center rounded-full text-white ring-2"
              title={labels.lead}
            >
              <Star className="size-2.5 fill-current" aria-hidden />
              <span className="sr-only">{labels.lead}</span>
            </span>
          ) : null}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-semibold">{name}</span>
            {placement?.isLead ? (
              <Chip tone="accent">
                <Star className="size-3 fill-current" aria-hidden />
                {labels.lead}
              </Chip>
            ) : null}
            {pending ? (
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
          </span>
          <span className="mt-1 block text-xs font-medium">{member.title}</span>
          <span className="text-copy-muted mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="flex items-center gap-1" title={labels.email}>
              <Mail className="text-brand size-3.5" aria-hidden />
              {member.email}
            </span>
            <span className="flex items-center gap-1" title={labels.phone}>
              <Phone className="text-brand size-3.5" aria-hidden />
              <span dir="ltr">{member.phone}</span>
            </span>
            {placement ? (
              <span className="flex items-center gap-1">
                <CalendarDays className="text-brand size-3.5" aria-hidden />
                {placement.activityCount} {labels.activities}
              </span>
            ) : null}
          </span>
          {member.languages.length > 0 || member.skills.length > 0 ? (
            <span className="mt-2 flex flex-wrap gap-1">
              {member.languages.map((code) => (
                <Chip key={code} tone="accent">
                  {languageLabels.get(code) ?? code}
                </Chip>
              ))}
              {member.skills.map((skill) => (
                <StateChip key={skill.id} skill={skill} />
              ))}
            </span>
          ) : null}
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon" aria-label={labels.rowMenu} />
            }
          >
            <MoreHorizontal aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            {placement ? (
              <DropdownMenuItem
                onClick={() => {
                  runRowAction(
                    setTeamLead,
                    {
                      teamId: placement.teamId,
                      memberId: member.memberId,
                      lead: placement.isLead ? "false" : "true",
                    },
                    labels.leadChanged,
                  );
                }}
              >
                {placement.isLead ? (
                  <StarOff aria-hidden />
                ) : (
                  <Star aria-hidden />
                )}
                {placement.isLead ? labels.removeLead : labels.makeLead}
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem
              onClick={() => {
                openEdit(member);
              }}
            >
              <Pencil aria-hidden />
              {labels.editProfile}
            </DropdownMenuItem>
            {pending ? (
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
            {elsewhere.length > 0 || placement ? (
              <>
                <DropdownMenuSeparator />
                {/**
                 * The same move as the drag, for anyone who is not using a
                 * mouse: dragging must never be the only way to do something.
                 */}
                <DropdownMenuLabel>{labels.moveTo}</DropdownMenuLabel>
                {elsewhere.map((team) => (
                  <DropdownMenuItem
                    key={team.id}
                    onClick={() => {
                      move({
                        memberId: member.memberId,
                        from: teamId,
                        to: team.id,
                      });
                    }}
                  >
                    <Users aria-hidden />
                    {team.name}
                  </DropdownMenuItem>
                ))}
                {placement ? (
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => {
                      move({
                        memberId: member.memberId,
                        from: teamId,
                        to: null,
                      });
                    }}
                  >
                    <UserRoundX aria-hidden />
                    {labels.removeMember}
                  </DropdownMenuItem>
                ) : null}
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  const column = ({
    id,
    title,
    hint,
    glyph,
    count,
    children,
    footer,
  }: {
    id: string | null;
    title: string;
    hint: string;
    glyph: "team" | "unassigned";
    count: number;
    children: ReactNode;
    footer: ReactNode;
  }) => {
    const { isOver, handlers } = dropProps(id);
    return (
      // `column` is called, not rendered as a component, so the team loop below
      // cannot attach a key from the outside the way JSX would. It is set here
      // for the same reason `card` sets its own.
      <section
        key={id ?? UNASSIGNED}
        {...handlers}
        className={cn(
          "rounded-card flex flex-col border p-3 transition-colors",
          id === null
            ? "border-line bg-subtle border-dashed"
            : "border-line bg-surface",
          isOver && "border-brand bg-brand-soft/50 ring-brand/30 ring-2",
        )}
      >
        <header className="mb-3 flex items-start gap-2.5">
          <span
            className={cn(
              "rounded-control flex size-9 shrink-0 items-center justify-center",
              glyph === "team"
                ? "bg-brand-soft text-brand"
                : "bg-neutral-soft text-neutral",
            )}
            aria-hidden
          >
            {glyph === "team" ? (
              <Users className="size-4.5" />
            ) : (
              <UserRoundPlus className="size-4.5" />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">{title}</span>
              <Chip tone={glyph === "team" ? "accent" : "neutral"}>
                {formatMessage(labels.membersCount, { count: String(count) })}
              </Chip>
            </span>
            <span className="text-copy-muted mt-0.5 block text-xs">{hint}</span>
          </span>
        </header>
        <div className="grid flex-1 content-start gap-2">
          {children}
          {isOver ? (
            <p className="border-brand text-brand-deep rounded-control border border-dashed px-3 py-2 text-center text-xs font-medium">
              {labels.dropHere}
            </p>
          ) : null}
        </div>
        <div className="mt-3">{footer}</div>
      </section>
    );
  };

  return (
    <section className="mb-9">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="bg-brand-soft text-brand rounded-control flex size-9 shrink-0 items-center justify-center"
            aria-hidden
          >
            <Building2 className="size-4.5" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold tracking-tight">
              {organizationName}
            </h2>
            <p className="text-copy-muted text-xs">
              {formatMessage(labels.organizationTeams, {
                count: String(teams.length),
              })}{" "}
              · {labels.dragHint}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          className="border-brand/40 text-brand-deep hover:bg-brand-soft h-10 gap-2 rounded-full px-4"
          onClick={() => {
            openAdd("");
          }}
        >
          <UserRoundPlus className="size-4" aria-hidden />
          {labels.addMember}
        </Button>
      </header>

      <div className="grid gap-4 xl:grid-cols-2">
        {teams.map((team) => {
          const seats = optimisticPlacements
            .filter((placement) => placement.teamId === team.id)
            .map((placement) => ({
              placement,
              member: memberById.get(placement.memberId),
            }))
            .filter(
              (
                seat,
              ): seat is { placement: BoardPlacement; member: BoardMember } =>
                seat.member !== undefined,
            )
            .sort((left, right) =>
              memberFullName(left.member).localeCompare(
                memberFullName(right.member),
                locale,
              ),
            );
          return column({
            id: team.id,
            title: team.name,
            hint: team.cityLabel,
            glyph: "team",
            count: seats.length,
            children:
              seats.length > 0 ? (
                seats.map((seat) => card(seat.member, seat.placement))
              ) : (
                <p className="text-copy-muted rounded-control border-line border border-dashed px-3 py-4 text-center text-xs">
                  {labels.noTeamHere}
                </p>
              ),
            footer: (
              <Button
                variant="ghost"
                className="text-copy-muted hover:text-brand-deep hover:bg-brand-soft h-9 w-full justify-start gap-2 rounded-full px-3 text-xs"
                onClick={() => {
                  openAdd(team.id);
                }}
              >
                <UserRoundPlus className="size-3.5" aria-hidden />
                {labels.addToTeam}
              </Button>
            ),
          });
        })}

        {column({
          id: null,
          title: labels.unassignedTitle,
          hint: labels.unassignedHint,
          glyph: "unassigned",
          count: unplaced.length,
          children:
            unplaced.length > 0 ? (
              unplaced.map((member) => card(member, null))
            ) : (
              <p className="text-copy-muted rounded-control border-line border border-dashed px-3 py-4 text-center text-xs">
                {labels.unassignedEmpty}
              </p>
            ),
          footer: (
            <Button
              variant="ghost"
              className="text-copy-muted hover:text-brand-deep hover:bg-brand-soft h-9 w-full justify-start gap-2 rounded-full px-3 text-xs"
              onClick={() => {
                openAdd("");
              }}
            >
              <UserRoundPlus className="size-3.5" aria-hidden />
              {labels.addMember}
            </Button>
          ),
        })}
      </div>

      <Dialog
        open={addOpen}
        onOpenChange={(next) => {
          setAddOpen(next);
          if (!next) {
            setAddTeamId("");
            setAddLanguages([]);
            setAddSkills([]);
          }
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{labels.addMemberTitle}</DialogTitle>
            <DialogDescription>{labels.addMemberHint}</DialogDescription>
          </DialogHeader>
          <form action={addMember} className="grid gap-4">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="organizationId" value={organizationId} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor={`add-${organizationId}-first`}>
                  {labels.firstName}
                </FieldLabel>
                <Input
                  id={`add-${organizationId}-first`}
                  name="firstName"
                  autoComplete="off"
                  maxLength={120}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`add-${organizationId}-last`}>
                  {labels.lastName}
                </FieldLabel>
                <Input
                  id={`add-${organizationId}-last`}
                  name="lastName"
                  autoComplete="off"
                  maxLength={120}
                  required
                />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor={`add-${organizationId}-title`}>
                {labels.title}
              </FieldLabel>
              <Input
                id={`add-${organizationId}-title`}
                name="title"
                autoComplete="off"
                maxLength={160}
                required
                minLength={2}
              />
              <FieldDescription>{labels.titleHint}</FieldDescription>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor={`add-${organizationId}-email`}>
                  {labels.email}
                </FieldLabel>
                <Input
                  id={`add-${organizationId}-email`}
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                />
                <FieldDescription>{labels.inviteNote}</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor={`add-${organizationId}-phone`}>
                  {labels.phone}
                </FieldLabel>
                <Input
                  id={`add-${organizationId}-phone`}
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  dir="ltr"
                  maxLength={40}
                  required
                  minLength={6}
                />
                <FieldDescription>{labels.phoneHint}</FieldDescription>
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor={`add-${organizationId}-team`}>
                {labels.cityTeam}
              </FieldLabel>
              {teams.length > 0 ? (
                <SearchableSelect
                  id={`add-${organizationId}-team`}
                  name="teamId"
                  options={teamOptions}
                  value={addTeamId}
                  onValueChange={setAddTeamId}
                  label={labels.cityTeam}
                  placeholder={labels.noTeam}
                  emptyLabel={labels.noMatch}
                />
              ) : (
                <input type="hidden" name="teamId" value="" />
              )}
              <FieldDescription>{labels.unassignedHint}</FieldDescription>
            </Field>
            <Field>
              <FieldLabel>{labels.languagesSpoken}</FieldLabel>
              <LanguageChips
                selected={addLanguages}
                options={languageOptions}
                onToggle={(code) => {
                  setAddLanguages((current) =>
                    current.includes(code)
                      ? current.filter((entry) => entry !== code)
                      : [...current, code],
                  );
                }}
              />
              <FieldDescription>{labels.languagesSpokenHint}</FieldDescription>
            </Field>
            <Field>
              <FieldLabel>{labels.skills}</FieldLabel>
              <SearchableMultiSelect
                name="skillIds"
                options={skillOptions}
                value={addSkills}
                onValueChange={setAddSkills}
                label={labels.skills}
                placeholder={labels.skillsPlaceholder}
                emptyLabel={labels.skillsEmpty}
                maxSelections={40}
              />
              <FieldDescription>{labels.skillsHint}</FieldDescription>
            </Field>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>
                {labels.cancel}
              </DialogClose>
              <PendingButton>
                <MailPlus aria-hidden />
                {labels.addMemberAction}
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
            {editing ? (
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
                  <FieldLabel htmlFor={`edit-${editing.memberId}-first`}>
                    {labels.firstName}
                  </FieldLabel>
                  <Input
                    id={`edit-${editing.memberId}-first`}
                    name="firstName"
                    defaultValue={editing.firstName}
                    maxLength={120}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`edit-${editing.memberId}-last`}>
                    {labels.lastName}
                  </FieldLabel>
                  <Input
                    id={`edit-${editing.memberId}-last`}
                    name="lastName"
                    defaultValue={editing.lastName}
                    maxLength={120}
                    required
                  />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor={`edit-${editing.memberId}-title`}>
                    {labels.title}
                  </FieldLabel>
                  <Input
                    id={`edit-${editing.memberId}-title`}
                    name="title"
                    defaultValue={editing.title}
                    maxLength={160}
                    required
                    minLength={2}
                  />
                  <FieldDescription>{labels.titleHint}</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor={`edit-${editing.memberId}-phone`}>
                    {labels.phone}
                  </FieldLabel>
                  <Input
                    id={`edit-${editing.memberId}-phone`}
                    name="phone"
                    type="tel"
                    dir="ltr"
                    defaultValue={editing.phone}
                    maxLength={40}
                    required
                    minLength={6}
                  />
                  <FieldDescription>{labels.phoneHint}</FieldDescription>
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
                <FieldDescription>
                  {labels.languagesSpokenHint}
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel>{labels.skills}</FieldLabel>
                <SearchableMultiSelect
                  name="skillIds"
                  options={skillOptions}
                  value={editSkills}
                  onValueChange={setEditSkills}
                  label={labels.skills}
                  placeholder={labels.skillsPlaceholder}
                  emptyLabel={labels.skillsEmpty}
                  maxSelections={40}
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
    </section>
  );
}
