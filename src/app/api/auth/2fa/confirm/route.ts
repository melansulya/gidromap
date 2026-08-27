import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyJWT } from "@/lib/auth";
import { verifyTotp } from "@/lib/totp";
import { getAdminClient } from "@/lib/supabaseServer";

const BodySchema = z.object({
  secret: z.string().min(10).max(64),
  code: z.string().trim().length(6),
});

export async function POST(request: NextRequest) {
  const token = request.cookies.get("auth_token")?.value;
  const authSecret = process.env.AUTH_SECRET;
  if (!token || !authSecret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = await verifyJWT(token, authSecret);
  if (!payload?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректный код" }, { status: 400 });
  }

  const email = payload.email as string;
  if (!verifyTotp(email, parsed.data.secret, parsed.data.code)) {
    return NextResponse.json({ error: "Неверный код. Проверьте время на телефоне и попробуйте снова." }, { status: 400 });
  }

  const db = getAdminClient();
  const { error } = await db
    .from("users")
    .update({ totp_secret: parsed.data.secret, totp_enabled: true })
    .eq("email", email.toLowerCase());

  if (error) {
    console.error("[2fa/confirm]", error);
    return NextResponse.json({ error: "Не удалось включить 2FA" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
