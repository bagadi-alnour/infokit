"use client";

import { Building2, Check, ChevronDown } from "lucide-react";
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
      {/* A bordered card rather than bare text: switching association is the
       * one control in the sidebar that changes what every page below it
       * shows, so it should look like a control. */}
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className="border-line bg-surface/60 hover:bg-surface h-auto w-full min-w-0 justify-start gap-2.5 rounded-lg border px-2 py-2 text-start"
          />
        }
      >
        <span className="bg-brand text-brand-ink flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold">
          {organization.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-copy-muted block truncate text-[10.5px] font-semibold uppercase tracking-[0.09em]">
            {label}
          </span>
          <span className="block truncate text-sm font-semibold leading-tight">
            {organization.name}
          </span>
        </span>
        <ChevronDown className="text-copy-muted size-4 shrink-0" aria-hidden />
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
