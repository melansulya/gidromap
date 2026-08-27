import { NextRequest, NextResponse } from "next/server";
import { verifyJWT } from "@/lib/auth";
import { generateSecret, otpauthUrl } from "@/lib/totp";

// Generates a candidate secret for the logged-in user. Not persisted yet —
// only /api/auth/2fa/confirm saves it, once the user proves they scanned it
// correctly by submitting a valid code.
export async function POST(request: NextRequest) {
  const token = request.cookies.get("auth_token")?.value;
  const secret = process.env.AUTH_SECRET;
  if (!token || !secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = await verifyJWT(token, secret);
  if (!payload?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const totpSecret = generateSecret();
  return NextResponse.json({
    secret: totpSecret,
    otpauthUrl: otpauthUrl(payload.email as string, totpSecret),
  });
}
