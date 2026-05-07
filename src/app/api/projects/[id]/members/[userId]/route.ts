import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-token";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/enums";
import { jsonError, jsonOk } from "@/lib/api-response";
import { logActivity, requireProjectAccess } from "@/lib/activity";

type Ctx = { params: Promise<{ id: string; userId: string }> };

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;
  if (auth.role !== Role.ADMIN) return jsonError("Forbidden", 403);

  const { id: projectId, userId } = await ctx.params;
  const denied = await requireProjectAccess(auth, projectId);
  if (denied) return denied;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { createdById: true },
  });
  if (!project) return jsonError("Project not found", 404);
  if (project.createdById === userId) {
    return jsonError("Cannot remove the project owner from members", 400);
  }

  const member = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: { projectId, userId },
    },
  });
  if (!member) return jsonError("Member not found", 404);

  await prisma.projectMember.delete({
    where: { id: member.id },
  });

  await logActivity(auth.id, "REMOVE_MEMBER", "Project", projectId, {
    userId,
  });

  return jsonOk({ ok: true });
}
