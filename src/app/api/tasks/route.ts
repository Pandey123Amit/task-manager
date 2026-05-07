import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-token";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/enums";
import {
  normalizeDueDate,
  taskCreateSchema,
  taskListQuerySchema,
} from "@/lib/validations";
import { jsonError, jsonOk, jsonZodError } from "@/lib/api-response";
import { logActivity, userCanAccessProject } from "@/lib/activity";
import type { Prisma } from "@/generated/prisma/client";

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;

  const sp = req.nextUrl.searchParams;
  const raw = Object.fromEntries(sp.entries());
  const parsed = taskListQuerySchema.safeParse(raw);
  if (!parsed.success) return jsonZodError(parsed.error);

  const { page, limit, status, priority, search, projectId } = parsed.data;
  const skip = (page - 1) * limit;

  const where: Prisma.TaskWhereInput = {};

  if (auth.role !== Role.ADMIN) {
    where.assignedToId = auth.id;
  }

  if (status) where.status = status;
  if (priority) where.priority = priority;
  if (projectId) where.projectId = projectId;
  if (search && search.length > 0) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }

  const [total, tasks] = await Promise.all([
    prisma.task.count({ where }),
    prisma.task.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        project: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
      },
    }),
  ]);

  return jsonOk({
    tasks,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  });
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;
  if (auth.role !== Role.ADMIN) {
    return jsonError("Forbidden", 403);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const parsed = taskCreateSchema.safeParse(body);
  if (!parsed.success) return jsonZodError(parsed.error);

  const can = await userCanAccessProject(auth, parsed.data.projectId);
  if (!can) {
    return jsonError("Project not found", 404);
  }

  const due = normalizeDueDate(parsed.data.dueDate ?? undefined);
  if (!due.ok) return jsonError(due.message, 400);

  if (parsed.data.assignedToId) {
    const member = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId: parsed.data.projectId,
          userId: parsed.data.assignedToId,
        },
      },
    });
    if (!member) {
      return jsonError("Assignee must be a project member", 400);
    }
  }

  const task = await prisma.task.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description ?? undefined,
      status: parsed.data.status,
      priority: parsed.data.priority,
      dueDate: due.value ?? undefined,
      projectId: parsed.data.projectId,
      assignedToId: parsed.data.assignedToId ?? undefined,
    },
    include: {
      project: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
    },
  });

  await logActivity(auth.id, "CREATE", "Task", task.id, {
    title: task.title,
    projectId: task.projectId,
  });

  return jsonOk({ task }, 201);
}
