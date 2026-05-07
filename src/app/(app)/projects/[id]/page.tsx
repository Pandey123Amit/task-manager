"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, Loader2, UserPlus, Trash2, Pencil } from "lucide-react";
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
import { StatusBadge } from "@/components/task-badges";

type ProjectDetail = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  createdBy: { id: string; name: string; email: string };
  tasks: Array<{
    id: string;
    title: string;
    status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
    priority: "LOW" | "MEDIUM" | "HIGH";
    dueDate: string | null;
    assignedTo: { id: string; name: string; email: string } | null;
    createdAt: string;
  }>;
  members: Array<{
    id: string;
    joinedAt: string;
    user: {
      id: string;
      name: string;
      email: string;
      role: Role;
    };
  }>;
};

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const session = useSession();
  const isAdmin = session.role === Role.ADMIN;
  const id = params.id;

  const [project, setProject] = React.useState<ProjectDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [editOpen, setEditOpen] = React.useState(false);
  const [editName, setEditName] = React.useState("");
  const [editDesc, setEditDesc] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [memberEmail, setMemberEmail] = React.useState("");
  const [addingMember, setAddingMember] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ project: ProjectDetail }>(
        `/api/projects/${id}`,
      );
      setProject(res.data.project);
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Could not load project"));
      setProject(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    void load();
  }, [load]);

  function openEdit() {
    if (!project) return;
    setEditName(project.name);
    setEditDesc(project.description ?? "");
    setEditOpen(true);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editName.trim()) return;
    setSaving(true);
    try {
      await api.put(`/api/projects/${id}`, {
        name: editName.trim(),
        description: editDesc.trim() || null,
      });
      toast.success("Project updated");
      setEditOpen(false);
      await load();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Update failed"));
    } finally {
      setSaving(false);
    }
  }

  async function removeProject() {
    if (!confirm("Delete this project and all tasks?")) return;
    try {
      await api.delete(`/api/projects/${id}`);
      toast.success("Project deleted");
      router.push("/projects");
      router.refresh();
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Delete failed"));
    }
  }

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    if (!memberEmail.trim()) return;
    setAddingMember(true);
    try {
      await api.post(`/api/projects/${id}/members`, {
        email: memberEmail.trim(),
      });
      toast.success("Member added");
      setMemberEmail("");
      await load();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not add member"));
    } finally {
      setAddingMember(false);
    }
  }

  async function removeMember(userId: string) {
    if (!confirm("Remove this member?")) return;
    try {
      await api.delete(`/api/projects/${id}/members/${userId}`);
      toast.success("Member removed");
      await load();
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Remove failed"));
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        Loading…
      </div>
    );
  }

  if (!project) {
    return (
      <p className="text-sm text-muted-foreground">Project not found.</p>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/projects"
            className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Projects
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">
            {project.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            Owner {project.createdBy.name} · created{" "}
            {format(new Date(project.createdAt), "MMM d, yyyy")}
          </p>
        </div>
        {isAdmin ? (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={openEdit}>
              <Pencil className="size-4" />
              Edit
            </Button>
            <Button variant="destructive" size="sm" onClick={removeProject}>
              <Trash2 className="size-4" />
              Delete
            </Button>
          </div>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Description</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {project.description || "No description provided."}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Members</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isAdmin ? (
              <form onSubmit={addMember} className="flex flex-col gap-2 sm:flex-row">
                <Input
                  type="email"
                  placeholder="user@company.com"
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  className="flex-1"
                />
                <Button type="submit" disabled={addingMember}>
                  <UserPlus className="size-4" />
                  Add
                </Button>
              </form>
            ) : null}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  {isAdmin ? <TableHead className="w-[80px]" /> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {project.members.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{m.user.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {m.user.email}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{m.user.role}</TableCell>
                    {isAdmin ? (
                      <TableCell>
                        {m.user.id !== project.createdBy.id ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => removeMember(m.user.id)}
                          >
                            Remove
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Owner
                          </span>
                        )}
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">Tasks in this project</CardTitle>
            {isAdmin ? (
              <Link
                href={`/tasks?projectId=${project.id}`}
                className="inline-flex h-7 items-center justify-center gap-1 rounded-lg border border-border bg-background px-2.5 text-[0.8rem] font-medium hover:bg-muted"
              >
                Manage tasks
              </Link>
            ) : null}
          </CardHeader>
          <CardContent>
            {project.tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tasks yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assignee</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {project.tasks.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.title}</TableCell>
                      <TableCell>
                        <StatusBadge status={t.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {t.assignedTo?.name ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <form onSubmit={saveEdit}>
            <DialogHeader>
              <DialogTitle>Edit project</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="ename">Name</Label>
                <Input
                  id="ename"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edesc">Description</Label>
                <Textarea
                  id="edesc"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
