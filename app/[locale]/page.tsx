"use client";

import { useTranslations } from "next-intl";
import { useState, useEffect } from "react";
import { useRouter } from "@/lib/i18n/navigation";
import { Link } from "@/lib/i18n/navigation";
import { ArrowRight, Settings, Check, AlertCircle } from "lucide-react";
import { getSettings } from "@/lib/project-manager";
import { useProject } from "@/lib/project-context";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { PageContainer } from "@/components/ui/PageContainer";
import HeroSection from "@/components/home/HeroSection";
import ConceptSection from "@/components/home/ConceptSection";
import DirectionsGrid from "@/components/home/DirectionsGrid";
import HowItWorks from "@/components/home/HowItWorks";

export default function HomePage() {
  const t = useTranslations("home");
  const router = useRouter();
  const { currentProject, projects, switchProject, createProject } = useProject();

  const [userName, setUserName] = useState("");
  const [hasAI, setHasAI] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const settings = getSettings();
    setUserName(settings.name || "");
    setHasAI(!!settings.apiKey);
    setReady(true);
  }, []);

  const isReturningUser = projects.length > 0 && userName;

  if (!ready) return null;

  // -------------------------------------------------------
  // Returning User Layout
  // -------------------------------------------------------
  if (isReturningUser) {
    const recentProjects = [...projects]
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )
      .slice(0, 4);

    return (
      <PageContainer size="lg">
        <HeroSection compact />

        {/* Welcome + Quick Resume */}
        <section className="mb-8">
          <h2 className="mb-4 text-lg font-semibold">
            {t("welcome_back", { name: userName })}
          </h2>

          {currentProject && (
            <Card className="mb-4 transition-all duration-200 hover:shadow-md">
              <CardContent className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">
                    {t("continue_project")}
                  </p>
                  <p className="truncate font-semibold">
                    {currentProject.name}
                  </p>
                </div>
                <Button
                  onClick={() => router.push("/upload")}
                  size="md"
                >
                  {t("projects_continue")}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          )}
        </section>

        {/* Recent Projects */}
        {recentProjects.length > 1 && (
          <section className="mb-8">
            <h3 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              {t("recent_projects")}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {recentProjects
                .filter((p) => p.id !== currentProject?.id)
                .slice(0, 3)
                .map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      switchProject(p.id);
                      router.push("/upload");
                    }}
                    className="rounded-lg border border-border bg-card p-4 text-left transition-all duration-200 hover:shadow-md"
                  >
                    <p className="truncate text-sm font-medium">
                      {p.name || "Untitled Project"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(p.updatedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </button>
                ))}
            </div>
          </section>
        )}

        {/* Settings Status Banner */}
        <section className="mb-8">
          <Link
            href="/settings"
            className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 transition-all duration-200 hover:shadow-md"
          >
            <div className="flex items-center gap-2">
              {hasAI ? (
                <Check className="h-4 w-4 text-success" />
              ) : (
                <AlertCircle className="h-4 w-4 text-accent" />
              )}
              <span className="text-sm font-medium">
                {hasAI ? t("ai_configured") : t("no_ai_configured")}
              </span>
            </div>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </Link>
        </section>

        {/* Collapsible Learn More */}
        <details className="group">
          <summary className="mb-6 cursor-pointer text-sm font-medium text-primary hover:underline">
            {t("learn_more")}
          </summary>
          <ConceptSection />
          <DirectionsGrid />
          <HowItWorks />
        </details>
      </PageContainer>
    );
  }

  // -------------------------------------------------------
  // New User Layout
  // -------------------------------------------------------
  return (
    <PageContainer size="xl">
      <HeroSection />

      {/* CTA */}
      <section className="mb-12 text-center">
        <Button
          onClick={() => {
            if (hasAI) {
              if (!currentProject) createProject();
              router.push("/upload");
            } else {
              router.push("/settings");
            }
          }}
          size="xl"
          className="mx-auto"
        >
          {t("cta")}
          <ArrowRight className="h-5 w-5" />
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">
          {hasAI ? "" : t("get_started_subtitle")}
        </p>
      </section>

      <ConceptSection />
      <HowItWorks />
      <DirectionsGrid />
    </PageContainer>
  );
}
