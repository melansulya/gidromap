import { NextResponse } from "next/server";
import { checkCredentials, signJWT } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { getAdminClient } from "@/lib/supabaseServer";
import { logActivity } from "@/lib/activityLog";

export async function POST(request: Request) {
  const { email, password } = await request.json() as { email: string; password: string };
  if (!email || !password) {
    return NextResponse.json({ error: "Введите email и пароль" }, { status: 400 });
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
    return res;
  }

  // 2. Check Supabase users table
  try {
    const db = getAdminClient();
    const { data: user } = await db
      .from("users")
      .select("email, name, role, password_hash")
      .eq("email", email.trim().toLowerCase())
      .single();

    if (user && verifyPassword(password, user.password_hash)) {
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

  return NextResponse.json({ error: "Неверный email или пароль" }, { status: 401 });
}
