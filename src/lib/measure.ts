import type { WaterObject } from "@/lib/types";

export type PolylineWaterObject = WaterObject & {
  geometry: "polyline";
  coordinates: [number, number][];
};

export type MeasurePoint = {
  objectId: string;
  coordinates: [number, number];
};

export type MeasureResult =
  | { status: "success"; objectName: string; distanceKm: number }
  | { status: "error"; message: string };

export type WaterTraceResult = {
  distanceKm: number;
  labelA: string;
  labelB: string;
  connected: boolean;
  path?: [number, number][]; // route coordinates along water network (only when connected)
};

// ─── Geometry helpers ────────────────────────────────────────────────────────

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

export function haversineKm(
  [lng1, lat1]: [number, number],
  [lng2, lat2]: [number, number],
): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function toLocalKm([lng, lat]: [number, number], refLat: number) {
  const kmPerLat = 111.32;
  const kmPerLng = 111.32 * Math.cos(toRad(refLat));
  return { x: lng * kmPerLng, y: lat * kmPerLat };
}

// ─── Project a point onto a polyline ─────────────────────────────────────────

export function projectPointToPolyline(
  line: [number, number][],
  point: [number, number],
): { projected: [number, number]; chainageKm: number; segmentIndex: number; totalLengthKm: number } | null {
  if (line.length < 2) return null;

  let bestDist = Infinity;
  let bestProjected: [number, number] = line[0];
  let bestChainage = 0;
  let bestSegment = 0;
  let traversed = 0;

  for (let i = 0; i < line.length - 1; i++) {
    const start = line[i];
    const end = line[i + 1];
    const segLen = haversineKm(start, end);
    const refLat = (start[1] + end[1] + point[1]) / 3;
    const s = toLocalKm(start, refLat);
    const e = toLocalKm(end, refLat);
    const p = toLocalKm(point, refLat);
    const dx = e.x - s.x;
    const dy = e.y - s.y;
    const lenSq = dx * dx + dy * dy;
    const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - s.x) * dx + (p.y - s.y) * dy) / lenSq));
    const proj: [number, number] = [start[0] + (end[0] - start[0]) * t, start[1] + (end[1] - start[1]) * t];
    const dist = haversineKm(point, proj);
    if (dist < bestDist) {
      bestDist = dist;
      bestProjected = proj;
      bestChainage = traversed + segLen * t;
      bestSegment = i;
    }
    traversed += segLen;
  }

  return { projected: bestProjected, chainageKm: bestChainage, segmentIndex: bestSegment, totalLengthKm: traversed };
}

// ─── Polyline graph ───────────────────────────────────────────────────────────

type Edge = { to: string; weightKm: number; objectId: string };

type Graph = {
  adj: Map<string, Edge[]>;
  seq: Map<string, { keys: string[]; cum: number[] }>;
  pts: Map<string, [number, number]>;
};

function coordKey([lng, lat]: [number, number]) {
  return `${lng.toFixed(5)}:${lat.toFixed(5)}`;
}

