import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-token";
import type { NextRequest } from "next/server";
import { logActivity } from "@/lib/activity";

export async function POST(req: NextRequest) {
  const auth = getAuthUser(req);
  if (auth) {
    await logActivity(auth.id, "LOGOUT", "User", auth.id);
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
