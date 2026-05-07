import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validations";
import { jsonError, jsonZodError } from "@/lib/api-response";
import { signAuthToken } from "@/lib/auth-token";
import { logActivity } from "@/lib/activity";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return jsonZodError(parsed.error);

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });
  if (!user) {
    return jsonError("Invalid email or password", 401);
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return jsonError("Invalid email or password", 401);
  }

  await logActivity(user.id, "LOGIN", "User", user.id);

  const token = signAuthToken({
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
  });

  const { password: _unused, ...safe } = user;
  void _unused;
  const res = NextResponse.json({ user: safe });
  res.cookies.set("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
