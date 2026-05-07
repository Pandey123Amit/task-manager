import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-token";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/enums";
import { memberEmailSchema } from "@/lib/validations";
import { jsonError, jsonOk, jsonZodError } from "@/lib/api-response";
import { logActivity, requireProjectAccess } from "@/lib/activity";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;
  if (auth.role !== Role.ADMIN) return jsonError("Forbidden", 403);

  const { id: projectId } = await ctx.params;
  const denied = await requireProjectAccess(auth, projectId);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const parsed = memberEmailSchema.safeParse(body);
  if (!parsed.success) return jsonZodError(parsed.error);

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
  });
  if (!user) {
    return jsonError("No user found with that email", 404);
  }

  const existing = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: { projectId, userId: user.id },
    },
  });
  if (existing) {
    return jsonError("User is already a project member", 409);
  }

  const member = await prisma.projectMember.create({
    data: { projectId, userId: user.id },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
    },
  });

  await logActivity(auth.id, "ADD_MEMBER", "Project", projectId, {
    userId: user.id,
  });

  return jsonOk({ member }, 201);
}
