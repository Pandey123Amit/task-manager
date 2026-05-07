import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signupSchema } from "@/lib/validations";
import { jsonError, jsonZodError } from "@/lib/api-response";
import { signAuthToken } from "@/lib/auth-token";
import { Role } from "@/generated/prisma/enums";
import { logActivity } from "@/lib/activity";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) return jsonZodError(parsed.error);

  const { name, email, password } = parsed.data;

  const exists = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });
  if (exists) {
    return jsonError("An account with this email already exists", 409);
  }

  const hashed = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      name,
      email: email.toLowerCase(),
      password: hashed,
      role: Role.MEMBER,
    },
  });

  await logActivity(user.id, "SIGNUP", "User", user.id, { email: user.email });

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
