// THE site URL lives here and only here (ADR-0007). Today: a Vercel subdomain.
// Later: https://earthlog.abdelah.dev — change this one value (or set NEXT_PUBLIC_SITE_URL).
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://earthlog.vercel.app";

export const SITE_NAME = "Earthlog";
export const TAGLINE = "Yesterday's world, explained in 3D.";
export const DESCRIPTION =
  "Every morning, the previous day's hottest stories as short cinematic explainers on a 3D globe, each with the analysis its kind deserves. Every claim links to its source.";
export const REPO_URL = "https://github.com/abmoh4219/earthlog";
