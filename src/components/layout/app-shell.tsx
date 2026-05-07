"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  ListTodo,
  LogOut,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SessionUser } from "@/types/auth";
import { SessionProvider } from "@/components/session-context";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/theme-toggle";
import { api, getApiErrorMessage } from "@/lib/api-client";
import { toast } from "sonner";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/tasks", label: "Tasks", icon: ListTodo },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1 px-2">
      {nav.map(({ href, label, icon: Icon }) => {
        const active =
          pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60",
            )}
          >
            <Icon className="size-4 shrink-0 opacity-80" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  async function logout() {
    try {
      await api.post("/api/auth/logout");
      toast.success("Signed out");
      router.push("/login");
      router.refresh();
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Logout failed"));
    }
  }

  const sidebar = (
    <div className="flex h-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
        <ListTodo className="size-6 text-sidebar-primary" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">Team Tasks</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
      </div>
      <ScrollArea className="flex-1 py-3">
        <NavLinks onNavigate={() => setOpen(false)} />
      </ScrollArea>
      <div className="border-t border-sidebar-border p-3">
        <div className="mb-2 rounded-md bg-sidebar-accent/50 px-3 py-2 text-xs">
          <p className="font-medium">{user.name}</p>
          <p className="text-muted-foreground">{user.role}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2 border-sidebar-border"
          onClick={logout}
        >
          <LogOut className="size-4" />
          Sign out
        </Button>
      </div>
    </div>
  );

  return (
    <SessionProvider user={user}>
      <div className="flex min-h-svh w-full bg-background">
        <aside className="hidden w-64 shrink-0 md:flex md:flex-col">{sidebar}</aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b border-border bg-background/80 px-4 backdrop-blur md:hidden">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Open menu"
              onClick={() => setOpen(true)}
            >
              <Menu className="size-5" />
            </Button>
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetContent side="left" className="w-72 p-0">
                {sidebar}
              </SheetContent>
            </Sheet>
            <span className="font-semibold">Team Task Manager</span>
            <div className="ml-auto flex items-center gap-1">
              <ThemeToggle />
            </div>
          </header>
          <header className="hidden h-14 items-center justify-end border-b border-border px-6 md:flex">
            <ThemeToggle />
          </header>
          <main className="flex-1 p-4 md:p-8">{children}</main>
        </div>
      </div>
    </SessionProvider>
  );
}
