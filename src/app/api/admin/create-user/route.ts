import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyJWT } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { getAdminClient } from "@/lib/supabaseServer";

const CreateUserSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(200),
  name: z.string().trim().min(1).max(200),
  role: z.enum(["akim", "deputy"]),
});

export async function POST(request: NextRequest) {
  const token = request.cookies.get("auth_token")?.value;
  const secret = process.env.AUTH_SECRET;
  if (!token || !secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = await verifyJWT(token, secret);
  if (!payload || payload.role !== "admin") {
    return NextResponse.json({ error: "Только администратор может создавать пользователей" }, { status: 403 });
  }

  const json = await request.json().catch(() => null);
  const parsed = CreateUserSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Заполните все поля корректно (пароль ≥ 6 символов)" }, { status: 400 });
  }
  const body = parsed.data;

  const db = getAdminClient();

  // Check duplicate
  const { data: existing } = await db
    .from("users")
    .select("id")
    .eq("email", body.email.toLowerCase())
    .single();

  if (existing) {
    return NextResponse.json({ error: "Пользователь с таким email уже существует" }, { status: 409 });
  }

  const password_hash = hashPassword(body.password);

  const { error } = await db.from("users").insert({
    email: body.email.trim().toLowerCase(),
    password_hash,
    name: body.name.trim(),
    role: body.role,
  });

  if (error) {
    console.error("[admin/create-user]", error);
    return NextResponse.json({ error: "Не удалось создать пользователя" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
