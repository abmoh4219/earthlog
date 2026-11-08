// node scripts/news/places-build.ts
// Builds scripts/news/places.json, the gazetteer that puts headlines on the map:
// - cities: Natural Earth 10m populated places (public domain), 100k+ people or a capital;
// - regions that are not cities (Gaza Strip, Darfur, Crimea, US states…): coordinates from
//   their Wikipedia articles' primary coordinates (prop=coordinates), never typed by hand.
// Run again only to change the lists; the output is committed and read by scripts/news.
import { join } from "node:path";
import { z } from "zod";
import { countryAt } from "../../src/scene/geo.ts";
import { Country } from "../../src/scene/schema.ts";
import { fetchBytes, ROOT, readJson, writeJson } from "../bake/lib.ts";
import { fetchCoordinates } from "../bake/wikinews.ts";

const NE =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_10m_populated_places_simple.geojson";

/**
 * City names that are also everyday words or common first names in English headlines:
 * matching them would put stories in the wrong place ("Nice weather", "Jackson says").
 */
const AMBIGUOUS = new Set([
  "Mobile",
  "Reading",
  "Nice",
  "Split",
  "Bath",
  "Male",
  "Victoria",
  "Hamilton",
  "Jackson",
  "Lincoln",
  "Austin",
  "Charlotte",
  "Marion",
  "Of",
  "Orange",
  "Mesa",
  "Columbia",
  "Independence",
  "Concord",
  "Surprise",
  "Federal",
  "Union",
  "March",
  "Sale",
  "Kent",
  "Florida",
  "Mercedes",
  "Leon",
  "Bristol",
  "Laval",
  "Gary",
  "Eugene",
  "Lafayette",
]);

/** Not cities: places the news names by region. Wikipedia titles. */
const REGIONS = [
  "Gaza City",
  "Rafah",
  "Khan Yunis",
  "Jenin",
  "Gaza Strip",
  "West Bank",
  "East Jerusalem",
  "Golan Heights",
  "Crimea",
  "Donbas",
  "Donetsk Oblast",
  "Luhansk Oblast",
  "Zaporizhzhia Oblast",
  "Kherson Oblast",
  "Kursk Oblast",
  "Darfur",
  "Kordofan",
  "Tigray Region",
  "Amhara Region",
  "Oromia",
  "Kashmir",
  "Jammu and Kashmir (union territory)",
  "Balochistan, Pakistan",
  "Khyber Pakhtunkhwa",
  "Xinjiang",
  "Tibet Autonomous Region",
  "Rakhine State",
  "Shan State",
  "Mindanao",
  "Kurdistan Region",
  "Idlib Governorate",
  "Nagorno-Karabakh",
  "Transnistria",
  "Abkhazia",
  "South Ossetia",
  "Somaliland",
  "Puntland",
  "North Kivu",
  "South Kivu",
  "Ituri Province",
  "Cabo Delgado Province",
  "Borno State",
  "Sahel",
  "Catalonia",
  "Basque Country (autonomous community)",
  "Scotland",
  "Wales",
  "Northern Ireland",
  "England",
  "Sicily",
  "Sardinia",
  "Corsica",
  "Canary Islands",
  "Balearic Islands",
  "Greenland",
  "Hawaii",
  "Alaska",
  "Puerto Rico",
  "Gulf of Mexico",
  "Red Sea",
  "Black Sea",
  "South China Sea",
  "Strait of Hormuz",
  "Taiwan Strait",
  "Persian Gulf",
  "Mediterranean Sea",
  "English Channel",
  "Arctic",
  "Antarctica",
  "Amazon rainforest",
  "Siberia",
  "Patagonia",
  "Bavaria",
  "Quebec",
  "Ontario",
  "British Columbia",
  "Alberta",
  "New South Wales",
  "Victoria (state)",
  "Queensland",
  "Western Australia",
  "Tasmania",
  "Punjab, India",
  "Kerala",
  "Tamil Nadu",
  "Maharashtra",
  "Uttar Pradesh",
  "West Bengal",
  "Manipur",
  "Assam",
  "Gujarat",
  "Karnataka",
  "Bihar",
  "California",
  "Texas",
  "Florida",
  "New York (state)",
  "Illinois",
  "Pennsylvania",
  "Ohio",
  "Michigan",
  "North Carolina",
  "Arizona",
  "Nevada",
  "Wisconsin",
  "Minnesota",
  "Colorado",
  "Louisiana",
  "Tennessee",
  "Virginia",
  "New Jersey",
  "Massachusetts",
  "Oregon",
  "Utah",
  "Kentucky",
  "Alabama",
  "Mississippi",
  "South Carolina",
  "Missouri",
  "Indiana",
  "Iowa",
  "Oklahoma",
  "Kansas",
  "Nebraska",
  "Arkansas",
  "Connecticut",
  "Maryland",
  "Maine",
  "Vermont",
  "New Hampshire",
  "Montana",
  "Idaho",
  "Wyoming",
  "New Mexico",
  "North Dakota",
  "South Dakota",
  "West Virginia",
  "Delaware",
  "Rhode Island",
];

