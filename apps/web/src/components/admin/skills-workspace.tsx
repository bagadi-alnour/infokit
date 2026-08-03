"use client";

import type { Locale } from "@infokit/shared/i18n";
import type { ReactNode } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

import type { CatalogueRights } from "./catalogue-rows";
import { SkillsCataloguePanel } from "./skills-catalogue-panel";
import { SkillsCoursesPanel } from "./skills-courses-panel";
import { SkillsLanguagesPanel } from "./skills-languages-panel";
import { SkillsRequirementsPanel } from "./skills-requirements-panel";
import type {
  CourseTableRow,
  LanguageTableRow,
  RequirementSetRow,
  RequirementTargetOption,
  SkillsLabels,
  SkillTableRow,
  VerifyTableRow,
} from "./skills-rows";
import { SkillsVerifyPanel } from "./skills-verify-panel";

/**
 * The same rail the account area uses (`dashboard/account/settings-nav.tsx`):
 * a filled `bg-brand-soft` pill for the current section, comfortable rows, and
 * the container's own radius. Written out here rather than shared because that
 * one is a list of routes and this is a tab set — the same look, reached two
 * different ways.
 *
 * `variant="default"`, not `"line"`, and that is load-bearing. The line variant
 * forces `data-active:bg-transparent` through a `group-data-[variant=line]`
 * selector, which no class passed in here can outrank. The default variant's
 * active rules are plain `data-active:` ones, so tailwind-merge resolves them
 * against these and the last value wins — including the `dark:` pair, which has
 * to be restated because a different modifier set is a different rule.
 */
const railTrigger = [
  "h-auto min-h-9 w-full justify-start gap-2.5 rounded-lg px-2.5 py-1.5",
  "text-[0.9rem] font-medium",
  "data-active:bg-brand-soft data-active:text-brand-soft-ink data-active:font-semibold",
  "dark:data-active:bg-brand-soft dark:data-active:text-brand-soft-ink",
].join(" ");

/**
 * Skills and courses as six tabs over one table.
 *
 * They run from the widest vocabulary to the narrowest work: what the platform
 * writes for everybody, the languages nobody has to write at all, what this
 * association adds, the trainings, what a mission will ask for, and finally the
 * declarations waiting on somebody's word. An editor asks one of those at a
 * time, and the tab keeps search, filters and paging in the same place
 * whichever one it is (docs/DESIGN-SYSTEM.md §5).
 */
export function SkillsWorkspace({
  globalSkills,
  ourSkills,
  languages,
  courses,
  requirementSets,
  requirementTargets,
  pending,
  rights,
  canPlan,
  canVerify,
  locale,
  labels,
}: {
  globalSkills: SkillTableRow[];
  ourSkills: SkillTableRow[];
  languages: LanguageTableRow[];
  courses: CourseTableRow[];
  requirementSets: RequirementSetRow[];
  requirementTargets: RequirementTargetOption[];
  pending: VerifyTableRow[];
  rights: CatalogueRights;
  canPlan: boolean;
  canVerify: boolean;
  locale: Locale;
  labels: SkillsLabels;
}) {
  return (
    /* Vertical: six destinations read as a list of places to go, which is what
     * they are, rather than as a row that had to scroll sideways to fit them.
     * `orientation="vertical"` does the layout — container becomes a row, every
     * trigger goes full width — and `railTrigger` does the rest, so the current
     * tab is the same filled pill the account rail uses. */
    <Tabs defaultValue="global" orientation="vertical" className="sm:gap-6">
      {/* Sticky, because the panels beside it are long tables: scrolling to the
       * bottom of the course list should not mean scrolling the way back up to
       * change tab. `h-fit` keeps the rail its own height inside the flex row
       * so the stick has somewhere to happen. */}
      {/* The bordered box is this wrapper, exactly as the account rail builds
       * it: `border-line bg-surface rounded-card` with `p-1.5`. It sits here
       * rather than on `TabsList` because the list's own variants hard-code a
       * radius through an attribute selector that a passed-in class cannot
       * outrank — the corners came out square whatever was handed to it. */}
      <div className="border-line bg-surface rounded-card mb-4 border p-1.5 sm:sticky sm:top-4 sm:mb-0 sm:h-fit sm:w-60 sm:shrink-0">
        <TabsList
          aria-label={labels["skills.tabs.label"]}
          className="w-full justify-start gap-1 bg-transparent p-0"
        >
          <TabsTrigger value="global" className={railTrigger}>
            <TabLabel count={globalSkills.length}>
              {labels["skills.global.title"]}
            </TabLabel>
          </TabsTrigger>
          <TabsTrigger value="languages" className={railTrigger}>
            <TabLabel count={languages.length}>
              {labels["skills.languages.title"]}
            </TabLabel>
          </TabsTrigger>
          <TabsTrigger value="ours" className={railTrigger}>
            <TabLabel count={ourSkills.length}>
              {labels["skills.ours.title"]}
            </TabLabel>
          </TabsTrigger>
          <TabsTrigger value="courses" className={railTrigger}>
            <TabLabel count={courses.length}>
              {labels["skills.courses.title"]}
            </TabLabel>
          </TabsTrigger>
          <TabsTrigger value="requirements" className={railTrigger}>
            <TabLabel count={requirementSets.length}>
              {labels["skills.requirements.title"]}
            </TabLabel>
          </TabsTrigger>
          <TabsTrigger value="verify" className={railTrigger}>
            <TabLabel count={pending.length}>
              {labels["skills.verify.title"]}
            </TabLabel>
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="global" className="min-w-0 flex-1">
        <SkillsCataloguePanel
          scope="global"
          rows={globalSkills}
          rights={rights}
          locale={locale}
          labels={labels}
        />
      </TabsContent>
      <TabsContent value="languages" className="min-w-0 flex-1">
        <SkillsLanguagesPanel rows={languages} labels={labels} />
      </TabsContent>
      <TabsContent value="ours" className="min-w-0 flex-1">
        <SkillsCataloguePanel
          scope="ours"
          rows={ourSkills}
          rights={rights}
          locale={locale}
          labels={labels}
        />
      </TabsContent>
      <TabsContent value="courses" className="min-w-0 flex-1">
        <SkillsCoursesPanel
          rows={courses}
          rights={rights}
          locale={locale}
          labels={labels}
        />
      </TabsContent>
      <TabsContent value="requirements" className="min-w-0 flex-1">
        <SkillsRequirementsPanel
          sets={requirementSets}
          targets={requirementTargets}
          organizationId={rights.scopeOrgId}
          canManage={canPlan}
          locale={locale}
          labels={labels}
        />
      </TabsContent>
      <TabsContent value="verify" className="min-w-0 flex-1">
        <SkillsVerifyPanel
          rows={pending}
          organizationId={rights.scopeOrgId}
          canDecide={canVerify}
          locale={locale}
          labels={labels}
        />
      </TabsContent>
    </Tabs>
  );
}

/** How much is behind a tab, so the choice is informed before the click. */
function TabLabel({ count, children }: { count: number; children: ReactNode }) {
  return (
    <>
      {children}
      {/* Pushed to the far edge now that the triggers are full-width rows: the
       * counts line up in a column and can be compared down the rail, instead
       * of each one floating wherever its label happened to end. */}
      <span className="text-copy-muted ms-auto text-xs tabular-nums">
        {count}
      </span>
    </>
  );
}
