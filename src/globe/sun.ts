// Where the sun is overhead at a given moment (the subsolar point), to within about a degree:
// enough to place the day/night line on a page globe. Low-precision formulas from the
// Astronomical Almanac's "Low precision formulas for the Sun" (accurate to about 0.01° in
// declination for 1950–2050), via https://aa.usno.navy.mil/faq/sun_approx
const DEG = Math.PI / 180;

export function subsolarPoint(at: Date): { lat: number; lon: number } {
  const d = (at.getTime() - Date.UTC(2000, 0, 1, 12)) / 86_400_000; // days since J2000.0
  const g = (357.529 + 0.98560028 * d) * DEG; // mean anomaly
  const q = 280.459 + 0.98564736 * d; // mean longitude (degrees)
  const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * DEG; // ecliptic longitude
  const e = (23.439 - 0.00000036 * d) * DEG; // obliquity of the ecliptic
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)); // right ascension
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  // Greenwich mean sidereal time (degrees); the sun is overhead where local sidereal time = RA.
  const gmst = 280.46061837 + 360.98564736629 * d;
  const lon = ((((ra / DEG - gmst + 180) % 360) + 360) % 360) - 180;
  return { lat: dec / DEG, lon };
}
