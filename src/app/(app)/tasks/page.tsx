"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { Plus, Loader2, Pencil, Trash2 } from "lucide-react";
import { api, getApiErrorMessage } from "@/lib/api-client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  priority: "LOW" | "MEDIUM" | "HIGH";
  dueDate: string | null;
  projectId: string;
  project: { id: string; name: string };
  assignedTo: { id: string; name: string; email: string } | null;
};

type ProjectOption = {
  id: string;
  name: string;
  members: Array<{
    id: string;
    user: { id: string; name: string; email: string };
  }>;
};

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function TasksPage() {
  const session = useSession();
  const isAdmin = session.role === Role.ADMIN;
  const searchParams = useSearchParams();

  const [page, setPage] = React.useState(1);
  const [limit] = React.useState(10);
  const [status, setStatus] = React.useState("");
  const [priority, setPriority] = React.useState("");
  const [projectFilter, setProjectFilter] = React.useState("");
  const [searchInput, setSearchInput] = React.useState("");
  const search = useDebounced(searchInput, 400);

  React.useEffect(() => {
    const p = searchParams.get("projectId");
    if (p) setProjectFilter(p);
  }, [searchParams]);

  const [tasks, setTasks] = React.useState<TaskRow[]>([]);
  const [pagination, setPagination] = React.useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = React.useState(true);

  const [projects, setProjects] = React.useState<ProjectOption[]>([]);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [newTitle, setNewTitle] = React.useState("");
  const [newDesc, setNewDesc] = React.useState("");
  const [newProjectId, setNewProjectId] = React.useState("");
  const [newPriority, setNewPriority] = React.useState("MEDIUM");
  const [newStatus, setNewStatus] = React.useState("PENDING");
  const [newDue, setNewDue] = React.useState("");
  const [newAssignee, setNewAssignee] = React.useState("");

  const [editTask, setEditTask] = React.useState<TaskRow | null>(null);
  const [editDue, setEditDue] = React.useState("");
  const [editSaving, setEditSaving] = React.useState(false);

  const loadProjectsForAdmin = React.useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await api.get<{
        projects: Array<{
          id: string;
          name: string;
          members: Array<{ id: string; user: { id: string; name: string; email: string } }>;
        }>;
      }>("/api/projects");
      setProjects(
        res.data.projects.map((p) => ({
          id: p.id,
          name: p.name,
          members: p.members,
        })),
      );
    } catch {
      /* ignore */
    }
  }, [isAdmin]);

  React.useEffect(() => {
    void loadProjectsForAdmin();
  }, [loadProjectsForAdmin]);

  async function loadTasks() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (status) params.set("status", status);
      if (priority) params.set("priority", priority);
      if (search.trim()) params.set("search", search.trim());
      if (projectFilter) params.set("projectId", projectFilter);

      const res = await api.get<{
        tasks: TaskRow[];
        pagination: typeof pagination;
      }>(`/api/tasks?${params.toString()}`);
      setTasks(res.data.tasks);
      setPagination(res.data.pagination);
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Could not load tasks"));
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    loadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, status, priority, search, projectFilter]);

  React.useEffect(() => {
    setPage(1);
  }, [status, priority, search, projectFilter]);

  const selectedProjectMembers = projects.find((p) => p.id === newProjectId)
    ?.members;

  async function createTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim() || !newProjectId) return;
    setCreating(true);
    try {
      let dueIso: string | undefined;
      if (newDue) {
        const d = new Date(newDue);
        if (!Number.isNaN(d.getTime())) dueIso = d.toISOString();
      }
      await api.post("/api/tasks", {
        title: newTitle.trim(),
        description: newDesc.trim() || null,
        projectId: newProjectId,
        priority: newPriority,
        status: newStatus,
        dueDate: dueIso,
        assignedToId: newAssignee || null,
      });
      toast.success("Task created");
      setCreateOpen(false);
      setNewTitle("");
      setNewDesc("");
      setNewProjectId("");
      setNewPriority("MEDIUM");
      setNewStatus("PENDING");
      setNewDue("");
      setNewAssignee("");
      await loadTasks();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Create failed"));
    } finally {
      setCreating(false);
    }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTask) return;
    setEditSaving(true);
    try {
      let dueDatePayload: string | null;
      if (editDue) {
        const d = new Date(editDue);
        dueDatePayload = Number.isNaN(d.getTime())
          ? null
          : d.toISOString();
      } else {
        dueDatePayload = null;
      }

      await api.put(`/api/tasks/${editTask.id}`, {
        title: editTask.title,
        description: editTask.description,
        status: editTask.status,
        priority: editTask.priority,
        assignedToId: editTask.assignedTo?.id ?? null,
        dueDate: dueDatePayload,
      });
      toast.success("Task updated");
      setEditTask(null);
      await loadTasks();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Update failed"));
    } finally {
      setEditSaving(false);
    }
  }

  async function deleteTask(id: string) {
    if (!confirm("Delete this task?")) return;
    try {
      await api.delete(`/api/tasks/${id}`);
      toast.success("Task deleted");
      await loadTasks();
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Delete failed"));
    }
  }

  async function updateMemberStatus(id: string, st: string) {
    try {
      await api.put(`/api/tasks/${id}`, { status: st });
      toast.success("Status updated");
      await loadTasks();
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Could not update"));
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin ? "All tasks across projects." : "Tasks assigned to you."}
          </p>
        </div>
        {isAdmin ? (
          <Button
            onClick={() => {
              setCreateOpen(true);
              if (projects.length && !newProjectId) {
                setNewProjectId(projectFilter || projects[0].id);
              }
            }}
          >
            <Plus className="size-4" />
            New task
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
          <div className="min-w-[160px] flex-1 space-y-1">
            <Label>Search</Label>
            <Input
              placeholder="Title or description"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Status</Label>
            <select
              className="flex h-9 w-[160px] rounded-md border border-input bg-background px-2 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All</option>
              <option value="PENDING">Pending</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label>Priority</Label>
            <select
              className="flex h-9 w-[160px] rounded-md border border-input bg-background px-2 text-sm"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <option value="">All</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </div>
          {isAdmin ? (
            <div className="space-y-1">
              <Label>Project</Label>
              <select
                className="flex h-9 w-[200px] rounded-md border border-input bg-background px-2 text-sm"
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
              >
                <option value="">All projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center gap-2 p-6 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
              Loading…
            </div>
          ) : tasks.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No tasks found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Assignee</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead className="w-[120px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="max-w-[200px]">
                      <p className="truncate font-medium">{t.title}</p>
                      {t.description ? (
                        <p className="truncate text-xs text-muted-foreground">
                          {t.description}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/projects/${t.project.id}`}
                        className="text-primary hover:underline"
                      >
                        {t.project.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {!isAdmin && t.assignedTo?.id === session.id ? (
                        <select
                          className="h-8 max-w-[140px] rounded-md border border-input bg-background px-1 text-xs"
                          value={t.status}
                          onChange={(e) =>
                            updateMemberStatus(t.id, e.target.value)
                          }
                        >
                          <option value="PENDING">PENDING</option>
                          <option value="IN_PROGRESS">IN_PROGRESS</option>
                          <option value="COMPLETED">COMPLETED</option>
                        </select>
                      ) : (
                        <StatusBadge status={t.status} />
                      )}
                    </TableCell>
                    <TableCell>
                      <PriorityBadge priority={t.priority} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {t.assignedTo?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {t.dueDate
                        ? format(new Date(t.dueDate), "MMM d, yyyy")
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {isAdmin ? (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={() => {
                              setEditTask(t);
                              setEditDue(
                                t.dueDate ? t.dueDate.slice(0, 16) : "",
                              );
                            }}
                            aria-label="Edit task"
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-destructive"
                            onClick={() => deleteTask(t.id)}
                            aria-label="Delete task"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {pagination.totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages} ·{" "}
            {pagination.total} tasks
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() =>
                setPage((p) => Math.min(pagination.totalPages, p + 1))
              }
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <form onSubmit={createTask}>
            <DialogHeader>
              <DialogTitle>New task</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1">
                <Label>Project</Label>
                <select
                  required
                  className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={newProjectId}
                  onChange={(e) => {
                    setNewProjectId(e.target.value);
                    setNewAssignee("");
                  }}
                >
                  <option value="">Select project</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Title</Label>
                <Input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>Description</Label>
                <Textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>Status</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                  >
                    <option value="PENDING">Pending</option>
                    <option value="IN_PROGRESS">In progress</option>
                    <option value="COMPLETED">Completed</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Priority</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value)}
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Due</Label>
                <Input
                  type="datetime-local"
                  value={newDue}
                  onChange={(e) => setNewDue(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Assign to</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={newAssignee}
                  onChange={(e) => setNewAssignee(e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {selectedProjectMembers?.map((m) => (
                    <option key={m.id} value={m.user.id}>
                      {m.user.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? "Creating…" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editTask)} onOpenChange={(open) => {
        if (!open) {
          setEditTask(null);
          setEditDue("");
        }
      }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          {editTask ? (
            <form onSubmit={saveEdit}>
              <DialogHeader>
                <DialogTitle>Edit task</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div className="space-y-1">
                  <Label>Title</Label>
                  <Input
                    value={editTask.title}
                    onChange={(e) =>
                      setEditTask({ ...editTask, title: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label>Description</Label>
                  <Textarea
                    value={editTask.description ?? ""}
                    onChange={(e) =>
                      setEditTask({ ...editTask, description: e.target.value })
                    }
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label>Status</Label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                      value={editTask.status}
                      onChange={(e) =>
                        setEditTask({
                          ...editTask,
                          status: e.target.value as TaskRow["status"],
                        })
                      }
                    >
                      <option value="PENDING">Pending</option>
                      <option value="IN_PROGRESS">In progress</option>
                      <option value="COMPLETED">Completed</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label>Priority</Label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                      value={editTask.priority}
                      onChange={(e) =>
                        setEditTask({
                          ...editTask,
                          priority: e.target.value as TaskRow["priority"],
                        })
                      }
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Due</Label>
                  <Input
                    type="datetime-local"
                    value={editDue}
                    onChange={(e) => setEditDue(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Assign to</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                    value={editTask.assignedTo?.id ?? ""}
                    onChange={(e) => {
                      const id = e.target.value;
                      const proj = projects.find((p) => p.id === editTask.projectId);
                      const m = proj?.members.find((x) => x.user.id === id);
                      setEditTask({
                        ...editTask,
                        assignedTo: m
                          ? {
                              id: m.user.id,
                              name: m.user.name,
                              email: m.user.email,
                            }
                          : null,
                      });
                    }}
                  >
                    <option value="">Unassigned</option>
                    {projects
                      .find((p) => p.id === editTask.projectId)
                      ?.members.map((m) => (
                        <option key={m.id} value={m.user.id}>
                          {m.user.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditTask(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={editSaving}>
                  {editSaving ? "Saving…" : "Save"}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
