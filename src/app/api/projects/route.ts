import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-token";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/enums";
import {
  projectCreateSchema,
} from "@/lib/validations";
import { jsonError, jsonOk, jsonZodError } from "@/lib/api-response";
import { logActivity } from "@/lib/activity";

const projectInclude = {
  createdBy: { select: { id: true, name: true, email: true } },
  _count: { select: { tasks: true, members: true } },
  members: {
    select: {
      id: true,
      joinedAt: true,
      user: { select: { id: true, name: true, email: true, role: true } },
    },
  },
} as const;

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;

  if (auth.role === Role.ADMIN) {
    const projects = await prisma.project.findMany({
      orderBy: { createdAt: "desc" },
      include: projectInclude,
    });
    return jsonOk({ projects });
  }

  const projects = await prisma.project.findMany({
    where: {
      members: { some: { userId: auth.id } },
    },
    orderBy: { createdAt: "desc" },
    include: projectInclude,
  });
  return jsonOk({ projects });
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

  const parsed = projectCreateSchema.safeParse(body);
  if (!parsed.success) return jsonZodError(parsed.error);

  const project = await prisma.project.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description ?? undefined,
      createdById: auth.id,
      members: {
        create: { userId: auth.id },
      },
    },
    include: projectInclude,
  });

  await logActivity(auth.id, "CREATE", "Project", project.id, {
    name: project.name,
  });

  return jsonOk({ project }, 201);
}
