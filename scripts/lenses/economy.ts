// The economy lens: central banks, markets, budgets, prices.
// The institution in the news (found among the story's linked articles: a central bank,
// ministry, exchange or company with a headquarters) → its country in numbers (World Bank:
// inflation, growth, unemployment over the years) → the neighbourhood (the same World Bank
// region as glowing 3D columns of inflation, the story's country highlighted against the
// regional median). Verified 2026-11-04 on the Reserve Bank of Australia rate rise.
import { LENS_INFO } from "../../src/scene/edition.ts";
import { countryName } from "../../src/scene/geo.ts";
import type { Evidence, LayerData } from "../../src/scene/schema.ts";
import {
  fetchCountries,
  fetchIndicator,
  INDICATORS,
  type IndicatorKey,
  type Series,
  worldBankSource,
} from "../bake/worldbank.ts";
import { fetchEntities, fetchQids, type WdEntity } from "../edition/sources.ts";
import type { ChapterDraft, PanelDraft, Shot } from "./film.ts";
import { generalLens, type LensContext, type LensResult, sharedLayer } from "./general.ts";

/** Institution types that make an economy story's "who decided" (Wikidata P31 labels). */
const INSTITUTION =
  /central bank|bank|stock exchange|ministry|treasury|government agency|regulator|company|corporation|organization|monetary authority/i;

const pct = (v: number) => `${v.toFixed(1)}%`;

export function median(xs: number[]): number | undefined {
  if (!xs.length) return undefined;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : ((s[m - 1] ?? 0) + (s[m] ?? 0)) / 2;
}

/** The peak and the latest of a series, for "down from 6.6% in 2022" sentences. */
export function peakAndLatest(points: { year: string; value: number }[]) {
  const latest = points.at(-1);
  const recent = points.slice(-6);
  const peak = recent.reduce<{ year: string; value: number } | undefined>(
    (m, p) => (!m || p.value > m.value ? p : m),
    undefined,
  );
  return { latest, peak };
}

