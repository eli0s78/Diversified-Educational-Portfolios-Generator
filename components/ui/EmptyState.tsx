import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: LucideIcon;
  title?: string;
  message: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
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
      <Icon className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
      {title && <h2 className="mb-2 text-lg font-semibold">{title}</h2>}
      <p className="mb-6 text-sm text-muted-foreground">{message}</p>
      {action}
    </div>
  );
}
