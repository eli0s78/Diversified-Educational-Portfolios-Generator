"use client";

import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { useState, useEffect } from "react";
import type { CourseOutline, SupervisorMatch } from "@/lib/engine/portfolio-types";
import {
  Download,
  FileText,
  FileType,
  BookOpen,
  Clock,
  Layers,
  GraduationCap,
  Save,
  Loader2,
} from "lucide-react";
import { getCurrentProject, exportProjectToFile } from "@/lib/project-manager";
import { useProject } from "@/lib/project-context";
import { exportCoursesToDocx, exportCoursesToPdf } from "@/lib/export-courses";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { EmptyState } from "@/components/ui/EmptyState";

export default function ExportPage() {
  const t = useTranslations("export");
  const { currentProject: ctxProject } = useProject();
  const locale = useLocale();
  const [courses, setCourses] = useState<CourseOutline[]>([]);
  const [supervisors, setSupervisors] = useState<Record<string, SupervisorMatch[]>>({});
  const [exporting, setExporting] = useState<"docx" | "pdf" | null>(null);

  useEffect(() => {
    const project = ctxProject ?? getCurrentProject();
    if (project && project.courses.length > 0) {
      setCourses(project.courses);
      if (project.courseSupervisors) {
        setSupervisors(project.courseSupervisors);
      }
    }
  }, [ctxProject]);

  const totalHours = courses.reduce((sum, c) => sum + c.totalHours, 0);
  const totalModules = courses.reduce((sum, c) => sum + c.modules.length, 0);
  const totalUnits = courses.reduce(
    (sum, c) => sum + c.modules.reduce((ms, m) => ms + m.units.length, 0),
    0
  );

  const handleExport = async (format: "docx" | "pdf") => {
    setExporting(format);
    try {
      const project = getCurrentProject();
      const programTitle = project?.analysis?.programTitle || "Course Outlines";
      if (format === "docx") {
        await exportCoursesToDocx(courses, supervisors, programTitle, locale);
      } else {
        await exportCoursesToPdf(courses, supervisors, programTitle, locale);
      }
    } catch (err) {
      console.error(`Export ${format} error:`, err);
    } finally {
      setExporting(null);
    }
  };

  const exportProject = () => {
    const project = getCurrentProject();
    if (project) {
      exportProjectToFile(project);
    }
  };

  if (courses.length === 0) {
    return (
      <PageContainer size="md">
        <EmptyState
          icon={Download}
          message={
            locale === "el"
              ? "Δεν υπάρχουν μαθήματα για εξαγωγή. Δημιουργήστε πρώτα μαθήματα."
              : "No courses to export. Generate courses first."
          }
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer size="md">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      {/* Summary */}
      <Card className="mb-8">
        <CardContent>
          <h2 className="mb-4 text-lg font-semibold">{t("summary")}</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard icon={BookOpen} label={t("total_courses")} value={courses.length} color="primary" />
            <StatCard icon={Clock} label={t("total_hours")} value={totalHours} color="accent" />
            <StatCard icon={Layers} label={t("total_modules")} value={totalModules} color="success" />
            <StatCard icon={GraduationCap} label={t("total_units")} value={totalUnits} color="secondary" />
          </div>
        </CardContent>
      </Card>

      {/* Export Buttons */}
      <div className="grid gap-4 sm:grid-cols-3">
        <button
          onClick={() => handleExport("docx")}
          disabled={exporting !== null}
          className="flex items-center gap-4 rounded-xl border border-border bg-card p-6 transition-all duration-200 hover:shadow-md disabled:opacity-60"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
            {exporting === "docx" ? (
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            ) : (
              <FileText className="h-6 w-6 text-primary" />
            )}
          </div>
          <div className="text-left">
            <div className="font-semibold">{t("docx")}</div>
            <div className="text-sm text-muted-foreground">.docx</div>
          </div>
        </button>

        <button
          onClick={() => handleExport("pdf")}
          disabled={exporting !== null}
          className="flex items-center gap-4 rounded-xl border border-border bg-card p-6 transition-all duration-200 hover:shadow-md disabled:opacity-60"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10">
            {exporting === "pdf" ? (
              <Loader2 className="h-6 w-6 animate-spin text-accent" />
            ) : (
              <FileType className="h-6 w-6 text-accent" />
            )}
          </div>
          <div className="text-left">
            <div className="font-semibold">{t("pdf")}</div>
            <div className="text-sm text-muted-foreground">.pdf</div>
          </div>
        </button>

        <button
          onClick={exportProject}
          className="flex items-center gap-4 rounded-xl border border-border bg-card p-6 transition-all duration-200 hover:shadow-md"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-success/10">
            <Save className="h-6 w-6 text-success" />
          </div>
          <div className="text-left">
            <div className="font-semibold">{t("project_file")}</div>
            <div className="text-sm text-muted-foreground">{t("project_file_desc")}</div>
          </div>
        </button>
      </div>
    </PageContainer>
  );
}
