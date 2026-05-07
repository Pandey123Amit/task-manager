import * as jose from "jose";
import { cookies } from "next/headers";
import type { SessionUser } from "@/types/auth";
import type { Role } from "@/generated/prisma/client";

function getSecretKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set");
  }
  return new TextEncoder().encode(secret);
}

export async function getSessionFromCookies(): Promise<SessionUser | null> {
  const token = (await cookies()).get("token")?.value;
  if (!token) return null;
  try {
    const { payload } = await jose.jwtVerify(token, getSecretKey(), {
      algorithms: ["HS256"],
    });
    const sub = payload.sub;
    if (
      typeof sub !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.role !== "string" ||
      typeof payload.name !== "string"
    ) {
      return null;
    }
    return {
      id: sub,
      email: payload.email,
      role: payload.role as Role,
      name: payload.name,
    };
  } catch {
    return null;
  }
}
