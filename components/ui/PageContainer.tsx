import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

const sizes = {
  sm: "max-w-3xl",
  md: "max-w-4xl",
  lg: "max-w-5xl",
  xl: "max-w-6xl",
} as const;

interface PageContainerProps extends HTMLAttributes<HTMLDivElement> {
  size?: keyof typeof sizes;
}

export function PageContainer({
  size = "lg",
  className,
  ...props
}: PageContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto px-4 py-12 sm:px-6",
        sizes[size],
        className
      )}
      {...props}
    />
  );
}
