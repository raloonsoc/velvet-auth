/**
 * Generates docs/banner.png from docs/banner.html.
 * Automatically syncs the version number from package.json.
 *
 * Usage:
 *   bun scripts/gen-banner.ts
 */

import { chromium } from "playwright";
import { join } from "path";

const root = join(import.meta.dir, "..");

// ── 1. Read current version ───────────────────────────────────────────
const pkg = JSON.parse(await Bun.file(join(root, "package.json")).text());
const version = `v${pkg.version}`;

// ── 2. Update version in HTML ─────────────────────────────────────────
const htmlPath = join(root, "docs", "banner.html");
let html = await Bun.file(htmlPath).text();

const marker = /<span data-version>v[\d.]+<\/span>/;
if (!marker.test(html))
  throw new Error("<span data-version> marker not found in HTML");

const updated = html.replace(marker, `<span data-version>${version}</span>`);

await Bun.write(htmlPath, updated);
console.log(`✓ HTML updated → ${version}`);

// ── 3. Screenshot with Playwright ─────────────────────────────────────
const browser = await chromium.launch();
const page = await browser.newPage();

await page.setViewportSize({ width: 1280, height: 640 });
await page.goto(`file://${htmlPath}`);

// Wait for Google Fonts to load (falls back silently on CI with no network)
await page.waitForLoadState("networkidle").catch(() => {});
await page.waitForTimeout(400);

const outPath = join(root, "docs", "banner.png");
await page.screenshot({
  path: outPath,
  clip: { x: 0, y: 0, width: 1280, height: 640 },
});

await browser.close();
console.log(`✓ Banner saved → docs/banner.png`);
