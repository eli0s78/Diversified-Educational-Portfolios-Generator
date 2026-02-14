"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/navigation";
import { useProject } from "@/lib/project-context";
import {
  FolderOpen,
  ChevronDown,
  Plus,
  Upload,
  Download,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function ProjectSwitcher() {
  const t = useTranslations("projects");
  const router = useRouter();
  const {
    currentProject,
    projects,
    switchProject,
    createProject,
    removeProject,
    importProject,
    exportCurrentProject,
  } = useProject();

  const [open, setOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirmDeleteId(null);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [open]);

  const sorted = [...projects].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  const handleNew = () => {
    createProject();
    setOpen(false);
    router.push("/upload");
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await importProject(file);
    setOpen(false);
    router.push("/upload");
  };

  const handleSwitch = (id: string) => {
    switchProject(id);
    setOpen(false);
  };

  const handleDelete = (id: string) => {
    if (confirmDeleteId === id) {
      removeProject(id);
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(id);
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
    } catch {
      return "";
    }
  };

  return (
    <div ref={panelRef} className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
      >
        <FolderOpen className="h-4 w-4 text-primary" />
        <span className="hidden max-w-[120px] truncate sm:inline">
          {currentProject?.name || t("none")}
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {/* Panel */}
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-border bg-card shadow-lg sm:w-80">
          <div className="p-3">
            {/* Current project */}
            {currentProject && (
              <div className="mb-3 rounded-lg bg-primary/5 p-2.5">
                <div className="text-xs font-medium text-muted-foreground">
                  {t("current")}
                </div>
                <div className="truncate text-sm font-semibold">
                  {currentProject.name}
                </div>
              </div>
            )}

            {/* Project list */}
            {sorted.length > 0 ? (
              <div className="mb-3 max-h-48 space-y-1 overflow-y-auto">
                {sorted.map((p) => (
                  <div
                    key={p.id}
                    className={cn(
                      "group flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors",
                      p.id === currentProject?.id
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-muted"
                    )}
                  >
                    <button
                      onClick={() => handleSwitch(p.id)}
                      className="flex min-w-0 flex-1 flex-col text-left"
                    >
                      <span className="truncate font-medium">{p.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {t("last_updated")} {formatDate(p.updatedAt)}
                      </span>
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className={cn(
                        "shrink-0 rounded p-1 transition-colors",
                        confirmDeleteId === p.id
                          ? "bg-destructive/10 text-destructive"
                          : "text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
                      )}
                      title={
                        confirmDeleteId === p.id
                          ? t("confirm_delete")
                          : t("delete")
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mb-3 py-4 text-center text-sm text-muted-foreground">
                {t("none")}
              </p>
            )}

            {/* Actions */}
            <div className="flex gap-2 border-t border-border pt-3">
              <button
                onClick={handleNew}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
              >
                <Plus className="h-3.5 w-3.5" />
                {t("new")}
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium transition-colors hover:bg-muted"
              >
                <Upload className="h-3.5 w-3.5" />
                {t("import")}
              </button>
              {currentProject && (
                <button
                  onClick={() => {
                    exportCurrentProject();
                    setOpen(false);
                  }}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium transition-colors hover:bg-muted"
                >
                  <Download className="h-3.5 w-3.5" />
                  {t("export")}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.dep.json"
        className="hidden"
        onChange={handleImport}
      />
    </div>
  );
}
