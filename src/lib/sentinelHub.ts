// Sentinel-2 true-color imagery via Copernicus Data Space Ecosystem (free, EU public program).
// Requires a free account at https://dataspace.copernicus.eu/ and an OAuth client
// (Dashboard → Account settings → OAuth clients) — set COPERNICUS_CLIENT_ID /
// COPERNICUS_CLIENT_SECRET in .env.local.

const TOKEN_URL = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token";
const PROCESS_URL = "https://sh.dataspace.copernicus.eu/api/v1/process";

// Akmola region bounding box (lonMin, latMin, lonMax, latMax), WGS84 — covers all 28 hydroposts.
export const AKMOLA_BBOX: [number, number, number, number] = [65.8, 50.3, 73.6, 53.6];

const TRUE_COLOR_EVALSCRIPT = `//VERSION=3
function setup() {
  return { input: ["B02", "B03", "B04", "dataMask"], output: { bands: 4 } };
}
function evaluatePixel(sample) {
  return [sample.B04 * 2.5, sample.B03 * 2.5, sample.B02 * 2.5, sample.dataMask];
}`;

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 5_000) return cachedToken.value;

  const clientId = process.env.COPERNICUS_CLIENT_ID;
  const clientSecret = process.env.COPERNICUS_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("COPERNICUS_CLIENT_ID / COPERNICUS_CLIENT_SECRET не заданы в .env.local");
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!res.ok) throw new Error(`Copernicus auth failed: ${res.status} ${await res.text()}`);

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.value;
}

// Fetches one true-color PNG covering AKMOLA_BBOX, picking the least-cloudy
// Sentinel-2 scene from the last 15 days (Sentinel-2 revisits every ~5 days).
export async function fetchLatestSatelliteImage(): Promise<Buffer> {
  const token = await getAccessToken();
  const to = new Date();
  const from = new Date(to.getTime() - 15 * 24 * 60 * 60 * 1000);

  const res = await fetch(PROCESS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      input: {
        bounds: {
          bbox: AKMOLA_BBOX,
          properties: { crs: "http://www.opengis.net/def/crs/EPSG/0/4326" },
        },
        data: [
          {
            type: "sentinel-2-l2a",
            dataFilter: {
              timeRange: { from: from.toISOString(), to: to.toISOString() },
              maxCloudCoverage: 40,
              mosaickingOrder: "leastCC",
            },
          },
        ],
      },
      output: {
        width: 1600,
        height: 1100,
        responses: [{ identifier: "default", format: { type: "image/png" } }],
      },
      evalscript: TRUE_COLOR_EVALSCRIPT,
    }),
  });
  if (!res.ok) throw new Error(`Copernicus processing failed: ${res.status} ${await res.text()}`);

  return Buffer.from(await res.arrayBuffer());
}
