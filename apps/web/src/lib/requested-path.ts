/**
 * Header the middleware sets on protected dashboard requests to carry the
 * attempted path+query. requireEditor reads it so gate redirects (sign-in,
 * second factor) can return the editor to where they were headed.
 */
export const REQUESTED_PATH_HEADER = "x-requested-path";
