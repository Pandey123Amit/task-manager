import jwt from "jsonwebtoken";
import type { NextRequest } from "next/server";
import type { SessionUser } from "@/types/auth";
import type { Role } from "@/generated/prisma/client";

const ALG = "HS256" as const;
const EXPIRES = "7d";

export function signAuthToken(user: {
  id: string;
  email: string;
  role: Role;
  name: string;
}) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set");
  }
  return jwt.sign(
    {
      email: user.email,
      role: user.role,
      name: user.name,
    },
    secret,
    {
      subject: user.id,
      expiresIn: EXPIRES,
      algorithm: ALG,
    },
  );
}

export function getAuthUser(req: NextRequest): SessionUser | null {
  const token = req.cookies.get("token")?.value;
  if (!token || !process.env.JWT_SECRET) return null;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: [ALG],
    }) as jwt.JwtPayload & {
      email: string;
      role: Role;
      name: string;
    };
    const id = payload.sub;
    if (
      typeof id !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.role !== "string" ||
      typeof payload.name !== "string"
    ) {
      return null;
    }
    return {
      id,
      email: payload.email,
      role: payload.role,
      name: payload.name,
    };
  } catch {
    return null;
  }
}

export function requireAuth(req: NextRequest): SessionUser | Response {
  const user = getAuthUser(req);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return user;
}