export async function economyLens(ctx: LensContext): Promise<LensResult> {
  const { story } = ctx;
  const iso = story.place?.country;
  const country = iso ? ctx.countries.find((c) => c.code === iso) : undefined;
  if (!iso || !country) return generalLens(ctx);

  // The institution: the first linked article whose type is an institution with a home.
  const newsIdx = story.evidence
    .filter((id) => id.startsWith("wiki:"))
    .map((id) => Number(id.split(":").at(-1)) - 1);
  const links = newsIdx.flatMap((i) => ctx.news[i]?.links ?? []);
  const qids = await fetchQids(links);
  const entities = await fetchEntities([...qids.values()]);
  for (const [k, v] of await fetchEntities(
    [...entities.values()].flatMap((e) => [...(e.items.P31 ?? []), ...(e.items.P159 ?? [])]),
  )) {
    entities.set(k, v);
  }
  const typeOf = (e: WdEntity) =>
    (e.items.P31 ?? []).map((t) => entities.get(t)?.label ?? "").join(", ");
  const institution = links
    .map((t) => ({ title: t, e: entities.get(qids.get(t) ?? "") }))
    .find(
      (x) =>
        x.e &&
        INSTITUTION.test(typeOf(x.e)) &&
        (x.e.coord || entities.get(x.e.items.P159?.[0] ?? "")?.coord),
    );
  const instHome = institution?.e
    ? ((institution.e.coord
        ? { lon: institution.e.coord.lon, lat: institution.e.coord.lat, city: undefined }
        : undefined) ??
      (() => {
        const hq = entities.get(institution.e?.items.P159?.[0] ?? "");
        // Local-government names ("City of Sydney") read better as the city ("Sydney").
        const city = hq?.label?.replace(/^(City|Municipality|Borough) of /, "");
        return hq?.coord ? { lon: hq.coord.lon, lat: hq.coord.lat, city } : undefined;
      })())
    : undefined;

  // The numbers: three indicators for every country, once.
  const wbCountries = await fetchCountries();
  const region = wbCountries.find((c) => c.iso2 === iso)?.region;
  const series = new Map<IndicatorKey, Series>();
  for (const key of Object.keys(INDICATORS) as IndicatorKey[])
    series.set(key, await fetchIndicator(key));
  const own = (key: IndicatorKey) => series.get(key)?.byCountry.get(iso) ?? [];

  const name = countryName(country);
  const dayStart = `${ctx.date}T00:00:00Z`;
  const evidence: Evidence[] = [];
  const wb = (
    key: IndicatorKey,
    who: string,
    label: string,
    points: { year: string; value: number }[],
  ) => {
    const id = `wb:${INDICATORS[key].id}:${who}`;
    if (!evidence.some((e) => e.id === id)) {
      evidence.push({
        id,
        kind: "sensor",
        source: "worldbank",
        t: dayStart,
        precision: "day",
        label: `World Bank, ${INDICATORS[key].label}, ${label}: ${points
          .slice(-6)
          .map((p) => `${p.year} ${pct(p.value)}`)
          .join("; ")}`,
        url: `https://data.worldbank.org/indicator/${INDICATORS[key].id}?locations=${who}`,
      });
    }
    return id;
  };

  const color = LENS_INFO.economy.color;
  return generalLens(ctx, {
    sources: [worldBankSource(ctx.at)],
    shape: ({ chapters, layers, add }) => {
      const keep = chapters.filter(
        (c) => c.title !== "Where" && c.title !== "On record" && c.title !== "Connected",
      );
      for (let i = layers.length - 1; i >= 0; i--) {
        const kind = layers[i]?.kind;
        if ((kind === "places" || kind === "arcs" || kind === "regions") && !sharedLayer(layers[i]))
          layers.splice(i, 1);
      }
      const inserts: ChapterDraft[] = [];

      // 1. The institution.
      if (institution?.e && instHome && institution.e.label) {
        const qid = institution.e.id;
        const id = add({
          id: `wd:${qid}:P159`,
          kind: "sensor",
          source: "wikidata",
          t: dayStart,
          precision: "day",
          label: `Wikidata, "${institution.e.label}": ${typeOf(institution.e)}${instHome.city ? `, headquartered in ${instHome.city}` : ""}`,
          url: `https://www.wikidata.org/wiki/${qid}`,
        });
        layers.push({
          kind: "places",
          places: [
            {
              name: institution.e.label,
              lon: instHome.lon,
              lat: instHome.lat,
              color,
              primary: true,
            },
          ],
        } satisfies LayerData);
        inserts.push({
          title: "Who decided",
          seconds: 8,
          shot: { lon: instHome.lon, lat: instHome.lat - 0.8, range: 8e5, pitch: -36, heading: 16 },
          beats: [
            {
              text: `The decision came from the ${institution.e.label}${instHome.city ? `, in ${instHome.city}` : ""}.`,
              cites: [id, ...story.evidence.filter((e) => e.startsWith("wiki:")).slice(0, 1)],
            },
          ],
          reveal: ["places"],
        });
      }

      // 2. The country in numbers.
      const panels: PanelDraft[] = [];
      const beats: ChapterDraft["beats"] = [];
      const lineFor = (key: IndicatorKey, lineColor: string) => {
        const pts = own(key).filter((p) => Number(p.year) >= 2010);
        if (pts.length < 3) return undefined;
        const id = wb(key, iso, name, pts);
        panels.push({
          id: key,
          kind: "line",
          title: `${INDICATORS[key].label}, ${name}`,
          unit: INDICATORS[key].unit,
          series: [
            {
              label: name,
              color: lineColor,
              points: pts.map((p) => ({ x: p.year, y: p.value })),
              cites: [id],
            },
          ],
          mark: pts.length - 1,
        });
        return { pts, id };
      };
      const inf = lineFor("inflation", color);
      const gro = lineFor("growth", "#9ad9ff");
      const une = lineFor("unemployment", "#e8f6ff");
      if (inf) {
        const { latest, peak } = peakAndLatest(inf.pts);
        if (latest) {
          beats.push({
            text:
              peak && peak.year !== latest.year && peak.value > latest.value + 0.5
                ? `Inflation in ${name} was ${pct(latest.value)} in ${latest.year}, down from ${pct(peak.value)} in ${peak.year}.`
                : `Inflation in ${name} was ${pct(latest.value)} in ${latest.year}.`,
            cites: [inf.id],
          });
        }
      }
      if (gro && une) {
        const g = gro.pts.at(-1);
        const u = une.pts.at(-1);
        if (g && u)
          beats.push({
            text: `The economy grew ${pct(g.value)} in ${g.year}; unemployment stood at ${pct(u.value)}.`,
            cites: [gro.id, une.id],
          });
      }
      const note = series.get("inflation")?.updated;
      if (panels.length) {
        panels[panels.length - 1] = {
          ...(panels.at(-1) as PanelDraft),
          note: `World Bank, World Development Indicators${note ? `, updated ${note}` : ""}. Annual figures.`,
        } as PanelDraft;
        inserts.push({
          title: `${name} in numbers`,
          seconds: 6 + beats.length * 6,
          shot: {
            lon: country.label[0],
            lat: country.label[1] - 8,
            range: 4.8e6,
            pitch: -40,
            heading: -12,
          },
          beats,
          panels: panels.slice(0, 3),
        });
      }

      // 3. The neighbourhood: the region's inflation as rising columns.
      const neighbours = region ? wbCountries.filter((c) => c.region === region) : [];
      const latestOf = (iso2: string) => series.get("inflation")?.byCountry.get(iso2)?.at(-1);
      const cols = neighbours.flatMap((c) => {
        const v = latestOf(c.iso2);
        const ne = ctx.countries.find((k) => k.code === c.iso2);
        return v && ne && Number(v.year) >= 2023
          ? [
              {
                iso2: c.iso2,
                name: countryName(ne),
                lon: ne.label[0],
                lat: ne.label[1],
                value: v.value,
                year: v.year,
              },
            ]
          : [];
      });
      const mine = cols.find((c) => c.iso2 === iso);
      if (cols.length >= 4 && mine) {
        const med = median(cols.map((c) => c.value)) ?? 0;
        const sorted = [...cols].sort((a, b) => b.value - a.value);
        const top = sorted[0];
        const ids = cols.map((c) =>
          wb("inflation", c.iso2, c.name, series.get("inflation")?.byCountry.get(c.iso2) ?? []),
        );
        const regionId = add({
          id: `wb:${INDICATORS.inflation.id}:region:${(region ?? "").replace(/[^A-Za-z]+/g, "-").toLowerCase()}`,
          kind: "sensor",
          source: "worldbank",
          t: dayStart,
          precision: "day",
          label: `World Bank, inflation, latest year, ${region}: ${sorted.map((c) => `${c.name} ${pct(c.value)} (${c.year})`).join("; ")}`,
          url: `https://data.worldbank.org/indicator/${INDICATORS.inflation.id}`,
        });
        // Comparison colours: each neighbour filled cool → warm by its value, under the columns.
        const lo = sorted.at(-1)?.value ?? 0;
        const hi = sorted[0]?.value ?? 1;
        layers.push({
          kind: "regions",
          name: "inflation",
          regions: cols.flatMap((c) => {
            const ne = ctx.countries.find((k) => k.code === c.iso2);
            return ne
              ? [
                  {
                    id: c.iso2,
                    name: c.name,
                    rings: ne.rings,
                    color: scale((c.value - lo) / Math.max(1e-9, hi - lo)),
                    opacity: c.iso2 === iso ? 0.6 : 0.42,
                  },
                ]
              : [];
          }),
          legend: [
            { label: `Lowest: ${sorted.at(-1)?.name} ${pct(lo)}`, color: scale(0) },
            { label: `Median: ${pct(med)}`, color: scale((med - lo) / Math.max(1e-9, hi - lo)) },
            { label: `Highest: ${top?.name} ${pct(hi)}`, color: scale(1) },
          ],
        });
        layers.push({
          kind: "columns",
          name: "inflation",
          unit: "%",
          maxHeight: 1_700_000,
          columns: cols.map((c) => ({
            id: c.iso2,
            name: c.name,
            lon: c.lon,
            lat: c.lat,
            value: c.value,
            // The story's country in the lens colour; the others cool, warmer the higher.
            color: c.iso2 === iso ? color : c.value > med ? "#ff8a80" : "#9ad9ff",
            ...(c.iso2 === iso || c === top ? { label: true } : {}),
          })),
        });
        inserts.push({
          title: "The neighbourhood",
          seconds: 14,
          shot: neighbourhoodShot(mine, cols),
          beats: [
            {
              text: `Across ${region}, ${name}'s ${pct(mine.value)} compares with a median of ${pct(med)}; the highest is ${top?.name} at ${pct(top?.value ?? 0)}.`,
              cites: [regionId],
            },
          ],
          panels: [
            {
              id: "region",
              kind: "bars",
              title: `Inflation, ${region}`,
              unit: "%",
              note: "Latest year on record per country (World Bank). Columns on the globe show the same values.",
              items: sorted.slice(0, 8).map((c) => ({
                label: c.name,
                value: Math.max(0, c.value),
                text: pct(c.value),
                color: c.iso2 === iso ? color : "#9ad9ff",
                cites: [ids[cols.indexOf(c)] ?? regionId],
              })),
              marker: { value: med, label: `median ${pct(med)}` },
            },
          ],
          reveal: ["columns-inflation", "regions-inflation"],
        });
      }

      for (const e of evidence) add(e);
      const after = keep.findIndex((c) => c.title === "What happened") + 1;
      keep.splice(after, 0, ...inserts);
      chapters.splice(0, chapters.length, ...keep);
    },
  });
}