export function buildGraph(objects: PolylineWaterObject[]): Graph {
  const threshold = 0.15;
  // Grid cell size slightly larger than threshold so a 3×3 neighbor check covers all
  // points within threshold distance. 0.002 deg ≈ 0.22 km > threshold.
  const CELL = 0.002;
  const adj = new Map<string, Edge[]>();
  const seq = new Map<string, { keys: string[]; cum: number[] }>();
  const pts = new Map<string, [number, number]>();
  const namedEndpoints = new Map<string, { key: string; pt: [number, number]; oid: string }[]>();

  // Spatial hash: one representative node per grid cell → O(1) resolveNode instead of O(n)
  const grid = new Map<string, string>(); // gridKey → nodeKey
  const nodePts = new Map<string, [number, number]>(); // nodeKey → coords

  function gk([lng, lat]: [number, number], dx = 0, dy = 0) {
    return `${Math.round(lng / CELL) + dx}:${Math.round(lat / CELL) + dy}`;
  }

  function resolveNode(pt: [number, number]): string {
    // Check 3×3 neighborhood for an existing node within threshold
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const existing = grid.get(gk(pt, dx, dy));
        if (existing && haversineKm(nodePts.get(existing)!, pt) <= threshold) return existing;
      }
    }
    const key = coordKey(pt);
    grid.set(gk(pt), key);
    nodePts.set(key, pt);
    pts.set(key, pt);
    return key;
  }

  function addEdge(from: string, to: string, w: number, oid: string) {
    const list = adj.get(from) ?? [];
    if (!list.some((e) => e.to === to && e.objectId === oid && Math.abs(e.weightKm - w) < 0.001)) {
      list.push({ to, weightKm: w, objectId: oid });
    }
    adj.set(from, list);
  }

  for (const obj of objects) {
    if (obj.coordinates.length < 2) continue;
    const keys = obj.coordinates.map((pt) => resolveNode(pt));
    const cum = [0];
    pts.set(keys[0], obj.coordinates[0]);
    pts.set(keys[keys.length - 1], obj.coordinates[obj.coordinates.length - 1]);

    for (let i = 0; i < obj.coordinates.length - 1; i++) {
      const w = haversineKm(obj.coordinates[i], obj.coordinates[i + 1]);
      cum.push(cum[i] + w);
      addEdge(keys[i], keys[i + 1], w, obj.id);
      addEdge(keys[i + 1], keys[i], w, obj.id);
    }
    seq.set(obj.id, { keys, cum });

    const norm = obj.name.toLowerCase().replace(/\s+/g, " ").trim();
    if (norm) {
      const eps = namedEndpoints.get(norm) ?? [];
      eps.push(
        { key: keys[0], pt: obj.coordinates[0], oid: obj.id },
        { key: keys[keys.length - 1], pt: obj.coordinates[obj.coordinates.length - 1], oid: obj.id },
      );
      namedEndpoints.set(norm, eps);
    }
  }

  // Soft bridges between segments of the same river
  for (const eps of namedEndpoints.values()) {
    for (let a = 0; a < eps.length; a++) {
      for (let b = a + 1; b < eps.length; b++) {
        if (eps[a].oid === eps[b].oid || eps[a].key === eps[b].key) continue;
        const gap = haversineKm(eps[a].pt, eps[b].pt);
        if (gap <= 4) {
          addEdge(eps[a].key, eps[b].key, gap, "__bridge__");
          addEdge(eps[b].key, eps[a].key, gap, "__bridge__");
        }
      }
    }
  }

  return { adj, seq, pts };
}

// ─── Dijkstra between two projected points ───────────────────────────────────

export function measureDistance(
  graph: Graph,
  startObj: PolylineWaterObject,
  startProj: NonNullable<ReturnType<typeof projectPointToPolyline>>,
  endObj: PolylineWaterObject,
  endProj: NonNullable<ReturnType<typeof projectPointToPolyline>>,
): number | null {
  const startSeq = graph.seq.get(startObj.id);
  const endSeq = graph.seq.get(endObj.id);
  if (!startSeq || !endSeq) return null;

  const TS = "__ms__";
  const TE = "__me__";
  const adj = new Map(graph.adj);

  const si = Math.min(startProj.segmentIndex, startSeq.keys.length - 2);
  const ei = Math.min(endProj.segmentIndex, endSeq.keys.length - 2);

  adj.set(TS, [
    { to: startSeq.keys[si], weightKm: startProj.chainageKm - startSeq.cum[si], objectId: startObj.id },
    { to: startSeq.keys[si + 1], weightKm: startSeq.cum[si + 1] - startProj.chainageKm, objectId: startObj.id },
  ]);

  function linkToEnd(nodeKey: string, w: number) {
    const list = [...(adj.get(nodeKey) ?? [])];
    list.push({ to: TE, weightKm: w, objectId: endObj.id });
    adj.set(nodeKey, list);
  }
  linkToEnd(endSeq.keys[ei], endProj.chainageKm - endSeq.cum[ei]);
  linkToEnd(endSeq.keys[ei + 1], endSeq.cum[ei + 1] - endProj.chainageKm);
  adj.set(TE, []);

  if (startObj.id === endObj.id) {
    const direct = adj.get(TS)!;
    direct.push({ to: TE, weightKm: Math.abs(startProj.chainageKm - endProj.chainageKm), objectId: startObj.id });
  }

  // Dijkstra
  const dist = new Map<string, number>([[TS, 0]]);
  const visited = new Set<string>();
  const queue = new Set<string>([TS]);

  while (queue.size > 0) {
    let cur: string | null = null;
    let curDist = Infinity;
    for (const n of queue) {
      const d = dist.get(n) ?? Infinity;
      if (d < curDist) { cur = n; curDist = d; }
    }
    if (!cur) break;
    queue.delete(cur);
    if (cur === TE) return curDist;
    if (visited.has(cur)) continue;
    visited.add(cur);
    for (const edge of adj.get(cur) ?? []) {
      const nd = curDist + edge.weightKm;
      if (nd < (dist.get(edge.to) ?? Infinity)) {
        dist.set(edge.to, nd);
        queue.add(edge.to);
      }
    }
  }
  return null;
}

