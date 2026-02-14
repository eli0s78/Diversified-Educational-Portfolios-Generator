"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface CollapsibleProps {
  trigger: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  triggerClassName?: string;
}

export function Collapsible({
  trigger,
  children,
  defaultOpen = false,
  className,
  triggerClassName,
}: CollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={className}>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex w-full items-center gap-2 text-left transition-colors hover:bg-muted/30",
          triggerClassName
        )}
      >
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-primary" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        {trigger}
      </button>
      {open && children}
    </div>
  );
}
