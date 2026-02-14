"use client";

import { useState, useRef } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/navigation";
import { Link } from "@/lib/i18n/navigation";
import { useProject } from "@/lib/project-context";
import { Plus, Upload, FolderOpen, ArrowRight, Pencil, Check, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ImportResultDialog } from "@/components/ui/ImportResultDialog";
import { cn } from "@/lib/utils";

export default function ProjectsDashboard() {
  const t = useTranslations("home");
  const tProjects = useTranslations("projects");
  const router = useRouter();
  const {
    currentProject,
    projects,
    switchProject,
    createProject,
    importProject,
    renameProject,
    removeProject,
  } = useProject();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{ success: boolean; projectName?: string } | null>(null);

  const sorted = [...projects]
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
    .slice(0, 4);

  const handleNew = () => {
    createProject();
    router.push("/upload");
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const project = await importProject(file);
      setImportResult({ success: true, projectName: project.name });
    } catch {
      setImportResult({ success: false });
    }
    e.target.value = "";
  };

  const startRename = (e: React.MouseEvent, id: string, currentName: string) => {
    e.stopPropagation();
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

  const requestDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeleteId(id);
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return "";
    }
  };

  return (
    <section className="mb-12">
      {/* Section Header */}
      <h2 className="mb-4 text-lg font-semibold">{t("projects_title")}</h2>

      {/* Project Cards or Empty State */}
      {projects.length === 0 ? (
        <Card>
          <EmptyState
            icon={FolderOpen}
            message={t("projects_empty")}
            className="py-12"
            action={
              <div className="flex justify-center gap-3">
                <Button onClick={handleNew}>
                  <Plus className="h-4 w-4" />
                  {t("projects_new")}
                </Button>
                <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-4 w-4" />
                  {t("projects_import")}
                </Button>
              </div>
            }
          />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {sorted.map((p) => {
              const isCurrent = p.id === currentProject?.id;
              const isRenaming = renamingId === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => {
                    if (isRenaming) return;
                    switchProject(p.id);
                    router.push("/upload");
                  }}
                  className={cn(
                    "group cursor-pointer rounded-xl border bg-card p-4 text-left transition-all duration-200 hover:shadow-md",
                    isCurrent
                      ? "border-primary ring-1 ring-primary/30"
                      : "border-border"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      {isCurrent && (
                        <span className="mb-2 inline-block rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                          {tProjects("current")}
                        </span>
                      )}
                      {isRenaming ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") confirmRename();
                              if (e.key === "Escape") cancelRename();
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm font-semibold focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                            autoFocus
                          />
                          <button
                            onClick={(e) => { e.stopPropagation(); confirmRename(); }}
                            className="rounded p-1 text-success hover:bg-success/10"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); cancelRename(); }}
                            className="rounded p-1 text-muted-foreground hover:bg-muted"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <p className="text-sm font-semibold">
                          {p.name || "Untitled Project"}
                        </p>
                      )}
                    </div>
                    {!isRenaming && (
                      <div className="flex shrink-0 gap-0.5">
                        <button
                          onClick={(e) => startRename(e, p.id, p.name)}
                          className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
                          title={tProjects("rename")}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={(e) => requestDelete(e, p.id)}
                          className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                          title={tProjects("delete")}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {tProjects("last_updated")} {formatDate(p.updatedAt)}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Manage Projects link */}
          <div className="mt-4 text-center">
            <Link
              href="/projects"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              {t("view_all_projects")}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </>
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
            ? tProjects("import_success_title")
            : tProjects("import_error_title")
        }
        message={
          importResult?.success
            ? tProjects("import_success_message", { name: importResult.projectName ?? "" })
            : tProjects("import_error_message")
        }
        okLabel={tProjects("import_ok")}
        openLabel={tProjects("import_open")}
        onOpenProject={() => {
          setImportResult(null);
          router.push("/upload");
        }}
        onDismiss={() => setImportResult(null)}
      />

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={!!deleteId}
        title={tProjects("delete_title")}
        message={tProjects("delete_message")}
        confirmLabel={tProjects("delete_confirm")}
        cancelLabel={tProjects("delete_cancel")}
        onConfirm={() => {
          if (deleteId) removeProject(deleteId);
          setDeleteId(null);
        }}
        onCancel={() => setDeleteId(null)}
      />
    </section>
  );
}
