import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-token";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/enums";
import {
  memberTaskStatusSchema,
  normalizeDueDate,
  taskUpdateSchema,
} from "@/lib/validations";
import { jsonError, jsonOk, jsonZodError } from "@/lib/api-response";
import { logActivity, userCanAccessProject } from "@/lib/activity";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, ctx: Ctx) {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;

  const { id } = await ctx.params;
  const existing = await prisma.task.findUnique({
    where: { id },
    include: { project: true },
  });
  if (!existing) return jsonError("Task not found", 404);

  const canView = await userCanAccessProject(auth, existing.projectId);
  if (!canView) return jsonError("Task not found", 404);

  if (auth.role === Role.MEMBER) {
    if (existing.assignedToId !== auth.id) {
      return jsonError("Forbidden", 403);
    }
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonError("Invalid JSON", 400);
    }
    const partial = memberTaskStatusSchema.safeParse(body);
    if (!partial.success) return jsonZodError(partial.error);

    const task = await prisma.task.update({
      where: { id },
      data: { status: partial.data.status },
      include: {
        project: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
      },
    });

    await logActivity(auth.id, "UPDATE_STATUS", "Task", task.id, {
      status: task.status,
    });

    return jsonOk({ task });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const parsed = taskUpdateSchema.safeParse(body);
  if (!parsed.success) return jsonZodError(parsed.error);

  let dueDate = undefined as Date | null | undefined;
  if (parsed.data.dueDate !== undefined) {
    const due = normalizeDueDate(parsed.data.dueDate);
    if (!due.ok) return jsonError(due.message, 400);
    dueDate = due.value;
  }

  if (parsed.data.assignedToId) {
    const member = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId: existing.projectId,
          userId: parsed.data.assignedToId,
        },
      },
    });
    if (!member) {
      return jsonError("Assignee must be a project member", 400);
    }
  }

  const task = await prisma.task.update({
    where: { id },
    data: {
      ...(parsed.data.title !== undefined && { title: parsed.data.title }),
      ...(parsed.data.description !== undefined && {
        description: parsed.data.description,
      }),
      ...(parsed.data.status !== undefined && { status: parsed.data.status }),
      ...(parsed.data.priority !== undefined && {
        priority: parsed.data.priority,
      }),
      ...(dueDate !== undefined && { dueDate }),
      ...(parsed.data.assignedToId !== undefined && {
        assignedToId: parsed.data.assignedToId,
      }),
    },
    include: {
      project: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
    },
  });

  await logActivity(auth.id, "UPDATE", "Task", task.id);

  return jsonOk({ task });
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;
  if (auth.role !== Role.ADMIN) return jsonError("Forbidden", 403);

  const { id } = await ctx.params;
  const existing = await prisma.task.findUnique({ where: { id } });
  if (!existing) return jsonError("Task not found", 404);

  const can = await userCanAccessProject(auth, existing.projectId);
  if (!can) return jsonError("Task not found", 404);

  await prisma.task.delete({ where: { id } });
  await logActivity(auth.id, "DELETE", "Task", id);

  return jsonOk({ ok: true });
}
