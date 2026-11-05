// Video clip export (PLAN.md Phase 19): record a story film in the browser, free, no server.
// Each globe frame is drawn onto a recording canvas with the film's title, chapter, caption,
// citation count and source credits burned in, so a clip shared anywhere still says where
// its facts come from. MediaRecorder captures the canvas in real time while the film plays
// from the start; landscape (16:9) or vertical (9:16, the globe cropped to the centre).
import { SITE_URL } from "@/config";
import { onGlobeFrame } from "@/globe/frames";
import { activeBeatIndex } from "@/scene/beats";
import { type LayerData, ms, type Panel } from "@/scene/schema";
import { usePlayer } from "./store";

export type ClipFormat = "16:9" | "9:16";

const SIZE: Record<ClipFormat, [number, number]> = { "16:9": [1280, 720], "9:16": [720, 1280] };

/** The best format this browser can record: MP4 (plays everywhere) when it can, else WebM. */
export function clipMimeType(): string | undefined {
  const types = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm"];
  return types.find(
    (t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t),
  );
}

/** Lines of at most `width` pixels. */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > width && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** A rounded rectangle path. */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Text cut with an ellipsis to fit `width`. */
function clipText(ctx: CanvasRenderingContext2D, text: string, width: number): string {
  if (ctx.measureText(text).width <= width) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > width) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

const INK = {
  frost: "#e8f6ff",
  ice: "rgba(154,217,255,0.85)",
  muted: "rgba(154,217,255,0.55)",
  track: "rgba(154,217,255,0.14)",
};

/**
 * One panel as the player shows it (title, rows, bars, line, seats), drawn at (x, y), `w` wide.
 * Returns its height. The same data as on screen, so the clip carries the stats too.
 */
