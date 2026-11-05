// Video clip export (PLAN.md Phase 19): record a story film in the browser, free, no server.
// Each globe frame is drawn onto a recording canvas with the film's title, chapter, caption,
// citation count and source credits burned in, so a clip shared anywhere still says where
// its facts come from. MediaRecorder captures the canvas in real time while the film plays
// from the start; landscape (16:9) or vertical (9:16, the globe cropped to the centre).
import { SITE_URL } from "@/config";
import { onGlobeFrame } from "@/globe/frames";
import { activeBeatIndex } from "@/scene/beats";
import { ms } from "@/scene/schema";
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
    ctx.fillText("E A R T H L O G", pad, pad);
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
