import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright";
import sharp from "sharp";
import { PRESETS, STARTING_POINTS, type PresetKey } from "../src/lib/studio/presets";
import { COLORS, type ColorKey, type DesignSpec } from "../src/lib/studio/spec";
import { STORY_STEPS, storyFrame, storyStage } from "../src/lib/home/story";
import { buildBag } from "../src/lib/studio/geometry";

const BASE_URL = process.env.RENDER_URL ?? "http://localhost:3000";
const STUDIO_DIR = path.join(process.cwd(), "public/images/studio");
const HERO_DIR = path.join(process.cwd(), "public/images/hero");
const FRAMES = Number(process.env.RENDER_FRAMES ?? 40);
const CATALOG_SIZE = Number(process.env.CATALOG_SIZE ?? 1600);
const STORY_SIZE = Number(process.env.STORY_SIZE ?? 1200);
const HERO_SIZE = Number(process.env.HERO_SIZE ?? 2048);
const MACRO_WIDTH = Number(process.env.MACRO_WIDTH ?? 2400);
const MACRO_HEIGHT = Number(process.env.MACRO_HEIGHT ?? 1600);
const STUDIO_GREY: [number, number, number] = [241, 241, 241];
const HERO_FORMS = ["tote", "satchel", "crossbody", "weekender"] as const;
const HERO_COLORS: ColorKey[] = ["cognac", "noir", "bordeaux", "navy", "tan"];

type Still = {
  spec: DesignSpec;
  width: number;
  height: number;
  frames: number;
  shadowFrames?: number;
  theta?: number;
  phi?: number;
  fov?: number;
  framing?: number;
  lift?: number;
  focus?: [number, number, number];
  distance?: number;
  aperture?: number;
  exposure?: number;
  background?: [number, number, number];
  variants?: { name: string; hex: string }[];
};

type Job = { name: string; files: Record<string, string>; still: Still; feather?: number };

