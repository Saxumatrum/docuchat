/**
 * Sub-path the app is served under on the portfolio domain
 * (adjetei-martey.vercel.app/play/docuchat). Next.js prefixes pages and
 * `next/link` automatically, but not `fetch` calls or plain asset URLs, so
 * those go through `withBase`.
 */
export const BASE_PATH = "/play/docuchat";

export function withBase(path: string): string {
  return `${BASE_PATH}${path}`;
}
