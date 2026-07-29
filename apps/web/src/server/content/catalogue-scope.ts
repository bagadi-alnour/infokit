/** Stable database key for one catalogue-name namespace. */
export function catalogueScopeKey(
  organizationId: string | null | undefined,
): string {
  return organizationId ?? "platform";
}

const catalogueNameConstraints = new Set([
  "service_category_translations_language_label_uq",
  "service_translations_scope_language_name_uq",
  "tag_translations_scope_language_label_uq",
  /**
   * The skills half of the catalogue names rows in plain columns rather than
   * translation rows, so what an editor can retype is the name, the code, or
   * the slug — all three are "already taken in this scope", and all three are
   * theirs to correct.
   */
  "skills_scope_kind_code_uq",
  "skills_scope_name_fr_uq",
  "training_courses_scope_slug_uq",
  "requirement_sets_org_code_uq",
  "requirement_items_set_skill_uq",
  "requirement_items_set_course_uq",
  "requirement_items_set_language_uq",
]);

/**
 * Identify only the user-correctable catalogue uniqueness failures — the name,
 * code or slug they typed is already taken in this scope. Anything else is a
 * bug, and rethrowing is how it stays visible.
 */
export function isCatalogueNameConflict(error: unknown): boolean {
  let current = error;

  for (let depth = 0; depth < 3 && current instanceof Object; depth += 1) {
    const candidate = current as {
      cause?: unknown;
      code?: unknown;
      constraint?: unknown;
      constraint_name?: unknown;
      message?: unknown;
    };
    const constraint =
      typeof candidate.constraint_name === "string"
        ? candidate.constraint_name
        : candidate.constraint;
    const message =
      typeof candidate.message === "string" ? candidate.message : undefined;

    if (
      candidate.code === "23505" &&
      typeof constraint === "string" &&
      catalogueNameConstraints.has(constraint)
    ) {
      return true;
    }

    if (
      candidate.code === "23505" &&
      message !== undefined &&
      [...catalogueNameConstraints].some((name) => message.includes(name))
    ) {
      return true;
    }

    current = candidate.cause;
  }

  return false;
}
