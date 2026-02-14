"use client";

import { useEffect } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface ImportResultDialogProps {
  open: boolean;
  success: boolean;
  title: string;
  message: string;
  okLabel: string;
  openLabel?: string;
  onOpenProject?: () => void;
  onDismiss: () => void;
}

export function ImportResultDialog({
  open,
  success,
  title,
  message,
  okLabel,
  openLabel,
  onOpenProject,
  onDismiss,
}: ImportResultDialogProps) {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onDismiss();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onDismiss]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onDismiss}
      />

      {/* Dialog */}
      <div className="relative mx-4 w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl">
        <div className="mb-4 flex items-start gap-3">
          {success ? (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success/10">
              <CheckCircle2 className="h-5 w-5 text-success" />
            </div>
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
              <XCircle className="h-5 w-5 text-destructive" />
            </div>
          )}
          <div>
            <h3 className="text-sm font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          {success && onOpenProject ? (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={onDismiss}
              >
                {okLabel}
              </Button>
              <Button
                size="sm"
                onClick={onOpenProject}
              >
                {openLabel}
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              onClick={onDismiss}
            >
              {okLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
