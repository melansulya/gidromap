// Serves the self-hosted 3D terrain (elevation) tiles, per region — each
// built once from Copernicus DEM (OpenTopography) into a Mapbox Terrain-RGB
// tile pyramid (data/{region}-terrain.mbtiles) with rio-rgbify. No live
// foreign API calls at runtime — just reading our own file(s). Kyzylorda's
// pyramid was built shallower (lower max zoom, COP90 instead of COP30) than
// Akmola's to keep the file small — see TERRAIN_ZOOM in AkmolaMap.tsx.

import path from "path";
import Database from "better-sqlite3";
import type { Region } from "./types";

const MBTILES_PATH: Record<Region, string> = {
  akmola: path.join(process.cwd(), "data", "akmola-terrain.mbtiles"),
  kyzylorda: path.join(process.cwd(), "data", "kyzylorda-terrain.mbtiles"),
};

const dbs = new Map<Region, InstanceType<typeof Database> | null>();

function getDb(region: Region) {
  if (dbs.has(region)) return dbs.get(region) ?? null;
  let database: InstanceType<typeof Database> | null;
  try {
    database = new Database(MBTILES_PATH[region], { readonly: true, fileMustExist: true });
  } catch {
    database = null;
  }
  dbs.set(region, database);
  return database;
}

// mbtiles stores tiles in TMS scheme (Y flipped from the standard XYZ
// convention MapLibre/web maps request tiles in).
export function getTerrainTile(region: Region, z: number, x: number, y: number): Buffer | null {
  const database = getDb(region);
  if (!database) return null;

  const tmsY = 2 ** z - 1 - y;
  const row = database
    .prepare("SELECT tile_data FROM tiles WHERE zoom_level = ? AND tile_column = ? AND tile_row = ?")
    .get(z, x, tmsY) as { tile_data: Buffer } | undefined;

  return row?.tile_data ?? null;
}
