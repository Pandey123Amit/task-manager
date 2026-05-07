import { Badge } from "@/components/ui/badge";
import type { TaskStatus, Priority } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

const statusClass: Record<TaskStatus, string> = {
  PENDING: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  IN_PROGRESS:
    "bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30",
  COMPLETED:
    "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
};

const priorityClass: Record<Priority, string> = {
  LOW: "text-muted-foreground border-border",
  MEDIUM: "border-orange-500/40 text-orange-700 dark:text-orange-400",
  HIGH: "border-red-500/40 text-red-700 dark:text-red-400",
};

export function StatusBadge({ status }: { status: TaskStatus }) {
  const label = status.replace(/_/g, " ");
  return (
    <Badge variant="outline" className={cn("font-medium", statusClass[status])}>
      {label}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <Badge variant="outline" className={cn("font-medium", priorityClass[priority])}>
      {priority}
    </Badge>
  );
}
