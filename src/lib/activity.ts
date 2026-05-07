import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/types/auth";
import { Role } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

export async function logActivity(
  userId: string,
  action: string,
  entity: string,
  entityId?: string | null,
  metadata?: Prisma.InputJsonValue | null,
) {
  try {
    await prisma.activityLog.create({
      data: {
        userId,
        action,
        entity,
        entityId: entityId ?? undefined,
        metadata: metadata ?? undefined,
      },
    });
  } catch {
    // non-blocking
  }
}

export async function userCanAccessProject(
  user: SessionUser,
  projectId: string,
): Promise<boolean> {
  if (user.role === Role.ADMIN) {
    const p = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    return Boolean(p);
  }
  const member = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: { projectId, userId: user.id },
    },
  });
  return Boolean(member);
}

export async function requireProjectAccess(
  user: SessionUser,
  projectId: string,
): Promise<Response | null> {
  const ok = await userCanAccessProject(user, projectId);
  if (!ok) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }
  return null;
}
