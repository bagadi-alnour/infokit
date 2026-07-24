"use client";

import {
  Building2,
  Check,
  ChevronDown,
  MapPin,
  UsersRound,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

export type ScopeOrganization = { id: string; name: string };
export type ScopeCity = { id: string; name: string };
export type ScopeTeam = {
  id: string;
  name: string;
  organizationId: string;
  cityId: string;
};

function useScopeNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const replace = (updates: Record<string, string>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) next.set(key, value);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };
  return { replace, searchParams };
}

export function AdminScopeIdentity({
  organizations,
  cities,
  teams,
  defaults,
  label,
}: {
  organizations: ScopeOrganization[];
  cities: ScopeCity[];
  teams: ScopeTeam[];
  defaults: { organizationId?: string; cityId?: string };
  label: string;
}) {
  const { replace, searchParams } = useScopeNavigation();
  const organizationId =
    searchParams.get("org") ?? defaults.organizationId ?? organizations[0]?.id;
  const organization = organizations.find((item) => item.id === organizationId);

  if (!organization) {
    return <p className="text-copy-muted text-xs">{label}</p>;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className="h-auto min-w-0 justify-start px-0 py-1 text-start hover:bg-transparent"
          />
        }
      >
        <span className="bg-brand text-canvas flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold">
          {organization.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">
            {organization.name}
          </span>
          <span className="text-copy-muted block text-xs font-normal">
            {label}
          </span>
        </span>
        <ChevronDown className="text-copy-muted ms-auto" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="start" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{label}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {organizations.map((item) => (
            <DropdownMenuItem
              key={item.id}
              onClick={() => {
                const firstTeam = teams.find(
                  (team) => team.organizationId === item.id,
                );
                replace({
                  org: item.id,
                  city:
                    firstTeam?.cityId ?? defaults.cityId ?? cities[0]?.id ?? "",
                  team: firstTeam?.id ?? "",
                });
              }}
            >
              <Building2 aria-hidden />
              <span className="truncate">{item.name}</span>
              {item.id === organizationId ? (
                <Check className="ms-auto" aria-hidden />
              ) : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AdminScopeControls({
  cities,
  teams,
  defaults,
  cityLabel,
  teamLabel,
}: {
  cities: ScopeCity[];
  teams: ScopeTeam[];
  defaults: { organizationId?: string; cityId?: string };
  cityLabel: string;
  teamLabel: string;
}) {
  const { replace, searchParams } = useScopeNavigation();
  const organizationId = searchParams.get("org") ?? defaults.organizationId;
  const cityId = searchParams.get("city") ?? defaults.cityId ?? cities[0]?.id;
  const city = cities.find((item) => item.id === cityId);
  const availableTeams = teams.filter(
    (item) => item.organizationId === organizationId && item.cityId === cityId,
  );
  const teamId = searchParams.get("team") ?? availableTeams[0]?.id;
  const team = availableTeams.find((item) => item.id === teamId);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="outline" size="lg" className="min-w-28" />}
        >
          <MapPin aria-hidden />
          <span className="max-w-28 truncate">{city?.name ?? cityLabel}</span>
          <ChevronDown aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuGroup>
            <DropdownMenuLabel>{cityLabel}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {cities.map((item) => (
              <DropdownMenuItem
                key={item.id}
                onClick={() => {
                  const firstTeam = teams.find(
                    (candidate) =>
                      candidate.organizationId === organizationId &&
                      candidate.cityId === item.id,
                  );
                  replace({ city: item.id, team: firstTeam?.id ?? "" });
                }}
              >
                <MapPin aria-hidden />
                {item.name}
                {item.id === cityId ? (
                  <Check className="ms-auto" aria-hidden />
                ) : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="outline" size="lg" className="min-w-28" />}
        >
          <UsersRound aria-hidden />
          <span className="max-w-28 truncate">{team?.name ?? teamLabel}</span>
          <ChevronDown aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuGroup>
            <DropdownMenuLabel>{teamLabel}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {availableTeams.map((item) => (
              <DropdownMenuItem
                key={item.id}
                onClick={() => {
                  replace({ team: item.id });
                }}
              >
                <UsersRound aria-hidden />
                <span className="truncate">{item.name}</span>
                {item.id === teamId ? (
                  <Check className="ms-auto" aria-hidden />
                ) : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
