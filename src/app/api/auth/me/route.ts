import { NextRequest, NextResponse } from "next/server";
import { verifyJWT } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabaseServer";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("auth_token")?.value;
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const secret = process.env.AUTH_SECRET;
  if (!secret) return NextResponse.json({ error: "Not configured" }, { status: 500 });

  const payload = await verifyJWT(token, secret);
  if (!payload) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  let totpEnabled = false;
  try {
    const db = getAdminClient();
    const { data } = await db
      .from("users")
      .select("totp_enabled")
      .eq("email", (payload.email as string).toLowerCase())
      .single();
    totpEnabled = data?.totp_enabled ?? false;
  } catch {
    // env-based bootstrap user has no DB row — 2FA not available for it
  }

  return NextResponse.json({
    email: payload.email,
    name: payload.name,
    role: payload.role,
    totpEnabled,
  });
}
