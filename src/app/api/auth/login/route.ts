import { NextResponse } from "next/server";
import { checkCredentials, signJWT } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { getAdminClient } from "@/lib/supabaseServer";
import { logActivity } from "@/lib/activityLog";

// Best-effort brute-force protection — in-memory, so it resets on server
// restart/redeploy and isn't shared across instances, but still raises the
// cost of a naive password-guessing script.
const LOGIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_ATTEMPT_MAX = 5;
const loginAttempts = new Map<string, number[]>();

function isLoginLocked(key: string): boolean {
  const now = Date.now();
  const hits = (loginAttempts.get(key) ?? []).filter((t) => now - t < LOGIN_ATTEMPT_WINDOW_MS);
  loginAttempts.set(key, hits);
  if (loginAttempts.size > 1000) {
    for (const [k, v] of loginAttempts) {
      if (v.every((t) => now - t > LOGIN_ATTEMPT_WINDOW_MS)) loginAttempts.delete(k);
    }
  }
  return hits.length >= LOGIN_ATTEMPT_MAX;
}

function recordLoginFailure(key: string) {
  const now = Date.now();
  const hits = (loginAttempts.get(key) ?? []).filter((t) => now - t < LOGIN_ATTEMPT_WINDOW_MS);
  hits.push(now);
  loginAttempts.set(key, hits);
}

function clearLoginFailures(key: string) {
  loginAttempts.delete(key);
}

export async function POST(request: Request) {
  const { email, password } = await request.json() as { email: string; password: string };
  if (!email || !password) {
    return NextResponse.json({ error: "Введите email и пароль" }, { status: 400 });
  }

  const attemptKey = email.trim().toLowerCase();
  if (isLoginLocked(attemptKey)) {
    return NextResponse.json(
      { error: "Слишком много неудачных попыток входа. Подождите 15 минут и попробуйте снова." },
      { status: 429 },
    );
  }

  const secret = process.env.AUTH_SECRET;
  if (!secret) return NextResponse.json({ error: "AUTH_SECRET не настроен" }, { status: 500 });

  // 1. Check env-based users (admin bootstrap)
  const envUser = checkCredentials(email.trim(), password);
  if (envUser) {
    const token = await signJWT({ email: envUser.email, name: envUser.name, role: envUser.role }, secret);
    const res = NextResponse.json({ ok: true });
    res.cookies.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    await logActivity({ email: envUser.email, name: envUser.name, role: envUser.role, action: "login" });
    clearLoginFailures(attemptKey);
    return res;
  }

  // 2. Check Supabase users table
  try {
    const db = getAdminClient();
    const { data: user } = await db
      .from("users")
      .select("email, name, role, password_hash, totp_enabled")
      .eq("email", email.trim().toLowerCase())
      .single();

    if (user && verifyPassword(password, user.password_hash)) {
      clearLoginFailures(attemptKey);

      if (user.totp_enabled) {
        // Password correct, but a second step is required before a real
        // session is issued. This token is only good for that one step.
        const pendingToken = await signJWT(
          { email: user.email, name: user.name, role: user.role, pending2fa: true },
          secret,
          5 * 60,
        );
        return NextResponse.json({ ok: true, needs2fa: true, tempToken: pendingToken });
      }

      const token = await signJWT({ email: user.email, name: user.name, role: user.role }, secret);
      const res = NextResponse.json({ ok: true });
      res.cookies.set("auth_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      });
      await logActivity({ email: user.email, name: user.name, role: user.role, action: "login" });
      return res;
    }
  } catch {
    // Supabase not configured — fall through to error
  }

  recordLoginFailure(attemptKey);
  return NextResponse.json({ error: "Неверный email или пароль" }, { status: 401 });
}
