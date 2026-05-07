"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { api, getApiErrorMessage } from "@/lib/api-client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSession } from "@/components/session-context";
import { Role } from "@/generated/prisma/enums";
import { StatusBadge, PriorityBadge } from "@/components/task-badges";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";

type DashboardStats = {
  scope: string;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  overdueTasks: number;
  progressPct: number;
  recentProjects: Array<{
    id: string;
    name: string;
    description: string | null;
    createdAt: string;
    _count: { tasks: number; members: number };
  }>;
  recentTasks: Array<{
    id: string;
    title: string;
    status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
    priority: "LOW" | "MEDIUM" | "HIGH";
    dueDate: string | null;
    project: { id: string; name: string };
    assignedTo: { id: string; name: string; email: string } | null;
  }>;
  recentActivity?: Array<{
    id: string;
    action: string;
    entity: string;
    entityId: string | null;
    createdAt: string;
    user: { name: string; email: string };
  }>;
};

function StatCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: number | string;
  subtitle?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold tabular-nums">{value}</p>
        {subtitle ? (
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const session = useSession();
  const [data, setData] = React.useState<DashboardStats | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<DashboardStats>("/api/dashboard/stats");
        if (!cancelled) setData(res.data);
      } catch (e) {
        toast.error(getApiErrorMessage(e, "Could not load dashboard"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || !data) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        Loading dashboard…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          {session.role === Role.ADMIN
            ? "Organization-wide task overview."
            : "Your assigned work at a glance."}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total tasks" value={data.totalTasks} />
        <StatCard title="Completed" value={data.completedTasks} />
        <StatCard title="Pending / in progress" value={data.pendingTasks} />
        <StatCard
          title="Overdue"
          value={data.overdueTasks}
          subtitle="Not completed, past due"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Completion progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${data.progressPct}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {data.progressPct}% of tasks completed
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent projects</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.recentProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground">No projects yet.</p>
            ) : (
              data.recentProjects.map((p) => (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className="block rounded-lg border border-border p-3 transition-colors hover:bg-accent/40"
                >
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {p._count.tasks} tasks · {p._count.members} members
                  </p>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        {session.role === Role.ADMIN && data.recentActivity?.length ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Activity log</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[220px] pr-3">
                <ul className="space-y-2 text-sm">
                  {data.recentActivity.map((a) => (
                    <li
                      key={a.id}
                      className="rounded-md border border-border px-3 py-2"
                    >
                      <p className="font-medium">
                        {a.action}{" "}
                        <span className="font-normal text-muted-foreground">
                          {a.entity}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {a.user.name} ·{" "}
                        {format(new Date(a.createdAt), "MMM d, yyyy HH:mm")}
                      </p>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {session.role === Role.ADMIN ? "Recent tasks" : "Your tasks"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.recentTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No tasks to show yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Due</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentTasks.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">
                      <Link
                        href="/tasks"
                        className="hover:underline"
                      >
                        {t.title}
                      </Link>
                    </TableCell>
                    <TableCell>{t.project.name}</TableCell>
                    <TableCell>
                      <StatusBadge status={t.status} />
                    </TableCell>
                    <TableCell>
                      <PriorityBadge priority={t.priority} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {t.dueDate
                        ? format(new Date(t.dueDate), "MMM d, yyyy")
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
