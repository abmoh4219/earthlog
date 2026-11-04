// THE site URL lives here and only here (ADR-0007). Today: a Vercel subdomain.
// Later: https://earthlog.abdelah.dev — change this one value (or set NEXT_PUBLIC_SITE_URL).
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://earthlog.vercel.app";

export const SITE_NAME = "Earthlog";
export const TAGLINE = "The planet's black box.";
export const DESCRIPTION =
  "Replay real world events minute by minute on a cinematic 3D globe — and see how we know. Every sentence cites the recorded data behind it.";
export const REPO_URL = "https://github.com/abmoh4219/earthlog";