function drawPanel(
  ctx: CanvasRenderingContext2D,
  panel: Panel,
  x: number,
  y: number,
  w: number,
  font: string,
  measure = false,
): number {
  const pad = 16;
  const inner = w - pad * 2;
  let h = pad;
  const ops: (() => void)[] = [];
  const text = (
    t: string,
    tx: number,
    ty: number,
    size: number,
    color: string,
    weight = 400,
    align: CanvasTextAlign = "left",
  ) =>
    ops.push(() => {
      ctx.font = `${weight} ${size}px ${font}`;
      ctx.fillStyle = color;
      ctx.textAlign = align;
      ctx.fillText(t, tx, ty);
      ctx.textAlign = "left";
    });
  text(panel.title, x + pad, y + h, 14, INK.frost, 600);
  h += 26;
  if (panel.kind === "facts") {
    for (const item of panel.items.slice(0, 7)) {
      ctx.font = `400 13px ${font}`;
      const label = clipText(ctx, item.label, inner * 0.42);
      const value = clipText(ctx, item.text ?? "", inner * 0.56);
      text(label, x + pad, y + h, 13, INK.muted);
      text(value, x + w - pad, y + h, 13, INK.frost, 500, "right");
      h += 22;
    }
  } else if (panel.kind === "bars" || panel.kind === "seats") {
    const items = panel.items.slice(0, 6);
    const max = panel.kind === "seats" ? panel.total : Math.max(1, ...items.map((i) => i.value));
    for (const item of items) {
      ctx.font = `400 13px ${font}`;
      text(clipText(ctx, item.label, inner * 0.62), x + pad, y + h, 13, INK.frost);
      text(
        item.text ?? item.value.toLocaleString("en-GB"),
        x + w - pad,
        y + h,
        13,
        INK.frost,
        600,
        "right",
      );
      h += 20;
      const by = y + h;
      const fill = Math.max(2, (item.value / max) * inner);
      const color = item.color ?? INK.ice;
      ops.push(() => {
        ctx.fillStyle = INK.track;
        roundRect(ctx, x + pad, by, inner, 6, 3);
        ctx.fill();
        ctx.fillStyle = color;
        roundRect(ctx, x + pad, by, fill, 6, 3);
        ctx.fill();
      });
      h += 16;
    }
    const mark =
      panel.kind === "bars"
        ? panel.marker
        : panel.majority
          ? { value: panel.majority, label: `${panel.majority} for a majority` }
          : undefined;
    if (mark) {
      text(mark.label, x + pad, y + h, 11, INK.muted);
      h += 18;
    }
  } else if (panel.kind === "line") {
    const ch = 90;
    const top = y + h;
    const all = panel.series.flatMap((s) => s.points.map((p) => p.y));
    const lo = Math.min(...all);
    const hi = Math.max(...all);
    for (const s of panel.series.slice(0, 3)) {
      const pts = s.points;
      ops.push(() => {
        ctx.strokeStyle = s.color ?? INK.ice;
        ctx.lineWidth = 2;
        ctx.beginPath();
        pts.forEach((p, i) => {
          const px = x + pad + (i / Math.max(1, pts.length - 1)) * inner;
          const py = top + ch - ((p.y - lo) / Math.max(1e-9, hi - lo)) * ch;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.stroke();
      });
    }
    h += ch + 8;
    const first = panel.series[0]?.points;
    if (first) {
      text(first[0]?.x ?? "", x + pad, y + h, 11, INK.muted);
      text(first.at(-1)?.x ?? "", x + w - pad, y + h, 11, INK.muted, 400, "right");
      h += 18;
    }
    for (const s of panel.series.slice(0, 3)) {
      ctx.font = `400 12px ${font}`;
      text(clipText(ctx, s.label, inner - 16), x + pad + 16, y + h, 12, INK.frost);
      const color = s.color ?? INK.ice;
      const ly = y + h + 7;
      ops.push(() => {
        ctx.fillStyle = color;
        ctx.fillRect(x + pad, ly, 10, 2);
      });
      h += 18;
    }
  }
  if (panel.note) {
    ctx.font = `400 11px ${font}`;
    const lines = wrap(ctx, panel.note, inner).slice(0, 2);
    for (const l of lines) {
      text(l, x + pad, y + h + 4, 11, INK.muted);
      h += 15;
    }
    h += 4;
  }
  h += pad - 6;
  if (!measure) {
    ctx.fillStyle = "rgba(6,12,20,0.82)";
    roundRect(ctx, x, y, w, h, 14);
    ctx.fill();
    ctx.strokeStyle = "rgba(154,217,255,0.16)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.textBaseline = "top";
    for (const op of ops) op();
  }
  return h;
}

/** The map legend of the regions layer on screen, if any (same rule as the player). */
function drawLegend(
  ctx: CanvasRenderingContext2D,
  layer: LayerData | undefined,
  x: number,
  yBottom: number,
  font: string,
) {
  if (layer?.kind !== "regions" || !layer.legend.length) return;
  const rows = layer.legend.slice(0, 5);
  ctx.font = `400 12px ${font}`;
  const w = 24 + Math.max(...rows.map((r) => ctx.measureText(r.label).width)) + 16;
  const h = 14 + rows.length * 20;
  const y = yBottom - h;
  ctx.fillStyle = "rgba(6,12,20,0.82)";
  roundRect(ctx, x, y, w, h, 12);
  ctx.fill();
  ctx.textBaseline = "top";
  rows.forEach((r, i) => {
    ctx.fillStyle = r.color;
    ctx.beginPath();
    ctx.arc(x + 16, y + 14 + i * 20, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = INK.frost;
    ctx.fillText(r.label, x + 28, y + 7 + i * 20);
  });
}

/**
 * Record the current film from its start to its end and download it. Resolves when the file
 * is ready; `onProgress` gets 0..1. Returns a stop function through `register`.
 */
export function recordClip(
  format: ClipFormat,
  onProgress: (u: number) => void,
  register: (stop: () => void) => void,
): Promise<void> {
  const state = usePlayer.getState();
  const bundle = state.bundle;
  const mimeType = clipMimeType();
  if (!bundle || !mimeType) return Promise.reject(new Error("This browser cannot record video."));
  const { scene, sources } = bundle;
  const start = ms(scene.window.start);
  const end = ms(scene.window.end);
  const [W, H] = SIZE[format];
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("No 2D canvas."));
  const font = getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";
  const credit = `Sources: ${[...new Set(sources.map((s) => s.attribution))].join(" · ")}`;
  const site = SITE_URL.replace(/^https?:\/\//, "");
  const vertical = format === "9:16";

  const draw = (globe: HTMLCanvasElement) => {
    const { clock } = usePlayer.getState();
    // The globe, cropped to cover the frame.
    const scale = Math.max(W / globe.width, H / globe.height);
    const gw = globe.width * scale;
    const gh = globe.height * scale;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(globe, (W - gw) / 2, (H - gh) / 2, gw, gh);
    // Letterbox gradients so text reads on any part of the globe.
    const top = ctx.createLinearGradient(0, 0, 0, H * 0.25);
    top.addColorStop(0, "rgba(0,0,0,0.75)");
    top.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, W, H * 0.25);
    const bottom = ctx.createLinearGradient(0, H * 0.6, 0, H);
    bottom.addColorStop(0, "rgba(0,0,0,0)");
    bottom.addColorStop(1, "rgba(0,0,0,0.85)");
    ctx.fillStyle = bottom;
    ctx.fillRect(0, H * 0.6, W, H * 0.4);

    const pad = vertical ? 40 : 48;
    ctx.textBaseline = "top";
    ctx.fillStyle = "rgba(154,217,255,0.85)";
    ctx.font = `500 ${vertical ? 18 : 15}px ${font}`;
    ctx.fillText("Earthlog", pad, pad);
    ctx.fillStyle = "#f2f9ff";
    ctx.font = `600 ${vertical ? 40 : 34}px ${font}`;
    const titleLines = wrap(ctx, scene.title, W - pad * 2 - (vertical ? 0 : 320)).slice(0, 2);
    titleLines.forEach((l, i) => {
      ctx.fillText(l, pad, pad + 28 + i * (vertical ? 46 : 40));
    });
    ctx.fillStyle = "rgba(154,217,255,0.75)";
    ctx.font = `400 ${vertical ? 20 : 17}px ${font}`;
    ctx.fillText(scene.subtitle, pad, pad + 32 + titleLines.length * (vertical ? 46 : 40));

    // Chapter title.
    let chapter = scene.chapters[0]?.title ?? "";
    for (const c of scene.chapters) if (ms(c.t) <= clock.t) chapter = c.title;
    ctx.font = `300 ${vertical ? 30 : 30}px ${font}`;
    ctx.fillStyle = "#f2f9ff";
    if (vertical) ctx.fillText(chapter, pad, H * 0.2);
    else {
      const cw = ctx.measureText(chapter).width;
      ctx.fillText(chapter, W - pad - cw, pad + 6);
    }

    // The stats panels and the map legend, as on screen.
    const live = scene.panels.filter(
      (p) => clock.t >= ms(p.t) && (!p.until || clock.t < ms(p.until)),
    );
    if (live.length) {
      const pw = vertical ? W - pad * 2 : 340;
      let py = vertical ? H * 0.27 : pad + 70;
      const bottom = vertical ? H * 0.62 : H - pad - 150;
      for (const panel of live) {
        const ph = drawPanel(ctx, panel, 0, 0, pw, font, true);
        if (py + ph > bottom) break;
        drawPanel(ctx, panel, vertical ? pad : W - pad - pw, py, pw, font);
        py += ph + 10;
      }
    }
    let legendIndex = -1;
    scene.layers.forEach((r, i) => {
      if (r.kind !== "regions") return;
      const from = r.from ? ms(r.from) : Number.NEGATIVE_INFINITY;
      const until = r.until ? ms(r.until) : Number.POSITIVE_INFINITY;
      if (clock.t >= from && clock.t < until) legendIndex = i;
    });
    if (!vertical) drawLegend(ctx, bundle.layers[legendIndex], pad, H - pad - 150, font);

    // The caption, with its citation count.
    const beat = scene.beats[activeBeatIndex(clock.t, scene.beats)];
    if (beat) {
      ctx.font = `500 ${vertical ? 32 : 28}px ${font}`;
      const lines = wrap(ctx, beat.text, W - pad * 2 - (vertical ? 0 : 160));
      const lh = vertical ? 42 : 36;
      const y0 = H - pad - 70 - lines.length * lh;
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "rgba(0,0,0,0.8)";
      ctx.shadowBlur = 8;
      lines.forEach((l, i) => {
        const lw = ctx.measureText(l).width;
        ctx.fillText(l, (W - lw) / 2, y0 + i * lh);
      });
      ctx.shadowBlur = 0;
      ctx.font = `500 ${vertical ? 16 : 14}px ${font}`;
      ctx.fillStyle = "rgba(154,217,255,0.9)";
      const cites = `${beat.cites.length} cited source${beat.cites.length === 1 ? "" : "s"}`;
      const cw = ctx.measureText(cites).width;
      ctx.fillText(cites, (W - cw) / 2, y0 + lines.length * lh + 8);
    }

    // Credits and where to watch.
    ctx.font = `400 ${vertical ? 13 : 12}px ${font}`;
    ctx.fillStyle = "rgba(154,217,255,0.6)";
    const creditLines = wrap(ctx, credit, W - pad * 2).slice(0, 2);
    creditLines.forEach((l, i) => {
      ctx.fillText(l, pad, H - pad - 18 - (creditLines.length - 1 - i) * 16);
    });
    ctx.fillStyle = "rgba(242,249,255,0.85)";
    ctx.font = `600 ${vertical ? 16 : 14}px ${font}`;
    const sw = ctx.measureText(site).width;
    ctx.fillText(site, W - pad - sw, pad + (vertical ? 0 : 44));
  };

  return new Promise((resolve, reject) => {
    const stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    let unsubscribe = () => {};
    const finish = () => {
      unsubscribe();
      if (recorder.state !== "inactive") recorder.stop();
    };
    register(finish);
    recorder.onerror = () => {
      unsubscribe();
      reject(new Error("Recording failed."));
    };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `earthlog-${scene.id}-${format === "16:9" ? "landscape" : "vertical"}.${mimeType.includes("mp4") ? "mp4" : "webm"}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
      resolve();
    };

    // From the start, with the director's camera, at the film's own pace.
    const p = usePlayer.getState();
    p.setDirector(true);
    p.seekTo(start);
    if (!usePlayer.getState().clock.playing) p.togglePlay();
    recorder.start(1000);
    unsubscribe = onGlobeFrame((globe) => {
      draw(globe);
      const t = usePlayer.getState().clock.t;
      onProgress(Math.min(1, (t - start) / (end - start)));
      if (t >= end - 100) finish();
    });
  });
}
