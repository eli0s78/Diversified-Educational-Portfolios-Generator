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
  Pencil,
  Check,
  X,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ImportResultDialog } from "@/components/ui/ImportResultDialog";
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
    renameProject,
    importProject,
    exportCurrentProject,
  } = useProject();

  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{ success: boolean; projectName?: string } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
        setDeleteId(null);
        setRenamingId(null);
        setRenameValue("");
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
    setOpen(false);
    try {
      const project = await importProject(file);
      setImportResult({ success: true, projectName: project.name });
    } catch {
      setImportResult({ success: false });
    }
    e.target.value = "";
  };

  const handleSwitch = (id: string) => {
    switchProject(id);
    setOpen(false);
  };

  const startRename = (id: string, currentName: string) => {
    setRenamingId(id);
    setRenameValue(currentName);
  };

  const confirmRename = () => {
    if (renamingId && renameValue.trim()) {
      renameProject(renamingId, renameValue.trim());
    }
    setRenamingId(null);
    setRenameValue("");
  };

  const cancelRename = () => {
    setRenamingId(null);
    setRenameValue("");
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
                <div className="text-sm font-semibold">
                  {currentProject.name}
                </div>
              </div>
            )}

            {/* Project list */}
            {sorted.length > 0 ? (
              <div className="mb-3 max-h-48 space-y-1 overflow-y-auto">
                {sorted.map((p) => {
                  const isRenaming = renamingId === p.id;
                  return (
                    <div
                      key={p.id}
                      className={cn(
                        "group flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors",
                        p.id === currentProject?.id
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-muted"
                      )}
                    >
                      {isRenaming ? (
                        <div className="flex min-w-0 flex-1 items-center gap-1.5">
                          <input
                            type="text"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") confirmRename();
                              if (e.key === "Escape") cancelRename();
                            }}
                            className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm font-medium focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                            autoFocus
                          />
                          <button
                            onClick={confirmRename}
                            className="rounded p-1 text-success hover:bg-success/10"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={cancelRename}
                            className="rounded p-1 text-muted-foreground hover:bg-muted"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => handleSwitch(p.id)}
                            className="flex min-w-0 flex-1 flex-col text-left"
                          >
                            <span className="font-medium">{p.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {t("last_updated")} {formatDate(p.updatedAt)}
                            </span>
                          </button>
                          <button
                            onClick={() => startRename(p.id, p.name)}
                            className={cn(
                              "shrink-0 rounded p-1 transition-colors",
                              "text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100"
                            )}
                            title={t("rename")}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteId(p.id)}
                            className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-colors hover:text-destructive group-hover:opacity-100"
                            title={t("delete")}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}
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

      {/* Import result dialog */}
      <ImportResultDialog
        open={!!importResult}
        success={importResult?.success ?? false}
        title={
          importResult?.success
            ? t("import_success_title")
            : t("import_error_title")
        }
        message={
          importResult?.success
            ? t("import_success_message", { name: importResult.projectName ?? "" })
            : t("import_error_message")
        }
        okLabel={t("import_ok")}
        openLabel={t("import_open")}
        onOpenProject={() => {
          setImportResult(null);
          router.push("/upload");
        }}
        onDismiss={() => setImportResult(null)}
      />

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={!!deleteId}
        title={t("delete_title")}
        message={t("delete_message")}
        confirmLabel={t("delete_confirm")}
        cancelLabel={t("delete_cancel")}
        onConfirm={() => {
          if (deleteId) removeProject(deleteId);
          setDeleteId(null);
        }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
