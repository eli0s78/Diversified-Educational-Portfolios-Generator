import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  color?: string;
  className?: string;
}

export function StatCard({
  icon: Icon,
  label,
  value,
  color = "primary",
  className,
}: StatCardProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-lg",
          `bg-${color}/10`
        )}
      >
        <Icon className={cn("h-5 w-5", `text-${color}`)} />
      </div>
      <div>
        <div className="text-xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}
