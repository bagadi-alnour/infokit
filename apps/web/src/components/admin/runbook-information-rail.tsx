"use client";

import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { useEffect, useId, useState, type ReactNode } from "react";

import { Button } from "~/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

const informationRailStorageKey = "infokit-runbook-information-rail";

export function RunbookInformationRail({
  main,
  information,
  hideLabel,
  showLabel,
}: {
  main: ReactNode;
  information: ReactNode;
  hideLabel: string;
  showLabel: string;
}) {
  const [expanded, setExpanded] = useState(true);
  const informationId = useId();

  useEffect(() => {
    try {
      setExpanded(
        window.localStorage.getItem(informationRailStorageKey) !== "collapsed",
      );
    } catch {
      // Storage may be unavailable in privacy-focused browsing modes.
    }
  }, []);

  function updateExpanded(nextExpanded: boolean) {
    setExpanded(nextExpanded);
    try {
      window.localStorage.setItem(
        informationRailStorageKey,
        nextExpanded ? "expanded" : "collapsed",
      );
    } catch {
      // The interaction still works for this page when storage is unavailable.
    }
  }

  const toggleLabel = expanded ? hideLabel : showLabel;

  return (
    <div
      className={cn(
        "xl:grid xl:transition-[grid-template-columns] xl:duration-200 xl:ease-out",
        expanded
          ? "xl:grid-cols-[minmax(0,1fr)_352px]"
          : "xl:grid-cols-[minmax(0,1fr)_48px]",
      )}
    >
      <section className="min-w-0 px-4 py-7 md:px-7 xl:border-e xl:px-8 xl:py-8">
        {main}
      </section>

      <aside
        className={cn(
          "border-line bg-canvas px-4 py-6 md:px-7 xl:sticky xl:top-16 xl:max-h-[calc(100vh-4rem)] xl:self-start",
          expanded
            ? "xl:overflow-y-auto xl:px-5"
            : "xl:overflow-hidden xl:px-1",
        )}
      >
        <div
          className={cn(
            "mb-3 hidden xl:flex",
            expanded ? "justify-end" : "justify-center",
          )}
        >
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-controls={informationId}
                  aria-expanded={expanded}
                  aria-label={toggleLabel}
                  onClick={() => {
                    updateExpanded(!expanded);
                  }}
                >
                  {expanded ? (
                    <PanelRightClose aria-hidden />
                  ) : (
                    <PanelRightOpen aria-hidden />
                  )}
                  <span className="sr-only">{toggleLabel}</span>
                </Button>
              }
            />
            <TooltipContent side="left">{toggleLabel}</TooltipContent>
          </Tooltip>
        </div>

        <div id={informationId} className={cn(!expanded && "xl:hidden")}>
          {information}
        </div>
      </aside>
    </div>
  );
}
