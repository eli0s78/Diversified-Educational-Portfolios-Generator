import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: LucideIcon;
  message: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  message,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "mx-auto max-w-md px-4 py-16 text-center",
        className
      )}
    >
      <Icon className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
      <p className="mb-6 text-lg text-muted-foreground">{message}</p>
      {action}
    </div>
  );
}
