import { NextResponse } from "next/server";
import { z } from "zod";
import { signJWT, verifyJWT, COOKIE_SECURE } from "@/lib/auth";
import { verifyTotp } from "@/lib/totp";
import { getAdminClient } from "@/lib/supabaseServer";
import { logActivity } from "@/lib/activityLog";

// Reuses the same brute-force protection pattern as /api/auth/login, keyed
// by email — a stolen tempToken alone isn't enough without also guessing
// the rotating 6-digit code.
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const ATTEMPT_MAX = 5;
const attempts = new Map<string, number[]>();

function isLocked(key: string): boolean {
  const now = Date.now();
  const hits = (attempts.get(key) ?? []).filter((t) => now - t < ATTEMPT_WINDOW_MS);
  attempts.set(key, hits);
  return hits.length >= ATTEMPT_MAX;
}
function recordFailure(key: string) {
  const now = Date.now();
  const hits = (attempts.get(key) ?? []).filter((t) => now - t < ATTEMPT_WINDOW_MS);
  hits.push(now);
  attempts.set(key, hits);
}

const BodySchema = z.object({
  tempToken: z.string().min(10),
  code: z.string().trim().length(6),
});

export async function POST(request: Request) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return NextResponse.json({ error: "AUTH_SECRET не настроен" }, { status: 500 });

  const json = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const payload = await verifyJWT(parsed.data.tempToken, secret);
  if (!payload?.pending2fa || !payload.email) {
    return NextResponse.json({ error: "Сессия входа истекла, начните заново" }, { status: 401 });
  }

  const email = payload.email as string;
  if (isLocked(email)) {
    return NextResponse.json(
      { error: "Слишком много неудачных попыток. Подождите 15 минут и попробуйте снова." },
      { status: 429 },
    );
  }

  const db = getAdminClient();
  const { data: user } = await db
    .from("users")
    .select("email, name, role, totp_secret, totp_enabled")
    .eq("email", email.toLowerCase())
    .single();

  if (!user?.totp_enabled || !user.totp_secret || !verifyTotp(email, user.totp_secret, parsed.data.code)) {
    recordFailure(email);
    return NextResponse.json({ error: "Неверный код" }, { status: 401 });
  }

  attempts.delete(email);

  const token = await signJWT({ email: user.email, name: user.name, role: user.role }, secret);
  const res = NextResponse.json({ ok: true });
  res.cookies.set("auth_token", token, {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  await logActivity({ email: user.email, name: user.name, role: user.role, action: "login" });
  return res;
}