/**
 * Places whose sovereignty is disputed: no country is attached, so no headline is ever placed
 * "in" one side's country by our map data (Natural Earth draws de facto control lines).
 */
const DISPUTED = new Set([
  "Gaza City",
  "Rafah",
  "Khan Yunis",
  "Jenin",
  "Gaza Strip",
  "West Bank",
  "East Jerusalem",
  "Golan Heights",
  "Crimea",
  "Donbas",
  "Donetsk Oblast",
  "Luhansk Oblast",
  "Zaporizhzhia Oblast",
  "Kherson Oblast",
  "Kashmir",
  "Jammu and Kashmir (union territory)",
  "Nagorno-Karabakh",
  "Transnistria",
  "Abkhazia",
  "South Ossetia",
  "Somaliland",
]);

const NeFeature = z.object({
  properties: z.object({
    name: z.string(),
    nameascii: z.string().nullable().optional(),
    namealt: z.string().nullable().optional(),
    adm0cap: z.number().nullable().optional(),
    iso_a2: z.string().nullable().optional(),
    pop_max: z.number().nullable().optional(),
    latitude: z.number(),
    longitude: z.number(),
  }),
});

const round = (v: number) => Math.round(v * 100) / 100;

const raw: unknown = JSON.parse(new TextDecoder().decode(await fetchBytes(NE)));
const features = z.object({ features: z.array(NeFeature) }).parse(raw).features;
const cities = features
  .map((f) => f.properties)
  .filter((p) => (p.pop_max ?? 0) >= 100_000 || p.adm0cap === 1)
  .filter((p) => !AMBIGUOUS.has(p.name) && !AMBIGUOUS.has(p.nameascii ?? ""))
  .map((p) => {
    const alt = new Set<string>();
    if (p.nameascii && p.nameascii !== p.name) alt.add(p.nameascii);
    // namealt is not used: it mixes in neighbouring towns (Goma's lists Gisenyi, in Rwanda).
    const iso = p.iso_a2 && /^[A-Z]{2}$/.test(p.iso_a2) ? p.iso_a2 : null;
    return [p.name, [...alt], round(p.longitude), round(p.latitude), iso, p.pop_max ?? 0] as const;
  })
  .sort((a, b) => b[5] - a[5]);

const countries = z
  .array(Country)
  .parse(await readJson(join(ROOT, "public", "geo", "countries.json")));
const coords = await fetchCoordinates(REGIONS);
const regions = REGIONS.flatMap((title) => {
  const c = coords.get(title);
  if (!c) {
    console.warn(`  no coordinates for ${title}`);
    return [];
  }
  const name = title.replace(/\s*\([^)]*\)$/, "").replace(/, (Pakistan|India)$/, "");
  // The country the point falls in (seas and Antarctica fall in none; disputed places none).
  const country = DISPUTED.has(title) ? null : (countryAt(c.lon, c.lat, countries)?.code ?? null);
  return [[name, round(c.lon), round(c.lat), country] as const];
});

const bytes = await writeJson(
  join(ROOT, "scripts", "news", "places.json"),
  {
    source: {
      cities: "Natural Earth 10m populated places v5.1.2 (public domain)",
      regions: "Wikipedia article coordinates (prop=coordinates)",
    },
    cities,
    regions,
  },
  false,
);
console.log(
  `✓ ${cities.length} cities, ${regions.length} regions → scripts/news/places.json (${(bytes / 1024).toFixed(0)} KB)`,
);
