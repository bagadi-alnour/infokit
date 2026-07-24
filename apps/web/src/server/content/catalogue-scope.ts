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
]);

/** Identify only the user-correctable catalogue-name uniqueness failures. */
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
