#!/usr/bin/env node
/**
 * Fetches Akmola Oblast district boundaries from Overpass API (OpenStreetMap)
 * and saves them as public/akmola-districts.geojson
 *
 * Run once: node scripts/fetch-districts.js
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

// Kazakhstan admin_level: 4 = oblast, 6 = rayon/district
const QUERY = `[out:json][timeout:120];
area["name:ru"="Акмолинская область"]["admin_level"="4"]->.akmola;
rel["admin_level"="6"]["boundary"="administrative"](area.akmola);
out geom;`;

function overpassFetch(query) {
  return new Promise((resolve, reject) => {
    const body = 'data=' + encodeURIComponent(query);
    const opts = {
      hostname: 'overpass-api.de',
      path: '/api/interpreter',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(opts, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
        catch (e) { reject(new Error('JSON parse failed: ' + e.message)); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function ptEq(a, b, tol = 1e-6) {
  return Math.abs(a[0] - b[0]) < tol && Math.abs(a[1] - b[1]) < tol;
}

// Chain OSM way segments into closed rings
function chainWays(ways) {
  if (!ways.length) return [];
  const rem = ways.map(w => [...w]);
  const rings = [];

  while (rem.length > 0) {
    const ring = [...rem.shift()];
    let changed = true;
    while (changed && !ptEq(ring[0], ring[ring.length - 1])) {
      changed = false;
      for (let i = 0; i < rem.length; i++) {
        const w = rem[i];
        const tail = ring[ring.length - 1];
        if (ptEq(w[0], tail)) {
          ring.push(...w.slice(1)); rem.splice(i, 1); changed = true; break;
        }
        if (ptEq(w[w.length - 1], tail)) {
          ring.push(...[...w].reverse().slice(1)); rem.splice(i, 1); changed = true; break;
        }
      }
    }
    if (!ptEq(ring[0], ring[ring.length - 1])) ring.push(ring[0]); // force-close
    if (ring.length >= 4) rings.push(ring);
  }
  return rings;
}

function relToFeature(rel) {
  const outers = rel.members
    .filter(m => m.type === 'way' && m.role === 'outer' && m.geometry?.length >= 2)
    .map(m => m.geometry.map(pt => [pt.lon, pt.lat]));

  const inners = rel.members
    .filter(m => m.type === 'way' && m.role === 'inner' && m.geometry?.length >= 2)
    .map(m => m.geometry.map(pt => [pt.lon, pt.lat]));

  const outerRings = chainWays(outers);
  const innerRings = chainWays(inners);

  if (!outerRings.length) {
    console.warn(`  ⚠ No geometry for: ${rel.tags?.name || rel.id}`);
    return null;
  }

  const name = rel.tags['name:ru'] || rel.tags['name'] || `Район ${rel.id}`;

  const geometry = outerRings.length === 1
    ? { type: 'Polygon', coordinates: [outerRings[0], ...innerRings] }
    : { type: 'MultiPolygon', coordinates: outerRings.map(r => [r]) };

  return { type: 'Feature', properties: { id: rel.id, name }, geometry };
}

async function main() {
  console.log('Fetching Akmola Oblast districts from Overpass API...');
  const data = await overpassFetch(QUERY);
  const relations = (data.elements || []).filter(e => e.type === 'relation');
  console.log(`  Got ${relations.length} relations`);

  const features = relations.map(relToFeature).filter(Boolean);
  console.log(`  Converted ${features.length} features:`);
  features.forEach(f => console.log(`    · ${f.properties.name}`));

  const geojson = { type: 'FeatureCollection', features };
  const outPath = path.join(__dirname, '..', 'public', 'akmola-districts.geojson');
  fs.writeFileSync(outPath, JSON.stringify(geojson));
  console.log(`\nSaved → ${outPath}`);
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
