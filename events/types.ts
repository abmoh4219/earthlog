// An event definition: everything a human decides about a replay. Bakers turn it into
// data and evidence; the director turns that into a scene. No facts live here: titles
// name the event, every narrated claim comes from baked evidence.
import { z } from "zod";
import { Scene, SignalKind } from "../src/scene/schema.ts";

export const EventDef = z.object({
  id: Scene.shape.id,
  title: z.string().min(1),
  subtitle: z.string(),
  category: Scene.shape.category,
  /** Shown on the landing page. */
  listed: z.boolean(),
  window: Scene.shape.window,
  /** The moment the story turns on; the director slows down and dives here. */
  focus: Scene.shape.focus,
  timezone: z.string(),
  region: Scene.shape.region,
  /** Where the camera dives at the focus moment. */
  focusPoint: z.object({ lon: z.number(), lat: z.number() }),
  imagery: z.object({ day: z.iso.date(), nights: z.array(z.iso.date()) }),
  signal: z
    .object({
      kind: SignalKind,
      tone: z.enum(["loss", "attention"]),
      /** ISO alpha-2. The first is the lead country; the rest are context or comparison. */
      countries: z.array(z.string().length(2)).min(1),
    })
    .optional(),
  quakes: z.object({ minMagnitude: z.number() }).optional(),
});

export type EventDef = z.infer<typeof EventDef>;
