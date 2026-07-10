import { NextRequest, NextResponse } from "next/server";
import { verifyJWT } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("auth_token")?.value;
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const secret = process.env.AUTH_SECRET;
  if (!secret) return NextResponse.json({ error: "Not configured" }, { status: 500 });

  const payload = await verifyJWT(token, secret);
  if (!payload) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  return NextResponse.json({
    email: payload.email,
    name: payload.name,
    role: payload.role,
  });
}