// ─── Water path trace with route reconstruction ───────────────────────────────

export function measureWaterPath(
  graph: Graph,
  startObj: PolylineWaterObject,
  startProj: NonNullable<ReturnType<typeof projectPointToPolyline>>,
  endObj: PolylineWaterObject,
  endProj: NonNullable<ReturnType<typeof projectPointToPolyline>>,
): { distanceKm: number; path: [number, number][] } | null {
  const startSeq = graph.seq.get(startObj.id);
  const endSeq = graph.seq.get(endObj.id);
  if (!startSeq || !endSeq) return null;

  const TS = "__mws__";
  const TE = "__mwe__";
  const adj = new Map(graph.adj);

  const si = Math.min(startProj.segmentIndex, startSeq.keys.length - 2);
  const ei = Math.min(endProj.segmentIndex, endSeq.keys.length - 2);

  adj.set(TS, [
    { to: startSeq.keys[si], weightKm: Math.abs(startProj.chainageKm - startSeq.cum[si]), objectId: startObj.id },
    { to: startSeq.keys[si + 1], weightKm: Math.abs(startSeq.cum[si + 1] - startProj.chainageKm), objectId: startObj.id },
  ]);

  function linkToEnd(nodeKey: string, w: number) {
    const list = [...(adj.get(nodeKey) ?? [])];
    list.push({ to: TE, weightKm: Math.abs(w), objectId: endObj.id });
    adj.set(nodeKey, list);
  }
  linkToEnd(endSeq.keys[ei], endProj.chainageKm - endSeq.cum[ei]);
  linkToEnd(endSeq.keys[ei + 1], endSeq.cum[ei + 1] - endProj.chainageKm);
  adj.set(TE, []);

  if (startObj.id === endObj.id) {
    const direct = adj.get(TS)!;
    direct.push({ to: TE, weightKm: Math.abs(startProj.chainageKm - endProj.chainageKm), objectId: startObj.id });
  }

  const dist = new Map<string, number>([[TS, 0]]);
  const prev = new Map<string, string>(); // node → predecessor
  const visited = new Set<string>();
  const queue = new Set<string>([TS]);
  const MAX_EXPLORE = 20_000; // safety limit to avoid UI freeze on disconnected graphs
  let explored = 0;

  while (queue.size > 0 && explored < MAX_EXPLORE) {
    let cur: string | null = null;
    let curDist = Infinity;
    for (const n of queue) {
      const d = dist.get(n) ?? Infinity;
      if (d < curDist) { cur = n; curDist = d; }
    }
    if (!cur) break;
    queue.delete(cur);
    if (cur === TE) break;
    if (visited.has(cur)) continue;
    visited.add(cur);
    explored++;
    for (const edge of adj.get(cur) ?? []) {
      const nd = curDist + edge.weightKm;
      if (nd < (dist.get(edge.to) ?? Infinity)) {
        dist.set(edge.to, nd);
        prev.set(edge.to, cur);
        queue.add(edge.to);
      }
    }
  }

  const totalDist = dist.get(TE);
  if (totalDist === undefined || totalDist >= Infinity) return null;

  // Reconstruct path from predecessor chain (TE → TS, then reverse)
  const nodeKeys: string[] = [];
  let walk: string | undefined = prev.get(TE);
  while (walk && walk !== TS) {
    nodeKeys.push(walk);
    walk = prev.get(walk);
  }
  nodeKeys.reverse();

  // Map node keys to actual coordinates via graph.pts
  const path: [number, number][] = [startProj.projected];
  for (const k of nodeKeys) {
    const pt = graph.pts.get(k);
    if (pt) path.push(pt);
  }
  path.push(endProj.projected);

  return { distanceKm: totalDist, path };
}
