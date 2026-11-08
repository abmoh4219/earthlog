// pnpm direct <date> [slug] [--ai] [--max-usd=0.25]
// Rewrites an edition's story-film captions with Claude (Haiku 5.5), chapter by chapter, from
// the evidence each chapter already cites. Without --ai, or without a working key, the
// template captions stay: nothing breaks (CLAUDE.md §3.3–3.4).
// Spend: one request per story, prompt-cached system prompt, cost printed per story and in
// total, and a hard ceiling per run (--max-usd, default $0.25): past it, the rest stay template.
// The key is read from .env (gitignored) or the environment, by the SDK only; never printed.
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { Edition } from "../src/scene/edition.ts";
import { Evidence, Scene, Source } from "../src/scene/schema.ts";
import { validateBundle } from "../src/scene/validate.ts";
import { ROOT, readJson, writeJson } from "./bake/lib.ts";
import {
  applyDirection,
  chapterInputs,
  checkChapter,
  costUsd,
  Direction,
  MODEL,
  SYSTEM,
  storyPrompt,
} from "./director/claude.ts";
import { report } from "./report.ts";

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")).map((a) => a.split("=")[0]));
const [date, only] = args.filter((a) => !a.startsWith("--"));
const maxUsd = Number(args.find((a) => a.startsWith("--max-usd="))?.split("=")[1] ?? 0.25);
if (!date) throw new Error("usage: pnpm direct <date> [slug] [--ai] [--max-usd=0.25]");
const dir = join(ROOT, "public", "editions", date);

try {
  process.loadEnvFile(join(ROOT, ".env"));
} catch {
  // No .env: the environment may still hold the key; if not, the template stays.
}
const ai = flags.has("--ai") && Boolean(process.env.ANTHROPIC_API_KEY);
if (flags.has("--ai") && !ai) {
  console.log("No ANTHROPIC_API_KEY: template captions kept.");
  report(`- Narration ${date}: no API key, every film keeps its template narration`);
}
if (!ai) {
  console.log("Template mode: nothing to do (run with --ai to direct with Claude).");
  process.exit(0);
}
const client = new Anthropic();

const edition = Edition.parse(await readJson(join(dir, "edition.json")));
const filmed = new Set(await readdir(join(dir, "stories")));
let spent = 0;
let keyRejected = false;
let directed = 0;
for (const story of edition.stories) {
  if ((only && story.slug !== only) || !filmed.has(story.slug)) continue;
  if (keyRejected) {
    console.log(`· ${story.slug}: API key rejected earlier this run, template kept`);
    continue;
  }
  if (spent >= maxUsd) {
    console.log(`· ${story.slug}: ceiling $${maxUsd} reached, template kept`);
    continue;
  }
  const base = join(dir, "stories", story.slug);
  const scene = Scene.parse(await readJson(join(base, "scene.json")));
  const evidence = z.array(Evidence).parse(await readJson(join(base, "evidence.json")));
  const sources = z.array(Source).parse(await readJson(join(base, "sources.json")));
  // Always direct from the template's captions (re-running never compounds rewrites).
  const template = scene.generatedBy.method === "template" ? scene : undefined;
  if (!template) {
    console.log(`· ${story.slug}: already directed; re-run pnpm stories first to re-direct`);
    continue;
  }
  const inputs = chapterInputs(template, evidence);
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: storyPrompt(template, story.lens, inputs) },
  ];

  // Same model, same instructions, same film: reuse the answer (the nightly job re-films the
  // last three editions; unchanged films then cost nothing). Kept in .cache/ (gitignored).
  const key = createHash("sha256")
    .update(`${MODEL}\n${SYSTEM}\n${String(messages[0]?.content)}`)
    .digest("hex")
    .slice(0, 24);
  const cacheFile = join(ROOT, ".cache", "direct", `${key}.json`);
  let cached: Direction | undefined;
  try {
    cached = Direction.parse(JSON.parse(await readFile(cacheFile, "utf8")));
  } catch {
    // Not directed before.
  }
  let best: Direction | undefined = cached;
  let storyCost = 0;
  // Up to 2 retries, each told exactly which chapters failed and why.
  for (let attempt = 0; !cached && attempt < 3 && spent + storyCost < maxUsd; attempt++) {
    try {
      const res = await client.messages.parse({
        model: MODEL,
        max_tokens: 8000,
        // Captions are a short rewrite: low effort is enough and keeps the cost down.
        output_config: { effort: "low", format: zodOutputFormat(Direction) },
        cache_control: { type: "ephemeral" },
        system: SYSTEM,
        messages,
      });
      storyCost += costUsd(res.usage);
      if (res.stop_reason === "refusal" || !res.parsed_output) break;
      best = res.parsed_output;
      const failures = inputs.flatMap((input, i) => {
        const errors = checkChapter(input, best?.chapters[i]);
        return errors.length ? [`"${input.title}": ${errors.join("; ")}`] : [];
      });
      if (!failures.length) break;
      messages.push({ role: "assistant", content: JSON.stringify(best) });
      messages.push({
        role: "user",
        content: `These chapters broke the rules; fix only them and return the full JSON again:\n${failures.join("\n")}`,
      });
    } catch (err) {
      // Expired key, rate limit, network: the template stays (CLAUDE.md §3.4). A rejected key
      // (401/403) won't recover this run, so the remaining films skip Claude straight away.
      if (
        err instanceof Anthropic.AuthenticationError ||
        err instanceof Anthropic.PermissionDeniedError
      )
        keyRejected = true;
      const status = err instanceof Anthropic.APIError ? ` (${err.status})` : "";
      console.log(`· ${story.slug}: Claude unavailable${status}, template kept`);
      break;
    }
  }
  spent += storyCost;
  if (best && !cached) {
    await mkdir(join(ROOT, ".cache", "direct"), { recursive: true });
    await writeFile(cacheFile, JSON.stringify(best));
  }
  if (!best) continue;

  const { scene: directedScene, accepted, rejected } = applyDirection(template, inputs, best);
  const out: Scene = {
    ...directedScene,
    generatedBy: {
      method: "claude",
      model: MODEL,
      at: template.generatedBy.at,
      costUsd: Math.round(storyCost * 1e6) / 1e6,
    },
  };
  const errors = validateBundle({ scene: Scene.parse(out), evidence, sources });
  if (errors.length || accepted === 0) {
    console.log(
      `✗ ${story.slug}: ${errors.join("; ") || "no chapter passed"}; template kept ($${storyCost.toFixed(4)})`,
    );
    continue;
  }
  await writeJson(join(base, "scene.json"), out);
  directed++;
  const lens = best.lens_check.fits
    ? ""
    : `  lens? ${best.lens_check.better_lens}: ${best.lens_check.reason}`;
  console.log(
    `✓ ${story.slug.padEnd(44)} ${accepted}/${inputs.length} chapters by Claude, $${storyCost.toFixed(4)}${rejected.length ? `  (template kept: ${rejected.map((r) => r.title).join(", ")})` : ""}${lens}`,
  );
}
console.log(
  `\n${directed} films directed by ${MODEL}; total $${spent.toFixed(4)} (ceiling $${maxUsd}).`,
);
report(
  keyRejected
    ? `- Narration ${date}: **the API key was rejected (expired or invalid)**; films keep their template narration. Renew the ANTHROPIC_API_KEY secret.`
    : `- Narration ${date}: ${directed} films directed by ${MODEL}, $${spent.toFixed(4)} (ceiling $${maxUsd})`,
);
