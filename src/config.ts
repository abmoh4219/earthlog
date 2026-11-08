// THE site URL lives here and only here (ADR-0007). Today: a Vercel subdomain.
// Later: Abdelah's own domain — change this one value (or set NEXT_PUBLIC_SITE_URL on Vercel).
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://earthlog-abdi.vercel.app";

export const SITE_NAME = "Earthlog";
export const TAGLINE = "Yesterday's world, explained in 3D.";
export const DESCRIPTION =
  "Every morning, the previous day's hottest stories as short cinematic explainers on a 3D globe, each with the analysis its kind deserves. Every claim links to its source.";
export const REPO_URL = "https://github.com/abmoh4219/earthlog";
/**
 * The hourly headlines (ADR-0018): one file the news job force-pushes to the repository's
 * `now-data` branch, read by the browser while /now or the landing is open. If it can't be
 * reached (repository private, offline), the copy bundled with the last deploy is used.
 */
export const NOW_DATA_BASE = "https://raw.githubusercontent.com/abmoh4219/earthlog/now-data/";
export const NOW_DATA_URL = `${NOW_DATA_BASE}now.json`;
