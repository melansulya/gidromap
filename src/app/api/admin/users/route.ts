import { NextRequest, NextResponse } from "next/server";
import { verifyJWT, getUsers } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabaseServer";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("auth_token")?.value;
  const secret = process.env.AUTH_SECRET;
  if (!token || !secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = await verifyJWT(token, secret);
  if (!payload || payload.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  type UserRow = { id: string; email: string; name: string; role: string; source: "env" | "db"; created_at: string | null };

  // Env-based users (without passwords)
  const envUsers: UserRow[] = getUsers().map(({ email, name, role }) => ({
    id: `env_${email}`,
    email,
    name,
    role,
    source: "env",
    created_at: null,
  }));

  // Supabase users
  let dbUsers: UserRow[] = [];
  try {
    const db = getAdminClient();
    const { data } = await db
      .from("users")
      .select("id, email, name, role, created_at")
      .order("created_at", { ascending: false });

    if (data) {
      dbUsers = data.map((u) => ({ ...u, source: "db" as const, created_at: u.created_at as string }));
    }
  } catch {
    // Supabase not set up yet — return env users only
  }

  return NextResponse.json([...envUsers, ...dbUsers]);
}

export async function DELETE(request: NextRequest) {
  const token = request.cookies.get("auth_token")?.value;
  const secret = process.env.AUTH_SECRET;
  if (!token || !secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = await verifyJWT(token, secret);
  if (!payload || payload.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await request.json() as { id: string };
  if (!id || id.startsWith("env_")) {
    return NextResponse.json({ error: "Нельзя удалить системного администратора" }, { status: 400 });
  }

  const db = getAdminClient();
  const { error } = await db.from("users").delete().eq("id", id);
  if (error) {
    console.error("[admin/users DELETE]", error);
    return NextResponse.json({ error: "Не удалось удалить пользователя" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
