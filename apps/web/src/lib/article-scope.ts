/**
 * How wide an article's reach is: everywhere, or one city.
 *
 * The console asks the question and the action stores the answer, so both read
 * the tuple from here — a scope the form can offer is a scope the server accepts.
 */
export const articleScopes = ["global", "city"] as const;

export type ArticleScope = (typeof articleScopes)[number];
