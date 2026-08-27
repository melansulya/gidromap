// Disk cache for the latest Sentinel-2 image — always overwrites the same file,
// so storage never grows unbounded. Refreshed at most every REFRESH_INTERVAL_MS
// (Sentinel-2 revisits Akmola roughly every 5 days, no point checking more often).

import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { AKMOLA_BBOX, fetchLatestSatelliteImage } from "./sentinelHub";

const CACHE_DIR = path.join(process.cwd(), ".cache", "satellite");
const IMAGE_PATH = path.join(CACHE_DIR, "latest.png");
const META_PATH = path.join(CACHE_DIR, "meta.json");
const REFRESH_INTERVAL_MS = 5 * 24 * 60 * 60 * 1000;

type Meta = { fetchedAt: number; bbox: [number, number, number, number] };

let refreshPromise: Promise<void> | null = null;

async function readMeta(): Promise<Meta | null> {
  try {
    return JSON.parse(await readFile(META_PATH, "utf8")) as Meta;
  } catch {
    return null;
  }
}

async function refresh(): Promise<void> {
  const image = await fetchLatestSatelliteImage();
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(IMAGE_PATH, image);
  const meta: Meta = { fetchedAt: Date.now(), bbox: AKMOLA_BBOX };
  await writeFile(META_PATH, JSON.stringify(meta));
}

// Returns current metadata, refreshing first if there's no cached image yet.
// If a (stale) image already exists, it's served immediately while a fresh
// one downloads in the background — callers just see fetchedAt update later.
export async function getSatelliteMeta(): Promise<Meta> {
  const meta = await readMeta();
  const stale = !meta || Date.now() - meta.fetchedAt > REFRESH_INTERVAL_MS;

  if (stale && !refreshPromise) {
    refreshPromise = refresh().finally(() => {
      refreshPromise = null;
    });
  }
  if (!meta) await refreshPromise;

  return (await readMeta()) ?? { fetchedAt: 0, bbox: AKMOLA_BBOX };
}

export async function getSatelliteImage(): Promise<Buffer | null> {
  try {
    return await readFile(IMAGE_PATH);
  } catch {
    return null;
  }
}
