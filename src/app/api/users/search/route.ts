import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-token";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/enums";
import { userSearchQuerySchema } from "@/lib/validations";
import { jsonError, jsonOk, jsonZodError } from "@/lib/api-response";
import { requireProjectAccess } from "@/lib/activity";
import type { Prisma } from "@/generated/prisma/client";

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;
  if (auth.role !== Role.ADMIN) {
    return jsonError("Forbidden", 403);
  }

  const raw = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = userSearchQuerySchema.safeParse(raw);
  if (!parsed.success) return jsonZodError(parsed.error);

  const { q, projectId } = parsed.data;

  const denied = await requireProjectAccess(auth, projectId);
  if (denied) return denied;

  const existing = await prisma.projectMember.findMany({
    where: { projectId },
    select: { userId: true },
  });
  const excludeIds = existing.map((e) => e.userId);

  const filters: Prisma.UserWhereInput[] = [
    {
      OR: [
        { email: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
      ],
    },
  ];
  if (excludeIds.length > 0) {
    filters.push({ id: { notIn: excludeIds } });
  }

  const users = await prisma.user.findMany({
    where: { AND: filters },
    take: 8,
    orderBy: { email: "asc" },
    select: { id: true, name: true, email: true, role: true },
  });

  return jsonOk({ users });
}
