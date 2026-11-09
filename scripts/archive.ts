// pnpm archive <command> (ADR-0027): move old editions' films to the archive repository.
//   plan                     the editions to archive today, one date per line
//   copy <date> <dir>        copy that edition's films (and index files) into a clone of the
//                            archive repository at <dir>
//   finalize <date> <base>   after the archive was pushed: write films.json (where the films
//                            went) and remove the films from this repository
// The nightly workflow runs plan, copy for each date, pushes the archive, then finalize: the
// films leave this repository only once the archive holds them.
import { access, cp, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ArchiveManifest, datesToArchive } from "../src/scene/archive.ts";
import { ROOT, writeJson } from "./bake/lib.ts";

const EDITIONS = join(ROOT, "public", "editions");
const exists = (p: string) =>
  access(p).then(
    () => true,
    () => false,
  );

const [command, ...args] = process.argv.slice(2);
const today = new Date().toISOString().slice(0, 10);

if (command === "plan") {
  const dates = (await readdir(EDITIONS).catch(() => [] as string[])).sort();
  for (const d of datesToArchive(dates, today))
    if (await exists(join(EDITIONS, d, "stories"))) console.log(d);
} else if (command === "copy") {
  const [date, dir] = args;
  if (!date || !dir) throw new Error("usage: archive copy <date> <archive-dir>");
  const from = join(EDITIONS, date);
  const to = join(dir, "editions", date);
  await cp(join(from, "stories"), join(to, "stories"), { recursive: true });
  for (const f of ["edition.json", "evidence.json", "sources.json"])
    if (await exists(join(from, f))) await cp(join(from, f), join(to, f));
  // GitHub Pages serves the files as they are (no Jekyll), and says what the site is.
  if (!(await exists(join(dir, ".nojekyll")))) await writeFile(join(dir, ".nojekyll"), "");
  if (!(await exists(join(dir, "index.html"))))
    await writeFile(
      join(dir, "index.html"),
      '<!doctype html><meta charset="utf-8"><title>Earthlog archive</title><p>Archived Earthlog films. Watch them on <a href="https://earthlog-abdi.vercel.app">Earthlog</a>.</p>\n',
    );
  console.log(`copied ${date} → ${to}`);
} else if (command === "finalize") {
  const [date, base] = args;
  if (!date || !base) throw new Error("usage: archive finalize <date> <base-url>");
  const stories = join(EDITIONS, date, "stories");
  const films = (await readdir(stories)).sort();
  const manifest = ArchiveManifest.parse({
    version: 1,
    base,
    films,
    archivedAt: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
  });
  await writeJson(join(EDITIONS, date, "films.json"), manifest);
  await rm(stories, { recursive: true, force: true });
  console.log(`archived ${date}: ${films.length} films at ${base}`);
} else {
  console.error("usage: pnpm archive plan | copy <date> <dir> | finalize <date> <base>");
  process.exit(1);
}
