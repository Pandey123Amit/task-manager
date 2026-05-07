"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Plus, Loader2 } from "lucide-react";
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
import { useSession } from "@/components/session-context";
import { Role } from "@/generated/prisma/enums";

type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  createdBy: { id: string; name: string; email: string };
  _count: { tasks: number; members: number };
};

export default function ProjectsPage() {
  const session = useSession();
  const isAdmin = session.role === Role.ADMIN;
  const [projects, setProjects] = React.useState<ProjectRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");

  async function load() {
    try {
      const res = await api.get<{ projects: ProjectRow[] }>("/api/projects");
      setProjects(res.data.projects);
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Could not load projects"));
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
  }, []);

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      await api.post("/api/projects", {
        name: name.trim(),
        description: description.trim() || null,
      });
      toast.success("Project created");
      setCreateOpen(false);
      setName("");
      setDescription("");
      await load();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Create failed"));
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        Loading projects…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin
              ? "Create and manage team projects."
              : "Projects you are a member of."}
          </p>
        </div>
        {isAdmin ? (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            New project
          </Button>
        ) : null}
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {isAdmin
              ? "No projects yet. Create one to get started."
              : "You are not on any project yet."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {projects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`}>
              <Card className="h-full transition-colors hover:border-primary/30">
                <CardHeader>
                  <CardTitle className="text-lg">{p.name}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(p.createdAt), "MMM d, yyyy")} ·{" "}
                    {p.createdBy.name}
                  </p>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {p.description ? (
                    <p className="line-clamp-2">{p.description}</p>
                  ) : (
                    <p className="italic">No description</p>
                  )}
                  <p className="mt-2">
                    {p._count.tasks} tasks · {p._count.members} members
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <form onSubmit={createProject}>
            <DialogHeader>
              <DialogTitle>New project</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="pname">Name</Label>
                <Input
                  id="pname"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pdesc">Description</Label>
                <Textarea
                  id="pdesc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
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
                {creating ? "Saving…" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
