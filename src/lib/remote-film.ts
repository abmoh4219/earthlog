"use client";

// A film's files fetched in the browser (ADR-0020, ADR-0027): an hour's Now film from the
// side branch, or an old edition's film from the archive. Every file is parsed with Zod.
import { z } from "zod";
import type { SceneBundle } from "@/player/store";
import { Evidence, LayerData, Scene, Source } from "@/scene/schema";

/** The first of `bases` (folders ending in "/") that holds the whole film. */
export async function loadRemoteFilm(bases: string[]): Promise<SceneBundle | undefined> {
  for (const base of bases) {
    try {
      const get = async (file: string): Promise<unknown> => {
        const res = await fetch(`${base}${file}`, { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
      };
      const [scene, evidence, sources] = await Promise.all([
        get("scene.json"),
        get("evidence.json"),
        get("sources.json"),
      ]);
      const parsed = Scene.parse(scene);
      // Lens films carry map and chart data files (data/<layer>.json), listed by the scene.
      const layers = await Promise.all(
        parsed.layers.map(async (ref) => LayerData.parse(await get(ref.file))),
      );
      return {
        scene: parsed,
        evidence: z.array(Evidence).parse(evidence),
        sources: z.array(Source).parse(sources),
        layers,
      };
    } catch {
      // Not there, or offline: try the next copy.
    }
  }
  return undefined;
}
