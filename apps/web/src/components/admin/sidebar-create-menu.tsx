"use client";

import { Plus } from "lucide-react";
import Link from "next/link";

import { Icon, type IconName } from "~/components/icons";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { useSidebar } from "~/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";

export interface SidebarCreateAction {
  href: string;
  label: string;
  icon: IconName;
}

/**
 * The one place an editor starts something new.
 *
 * Every create route otherwise costs a list page first, and the list pages put
 * their own "new" button in a different corner each time. Keeping the verb at
 * the top of the sidebar means the answer to "how do I add a record?" is always
 * in the same spot, next to the workspace it will belong to.
 */
export function SidebarCreateMenu({
  label,
  actions,
}: {
  label: string;
  actions: readonly SidebarCreateAction[];
}) {
  const { isMobile, setOpenMobile, state } = useSidebar();
  if (!actions.length) return null;

  return (
    <Tooltip>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <TooltipTrigger
              render={
                <Button
                  aria-label={label}
                  className="h-9 w-full justify-start gap-2 font-semibold group-data-[collapsible=icon]:size-9 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
                />
              }
            />
          }
        >
          <Plus className="size-4 shrink-0" aria-hidden />
          <span className="truncate group-data-[collapsible=icon]:hidden">
            {label}
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="bottom" className="w-64">
          {actions.map((action) => (
            <DropdownMenuItem
              key={action.href}
              className="min-h-9"
              render={
                <Link
                  href={action.href}
                  onClick={() => {
                    if (isMobile) setOpenMobile(false);
                  }}
                />
              }
            >
              <Icon name={action.icon} size={16} />
              <span className="truncate">{action.label}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {/* Only when the sidebar is icons: expanded, the button already says it. */}
      <TooltipContent
        side="inline-end"
        hidden={state !== "collapsed" || isMobile}
      >
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
