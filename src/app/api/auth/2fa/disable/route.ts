import { NextRequest, NextResponse } from "next/server";
import { verifyJWT } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabaseServer";

export async function POST(request: NextRequest) {
  const token = request.cookies.get("auth_token")?.value;
  const authSecret = process.env.AUTH_SECRET;
  if (!token || !authSecret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = await verifyJWT(token, authSecret);
  if (!payload?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getAdminClient();
  const { error } = await db
    .from("users")
    .update({ totp_secret: null, totp_enabled: false })
    .eq("email", (payload.email as string).toLowerCase());

  if (error) {
    console.error("[2fa/disable]", error);
    return NextResponse.json({ error: "Не удалось отключить 2FA" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
