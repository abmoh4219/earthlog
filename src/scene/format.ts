// Time formatting for the HUD. Scene times are UTC; display is local + UTC.

function parts(t: number, timeZone: string) {
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "short",
  });
  const out: Record<string, string> = {};
  for (const p of f.formatToParts(new Date(t))) out[p.type] = p.value;
  return out;
}

/** "12:33:07" in the given zone. */
export function clockText(t: number, timeZone: string): string {
  const p = parts(t, timeZone);
  return `${p.hour}:${p.minute}:${p.second}`;
}

/** "28 Apr 2025" in the given zone. */
export function dateText(t: number, timeZone: string): string {
  const p = parts(t, timeZone);
  return `${p.day} ${p.month} ${p.year}`;
}

/** Short zone label, e.g. "CEST" or "GMT+2". */
export function zoneText(t: number, timeZone: string): string {
  return parts(t, timeZone).timeZoneName ?? timeZone;
}

/** "×600" style speed label; large speeds read as time per second. */
export function speedText(speed: number): string {
  if (speed >= 3600) return `${+(speed / 3600).toFixed(1)} h/s`;
  if (speed >= 60) return `${+(speed / 60).toFixed(1)} min/s`;
  return `×${+speed.toFixed(1)}`;
}
