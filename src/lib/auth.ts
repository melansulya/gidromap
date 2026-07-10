// Edge-compatible JWT using Web Crypto API (no external dependencies)

const ALG = { name: "HMAC", hash: "SHA-256" } as const;

// UTF-8 aware base64url (handles Cyrillic and other Unicode)
function b64url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function b64urlBytes(bytes: Uint8Array): string {
  return btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(""))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function fromb64url(str: string): string {
  const bytes = Uint8Array.from(atob(str.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function fromb64urlBytes(str: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(str.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
}

async function getKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    ALG,
    false,
    ["sign", "verify"],
  );
}

export async function signJWT(payload: object, secret: string): Promise<string> {
  const key = await getKey(secret);
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify({ ...payload, iat: now, exp: now + 60 * 60 * 24 * 7 }));
  const raw = await crypto.subtle.sign(ALG, key, new TextEncoder().encode(`${header}.${body}`));
  return `${header}.${body}.${b64urlBytes(new Uint8Array(raw))}`;
}

export async function verifyJWT(token: string, secret: string): Promise<Record<string, unknown> | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, body, sigStr] = parts;
    const key = await getKey(secret);
    const sigBytes = fromb64urlBytes(sigStr);
    const ok = await crypto.subtle.verify(ALG, key, sigBytes, new TextEncoder().encode(`${header}.${body}`));
    if (!ok) return null;
    const payload = JSON.parse(fromb64url(body)) as Record<string, unknown>;
    if (typeof payload.exp === "number" && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// ── User management from AUTH_USERS env var ───────────────────────────────────

export type AuthUser = {
  email: string;
  password: string;
  name: string;
  role: "admin" | "akim" | "deputy";
};

export function getUsers(): AuthUser[] {
  const raw = process.env.AUTH_USERS;
  if (!raw) return [];
  try {
    return JSON.parse(raw) as AuthUser[];
  } catch {
    return [];
  }
}

export function checkCredentials(email: string, password: string): Omit<AuthUser, "password"> | null {
  const user = getUsers().find(
    (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password,
  );
  if (!user) return null;
  return { email: user.email, name: user.name, role: user.role };
}

export async function getAuthFromToken(
  token: string | undefined,
  secret: string | undefined,
): Promise<{ email: string; name: string; role: "admin" | "akim" | "deputy" } | null> {
  if (!token || !secret) return null;
  const payload = await verifyJWT(token, secret);
  if (!payload) return null;
  return payload as { email: string; name: string; role: "admin" | "akim" | "deputy" };
}
