// The nightly health report: lines written to the GitHub Actions run summary (the page you see
// when you open a run), so a glance says what the night produced and whether anything broke.
// Outside Actions (no GITHUB_STEP_SUMMARY), it does nothing; the console output is the report.
import { appendFileSync } from "node:fs";

export function report(markdown: string): void {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (!file) return;
  try {
    appendFileSync(file, `${markdown}\n`);
  } catch {
    // A summary that can't be written must never fail the edition.
  }
}
