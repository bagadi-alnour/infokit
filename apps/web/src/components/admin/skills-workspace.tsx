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
    <Tabs defaultValue="global">
      <div className="mb-4 overflow-x-auto pb-1">
        <TabsList
          variant="line"
          aria-label={labels["skills.tabs.label"]}
          className="group-data-horizontal/tabs:h-auto w-max min-w-full justify-start gap-x-1 pb-1"
        >
          <TabsTrigger value="global" className="flex-none">
            <TabLabel count={globalSkills.length}>
              {labels["skills.global.title"]}
            </TabLabel>
          </TabsTrigger>
          <TabsTrigger value="languages" className="flex-none">
            <TabLabel count={languages.length}>
              {labels["skills.languages.title"]}
            </TabLabel>
          </TabsTrigger>
          <TabsTrigger value="ours" className="flex-none">
            <TabLabel count={ourSkills.length}>
              {labels["skills.ours.title"]}
            </TabLabel>
          </TabsTrigger>
          <TabsTrigger value="courses" className="flex-none">
            <TabLabel count={courses.length}>
              {labels["skills.courses.title"]}
            </TabLabel>
          </TabsTrigger>
          <TabsTrigger value="requirements" className="flex-none">
            <TabLabel count={requirementSets.length}>
              {labels["skills.requirements.title"]}
            </TabLabel>
          </TabsTrigger>
          <TabsTrigger value="verify" className="flex-none">
            <TabLabel count={pending.length}>
              {labels["skills.verify.title"]}
            </TabLabel>
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="global">
        <SkillsCataloguePanel
          scope="global"
          rows={globalSkills}
          rights={rights}
          locale={locale}
          labels={labels}
        />
      </TabsContent>
      <TabsContent value="languages">
        <SkillsLanguagesPanel rows={languages} labels={labels} />
      </TabsContent>
      <TabsContent value="ours">
        <SkillsCataloguePanel
          scope="ours"
          rows={ourSkills}
          rights={rights}
          locale={locale}
          labels={labels}
        />
      </TabsContent>
      <TabsContent value="courses">
        <SkillsCoursesPanel
          rows={courses}
          rights={rights}
          locale={locale}
          labels={labels}
        />
      </TabsContent>
      <TabsContent value="requirements">
        <SkillsRequirementsPanel
          sets={requirementSets}
          targets={requirementTargets}
          organizationId={rights.scopeOrgId}
          canManage={canPlan}
          locale={locale}
          labels={labels}
        />
      </TabsContent>
      <TabsContent value="verify">
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
      <span className="text-copy-muted text-xs tabular-nums">{count}</span>
    </>
  );
}
