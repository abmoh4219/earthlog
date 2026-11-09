// Share cards (ADR-0026): the image a link preview shows, made at build time with next/og
// (Satori; static files, nothing rendered per visitor). Geist, from the geist package
// (OFL), because Satori reads TTF and the serif ships only as WOFF2. The map is drawn from
// Earthlog's own country outlines (Natural Earth, public domain).
import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { z } from "zod";
import { Country } from "@/scene/schema";

export const CARD = { width: 1200, height: 630 };

const VOID = "#07090f";
const MOON = "#f1ebdf";
const DUST = "#d4cdbf";
const SODIUM = "#ffb547";

// The map: equirectangular, latitudes 75°N to 58°S (Antarctica and the far north add nothing
// to a news map), in a 600 × 300 box.
const MAP = { w: 600, h: 300, north: 75, south: -58 };
const x = (lon: number) => ((lon + 180) / 360) * MAP.w;
const y = (lat: number) => ((MAP.north - lat) / (MAP.north - MAP.south)) * MAP.h;

let worldPath: Promise<string> | undefined;
/** Every country outline as one SVG path, rounded to keep it small. */
function world(): Promise<string> {
  worldPath ??= readFile(join(process.cwd(), "public", "geo", "countries.json"), "utf8").then(
    (text) => {
      const parts: string[] = [];
      for (const c of z.array(Country).parse(JSON.parse(text))) {
        for (const ring of c.rings) {
          if (ring.length < 8) continue;
          let d = "";
          for (let k = 0; k + 1 < ring.length; k += 2) {
            const lon = ring[k];
            const lat = ring[k + 1];
            if (lon === undefined || lat === undefined) continue;
            d += `${d ? "L" : "M"}${x(lon).toFixed(1)} ${y(lat).toFixed(1)}`;
          }
          if (d) parts.push(`${d}Z`);
        }
      }
      return parts.join("");
    },
  );
  return worldPath;
}

let fonts:
  | Promise<{ name: string; data: Buffer; weight: 300 | 400 | 500; style: "normal" }[]>
  | undefined;
function loadFonts() {
  const dir = join(process.cwd(), "node_modules", "geist", "dist", "fonts", "geist-sans");
  fonts ??= Promise.all(
    (
      [
        ["Geist-Light.ttf", 300],
        ["Geist-Regular.ttf", 400],
        ["Geist-Medium.ttf", 500],
      ] as const
    ).map(async ([file, weight]) => ({
      name: "Geist",
      data: await readFile(join(dir, file)),
      weight,
      style: "normal" as const,
    })),
  );
  return fonts;
}

export interface CardInput {
  /** Small line above the title: "Accident · 8 November 2026". */
  eyebrow: string;
  /** Lens colour for the eyebrow's dot. */
  color?: string;
  title: string;
  /** One line under the title: why it is news, or a summary. */
  note?: string;
  /** Places to mark on the map (the first is the story's own). */
  points: { lon: number; lat: number }[];
}

export async function card(input: CardInput): Promise<ImageResponse> {
  const [path, fontList] = await Promise.all([world(), loadFonts()]);
  const title = input.title.length > 110 ? `${input.title.slice(0, 107)}…` : input.title;
  const size = title.length > 70 ? 54 : title.length > 40 ? 64 : 76;
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: VOID,
        color: MOON,
        fontFamily: "Geist",
        position: "relative",
      }}
    >
      {/* The map, right, under everything. */}
      <svg
        width={MAP.w * 1.15}
        height={MAP.h * 1.15}
        viewBox={`0 0 ${MAP.w} ${MAP.h}`}
        aria-hidden="true"
        style={{ position: "absolute", right: -20, top: 150 }}
      >
        <path d={path} fill="#1a1f2b" stroke="#2c3342" strokeWidth={0.6} />
        {input.points.map((p, i) => (
          <g key={`${p.lon},${p.lat}`}>
            <circle
              cx={x(p.lon)}
              cy={y(p.lat)}
              r={i === 0 ? 16 : 9}
              fill={SODIUM}
              fillOpacity={0.18}
            />
            <circle
              cx={x(p.lon)}
              cy={y(p.lat)}
              r={i === 0 ? 6 : 4}
              fill={SODIUM}
              stroke={VOID}
              strokeWidth={1.5}
            />
          </g>
        ))}
      </svg>
      {/* A shade from the left, so the words stay readable over the map. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 820,
          height: "100%",
          background: `linear-gradient(90deg, ${VOID} 55%, rgba(7,9,15,0))`,
        }}
      />
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          width: 760,
        }}
      >
        <div
          style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 30, fontWeight: 500 }}
        >
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: 26,
              border: `2.5px solid ${MOON}`,
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "flex-end",
            }}
          >
            <div
              style={{ width: 9, height: 9, borderRadius: 9, background: SODIUM, marginTop: 1 }}
            />
          </div>
          Earthlog
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              fontSize: 26,
              color: DUST,
              opacity: 0.8,
            }}
          >
            {input.color && (
              <div style={{ width: 13, height: 13, borderRadius: 13, background: input.color }} />
            )}
            {input.eyebrow}
          </div>
          <div
            style={{
              marginTop: 18,
              fontSize: size,
              fontWeight: 300,
              lineHeight: 1.08,
              letterSpacing: -1.5,
            }}
          >
            {title}
          </div>
          {input.note && (
            <div style={{ marginTop: 24, fontSize: 25, color: DUST, opacity: 0.65 }}>
              {input.note}
            </div>
          )}
        </div>
        <div style={{ display: "flex", fontSize: 22, color: DUST, opacity: 0.5 }}>
          Every claim linked to its source · free and open source
        </div>
      </div>
    </div>,
    { ...CARD, fonts: fontList },
  );
}