/**
 * Stand behind the story's country and look across its neighbours: the camera sits on the
 * far side of the country from the region's centre, low and tilted, so the columns rise
 * toward the horizon with the story's own column in the foreground.
 */
export function neighbourhoodShot(
  mine: { lon: number; lat: number },
  cols: { lon: number; lat: number }[],
): Shot {
  // Median, not mean: a few far-flung islands shouldn't drag the view out to sea.
  const lons = cols.map((c) => c.lon).sort((a, b) => a - b);
  const lats = cols.map((c) => c.lat).sort((a, b) => a - b);
  const cLon = lons[Math.floor(lons.length / 2)] ?? mine.lon;
  const cLat = lats[Math.floor(lats.length / 2)] ?? mine.lat;
  const dLon = cLon - mine.lon;
  const dLat = cLat - mine.lat;
  // Heading (degrees from north) from the story's country toward the region's centre.
  const heading = (Math.atan2(dLon * Math.cos((mine.lat * Math.PI) / 180), dLat) * 180) / Math.PI;
  const span = Math.hypot(dLon, dLat);
  return {
    lon: mine.lon + dLon * 0.22,
    lat: mine.lat + dLat * 0.22,
    range: Math.min(9e6, Math.max(3.5e6, span * 111_000 * 1.3)),
    pitch: -38,
    heading,
  };
}

/** Cool → warm colour for a 0–1 position (low values icy blue, high values hot red). */
export function scale(u: number): string {
  const stops = [
    [0, [79, 157, 222]],
    [0.5, [255, 217, 94]],
    [1, [255, 77, 94]],
  ] as const;
  const x = Math.min(1, Math.max(0, u));
  const i = x <= 0.5 ? 0 : 1;
  const [x0, a] = stops[i] as readonly [number, readonly number[]];
  const [x1, b] = stops[i + 1] as readonly [number, readonly number[]];
  const f = (x - x0) / (x1 - x0);
  const rgb = a.map((v, k) => Math.round(v + ((b[k] ?? v) - v) * f));
  return `#${rgb.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}
