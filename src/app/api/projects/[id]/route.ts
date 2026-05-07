import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-token";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/enums";
import { projectUpdateSchema } from "@/lib/validations";
import { jsonError, jsonOk, jsonZodError } from "@/lib/api-response";
import {
  logActivity,
  requireProjectAccess,
} from "@/lib/activity";

const projectInclude = {
  createdBy: { select: { id: true, name: true, email: true } },
  tasks: {
    orderBy: { createdAt: "desc" as const },
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      dueDate: true,
      assignedTo: { select: { id: true, name: true, email: true } },
      createdAt: true,
    },
  },
  members: {
    select: {
      id: true,
      joinedAt: true,
      user: { select: { id: true, name: true, email: true, role: true } },
    },
  },
} as const;

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const auth = requireAuth(_req);
  if (auth instanceof Response) return auth;

  const { id } = await ctx.params;
  const denied = await requireProjectAccess(auth, id);
  if (denied) return denied;

  const project = await prisma.project.findUnique({
    where: { id },
    include: projectInclude,
  });
  if (!project) return jsonError("Project not found", 404);
  return jsonOk({ project });
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;
  if (auth.role !== Role.ADMIN) {
    return jsonError("Forbidden", 403);
  }

  const { id } = await ctx.params;
  const denied = await requireProjectAccess(auth, id);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const parsed = projectUpdateSchema.safeParse(body);
  if (!parsed.success) return jsonZodError(parsed.error);

  const existing = await prisma.project.findUnique({ where: { id } });
  if (!existing) return jsonError("Project not found", 404);

  const project = await prisma.project.update({
    where: { id },
    data: {
      ...(parsed.data.name !== undefined && { name: parsed.data.name }),
      ...(parsed.data.description !== undefined && {
        description: parsed.data.description,
      }),
    },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      _count: { select: { tasks: true, members: true } },
      members: {
        select: {
          id: true,
          joinedAt: true,
          user: { select: { id: true, name: true, email: true, role: true } },
        },
      },
    },
  });

  await logActivity(auth.id, "UPDATE", "Project", project.id);

  return jsonOk({ project });
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;
  if (auth.role !== Role.ADMIN) {
    return jsonError("Forbidden", 403);
  }

  const { id } = await ctx.params;
  const denied = await requireProjectAccess(auth, id);
  if (denied) return denied;

  const existing = await prisma.project.findUnique({ where: { id } });
  if (!existing) return jsonError("Project not found", 404);

  await prisma.project.delete({ where: { id } });
  await logActivity(auth.id, "DELETE", "Project", id);

  return jsonOk({ ok: true });
}
