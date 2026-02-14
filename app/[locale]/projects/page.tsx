"use client";

import { useState, useRef } from "react";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/lib/i18n/navigation";
import { useProject } from "@/lib/project-context";
import {
  loadProject,
  exportProjectToFile,
} from "@/lib/project-manager";
import {
  Plus,
  Upload,
  Download,
  Trash2,
  FolderOpen,
  Pencil,
  Check,
  X,
  ArrowLeft,
} from "lucide-react";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ImportResultDialog } from "@/components/ui/ImportResultDialog";
import { cn } from "@/lib/utils";

export default function ProjectsPage() {
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
  } = useProject();

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{ success: boolean; projectName?: string } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sorted = [...projects].sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

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

  const handleOpen = (id: string) => {
    switchProject(id);
    router.push("/upload");
  };

  const handleExport = (id: string) => {
    const project = loadProject(id);
    if (project) {
      exportProjectToFile(project);
    }
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
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "";
    }
  };

  return (
    <PageContainer size="lg">
      <Link
        href="/"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("back")}
      </Link>

      <div className="mb-8 flex items-start justify-between gap-4">
        <PageHeader title={t("title")} subtitle={t("subtitle")} />
        <div className="flex shrink-0 gap-2 pt-1">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5" />
            {t("import")}
          </Button>
          <Button size="sm" onClick={handleNew}>
            <Plus className="h-3.5 w-3.5" />
            {t("new")}
          </Button>
        </div>
      </div>

      {projects.length === 0 ? (
        <Card>
          <EmptyState
            icon={FolderOpen}
            message={t("no_projects")}
            action={
              <div className="flex justify-center gap-3">
                <Button onClick={handleNew}>
                  <Plus className="h-4 w-4" />
                  {t("new")}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  {t("import")}
                </Button>
              </div>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((p) => {
            const isCurrent = p.id === currentProject?.id;
            const isRenaming = renamingId === p.id;

            return (
              <Card
                key={p.id}
                className={cn(
                  "transition-all duration-200 hover:shadow-md",
                  isCurrent && "ring-1 ring-primary/30"
                )}
              >
                <CardContent className="space-y-3">
                  {/* Header: name + current badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
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
                            className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm font-semibold focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                            placeholder={t("rename_placeholder")}
                            autoFocus
                          />
                          <button
                            onClick={confirmRename}
                            className="rounded p-1 text-success hover:bg-success/10"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            onClick={cancelRename}
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
                    {isCurrent && !isRenaming && (
                      <Badge variant="primary">{t("current")}</Badge>
                    )}
                  </div>

                  {/* Dates */}
                  <div className="space-y-0.5 text-xs text-muted-foreground">
                    <p>
                      {t("created")} {formatDate(p.createdAt)}
                    </p>
                    <p>
                      {t("last_updated")} {formatDate(p.updatedAt)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1.5 border-t border-border pt-3">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => handleOpen(p.id)}
                    >
                      {t("open")}
                    </Button>
                    <button
                      onClick={() => startRename(p.id, p.name)}
                      className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      title={t("rename")}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleExport(p.id)}
                      className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      title={t("export")}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteId(p.id)}
                      className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      title={t("delete")}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Hidden file input */}
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
    </PageContainer>
  );
}