async function featherEdges(image: Buffer, inset: number) {
  const { width = 0, height = 0 } = await sharp(image).metadata();
  const edge = Math.round(Math.min(width, height) * inset);
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><filter id="f"><feGaussianBlur stdDeviation="${edge / 2}"/></filter><rect x="${edge}" y="${edge}" width="${width - edge * 2}" height="${height - edge * 2}" fill="#fff" filter="url(#f)"/></svg>`,
  );
  return sharp(image).ensureAlpha().composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
}

function dress(spec: DesignSpec, color: ColorKey): DesignSpec {
  const { primary, gusset } = spec.panels;
  return { ...spec, panels: { ...spec.panels, primary: { ...primary, color }, gusset: { ...gusset, color } } };
}

const FRAMING: Partial<Record<PresetKey, { framing: number; lift: number }>> = {
  tote: { framing: 0.98, lift: 0 },
  satchel: { framing: 0.98, lift: 0 },
  crossbody: { framing: 0.96, lift: 0 },
  weekender: { framing: 0.98, lift: 0 },
};

function catalogJobs(): Job[] {
  return STARTING_POINTS.filter((point) => point.key !== "blank").map(({ key }) => ({
    name: key,
    files: { still: path.join(STUDIO_DIR, `${key}.webp`) },
    still: { spec: PRESETS[key], width: CATALOG_SIZE, height: CATALOG_SIZE, frames: FRAMES, exposure: PRESETS[key].panels.primary.color === "noir" ? 1.9 : undefined, ...FRAMING[key] },
  }));
}

function heroJobs(): Job[] {
  return HERO_FORMS.map((form) => ({
    name: form,
    files: Object.fromEntries(HERO_COLORS.map((color) => [color, path.join(HERO_DIR, `${form}-${color}.webp`)])),
    still: {
      spec: dress(PRESETS[form], "cognac"),
      width: HERO_SIZE,
      height: HERO_SIZE,
      frames: FRAMES,
      shadowFrames: 240,
      variants: HERO_COLORS.map((color) => ({ name: color, hex: COLORS[color].hex })),
      ...FRAMING[form],
    },
  }));
}

function macroJobs(): Job[] {
  const grainSpec = dress(PRESETS.tote, "cognac");
  const stitchSpec: DesignSpec = { ...dress(PRESETS.crossbody, "cognac"), stitch: { ...PRESETS.crossbody.stitch, thread: "ivory", length: 4 } };
  const macro = { width: MACRO_WIDTH, height: MACRO_HEIGHT, frames: FRAMES * 2, fov: 16 };
  return [
    { name: "macro-grain", files: { still: path.join(HERO_DIR, "macro-grain.webp") }, still: { ...macro, spec: grainSpec, focus: [-60, 120, 92], distance: 1.6, theta: -0.3, phi: 1.05, aperture: 0.012 } },
    { name: "macro-stitch", files: { still: path.join(HERO_DIR, "macro-stitch.webp") }, still: { ...macro, spec: stitchSpec, focus: [-96, 44, 36], distance: 1.2, theta: -0.75, phi: 1.2, aperture: 0.01 } },
  ];
}

const STILL_FOV = 26;
const STORY_FEATHER = 0.06;
const STORY_FRAMING = 1.12;

function storyJobs(): Job[] {
  const target = PRESETS.crossbody;
  const framing = STORY_FRAMING;
  const finished = buildBag(target);
  const distance = (finished.radius / Math.tan(((STILL_FOV / 2) * Math.PI) / 180)) * framing;
  return STORY_STEPS.map((step, index) => {
    const spec = storyStage(target, index);
    const bag = buildBag(spec);
    return {
      name: `story-${step}`,
      files: { still: path.join(process.cwd(), "public", storyFrame(index, step)) },
      still: { spec, width: STORY_SIZE, height: STORY_SIZE, frames: FRAMES, distance, lift: (finished.centerY - bag.centerY) / bag.radius },
      feather: STORY_FEATHER,
    };
  });
}

async function openPage(context: BrowserContext) {
  const page = await context.newPage();
  const tiles = process.env.MACRO_TILES;
  if (tiles) {
    await page.route("**/textures/*.webp", (route) => {
      const file = path.join(tiles, path.basename(new URL(route.request().url()).pathname));
      return existsSync(file) ? route.fulfill({ path: file, contentType: "image/webp" }) : route.continue();
    });
  }
  await page.goto(`${BASE_URL}/studio/render?preset=tote`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => "__occuinStill" in window, null, { timeout: 180_000 });
  return page;
}

async function renderJob(page: Page, job: Job) {
  const started = Date.now();
  const results = await page.evaluate(
    (still) => (window as unknown as { __occuinStill: (options: unknown) => Promise<Record<string, string>> }).__occuinStill(still),
    job.still,
  );
  for (const [name, url] of Object.entries(results)) {
    const file = job.files[name];
    if (!file) continue;
    const png = Buffer.from(url.slice(url.indexOf(",") + 1), "base64");
    await mkdir(path.dirname(file), { recursive: true });
    const finished = job.feather ? await featherEdges(png, job.feather) : png;
    await writeFile(file, await sharp(finished).webp({ quality: 90, alphaQuality: 95, effort: 5, smartSubsample: true }).toBuffer());
    console.log(`wrote ${path.relative(process.cwd(), file)}`);
  }
  console.log(`rendered ${job.name} in ${Math.round((Date.now() - started) / 1000)}s`);
}

async function main() {
  const wanted = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
  const sets = process.argv.slice(2).filter((arg) => arg.startsWith("--")).map((arg) => arg.slice(2));
  const groups = sets.length ? sets : ["catalog"];
  const jobs = [
    ...(groups.includes("catalog") ? catalogJobs() : []),
    ...(groups.includes("hero") ? heroJobs() : []),
    ...(groups.includes("macro") ? macroJobs() : []),
    ...(groups.includes("story") ? storyJobs() : []),
  ].filter((job) => !wanted.length || wanted.includes(job.name));

  const browser = await chromium.launch({
    channel: "chromium",
    args: ["--use-angle=swiftshader", "--use-gl=angle", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  });
  const context = await browser.newContext({ viewport: { width: 480, height: 480 }, colorScheme: "light", reducedMotion: "reduce" });
  const failures: string[] = [];

  for (const job of jobs) {
    let page: Page | null = null;
    try {
      page = await openPage(context);
      await renderJob(page, job);
    } catch (error) {
      failures.push(job.name);
      console.error(`failed ${job.name}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      await page?.close();
    }
  }

  await browser.close();
  if (failures.length) {
    console.error(`could not render: ${failures.join(", ")}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
