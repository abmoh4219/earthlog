// Copies Cesium's runtime assets (web workers, textures, the star map, widget CSS)
// into public/cesium so Next.js can serve them statically. Cesium loads these by
// URL at runtime from window.CESIUM_BASE_URL; they cannot be bundled.
// Skips the copy when the installed Cesium version is already in place.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const src = join(root, "node_modules", "cesium", "Build", "Cesium");
const dest = join(root, "public", "cesium");
const stamp = join(dest, ".version");

const { version } = JSON.parse(
  readFileSync(join(root, "node_modules", "cesium", "package.json"), "utf8"),
) as { version: string };

if (existsSync(stamp) && readFileSync(stamp, "utf8") === version) {
  process.exit(0);
}

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
for (const dir of ["Workers", "ThirdParty", "Assets", "Widgets"]) {
  cpSync(join(src, dir), join(dest, dir), { recursive: true });
}
writeFileSync(stamp, version);
console.log(`cesium assets ${version} → public/cesium`);
