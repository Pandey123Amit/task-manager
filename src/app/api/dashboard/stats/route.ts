import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-token";
import { prisma } from "@/lib/prisma";
import { Role, TaskStatus } from "@/generated/prisma/enums";

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;

  const now = new Date();

  if (auth.role === Role.ADMIN) {
    const [total, completed, pending, overdue, recentProjects, recentTasks, recentActivity] =
      await Promise.all([
        prisma.task.count(),
        prisma.task.count({ where: { status: TaskStatus.COMPLETED } }),
        prisma.task.count({
          where: {
            status: {
              in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS],
            },
          },
        }),
        prisma.task.count({
          where: {
            status: { not: TaskStatus.COMPLETED },
            dueDate: { lt: now },
          },
        }),
        prisma.project.findMany({
          take: 5,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            description: true,
            createdAt: true,
            _count: { select: { tasks: true, members: true } },
          },
        }),
        prisma.task.findMany({
          take: 10,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            dueDate: true,
            project: { select: { id: true, name: true } },
            assignedTo: { select: { id: true, name: true, email: true } },
          },
        }),
        prisma.activityLog.findMany({
          take: 15,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            action: true,
            entity: true,
            entityId: true,
            metadata: true,
            createdAt: true,
            user: { select: { name: true, email: true } },
          },
        }),
      ]);

    const progressPct = total === 0 ? 0 : Math.round((completed / total) * 100);

    return Response.json({
      scope: "admin",
      totalTasks: total,
      completedTasks: completed,
      pendingTasks: pending,
      overdueTasks: overdue,
      progressPct,
      recentProjects,
      recentTasks,
      recentActivity,
    });
  }

  const taskWhere = { assignedToId: auth.id };

  const [total, completed, pending, overdue, assignedRows, memberProjects] =
    await Promise.all([
      prisma.task.count({ where: taskWhere }),
      prisma.task.count({
        where: { ...taskWhere, status: TaskStatus.COMPLETED },
      }),
      prisma.task.count({
        where: {
          ...taskWhere,
          status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] },
        },
      }),
      prisma.task.count({
        where: {
          ...taskWhere,
          status: { not: TaskStatus.COMPLETED },
          dueDate: { lt: now },
        },
      }),
      prisma.task.findMany({
        where: taskWhere,
        take: 10,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,
          project: { select: { id: true, name: true } },
          assignedTo: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.projectMember.findMany({
        where: { userId: auth.id },
        orderBy: { joinedAt: "desc" },
        take: 5,
        select: {
          project: {
            select: {
              id: true,
              name: true,
              description: true,
              createdAt: true,
              _count: { select: { tasks: true, members: true } },
            },
          },
        },
      }),
    ]);

  const recentProjects = memberProjects.map((m) => m.project);
  const progressPct = total === 0 ? 0 : Math.round((completed / total) * 100);

  return Response.json({
    scope: "member",
    totalTasks: total,
    completedTasks: completed,
    pendingTasks: pending,
    overdueTasks: overdue,
    progressPct,
    recentProjects,
    recentTasks: assignedRows,
  });
}
