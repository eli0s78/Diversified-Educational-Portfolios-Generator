"use client";

import { useTranslations } from "next-intl";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";
import {
  Eye,
  EyeOff,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  ArrowLeft,
  User,
  GraduationCap,
  Building2,
  BookOpen,
  Code2,
  ExternalLink,
  Loader2,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";
import {
  getSettings,
  saveSettings,
  type AppSettings,
} from "@/lib/project-manager";
import { getStoredTheme, setStoredTheme, type Theme } from "@/lib/theme";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";

const TECH_STACK = [
  { name: "Next.js", version: "16.1.6" },
  { name: "React", version: "19.2" },
  { name: "TypeScript", version: "5" },
  { name: "Tailwind CSS", version: "4" },
  { name: "Recharts", version: "3.7" },
  { name: "Google Generative AI", version: "" },
  { name: "next-intl", version: "4.8" },
  { name: "docx", version: "" },
  { name: "jsPDF", version: "" },
  { name: "PapaParse", version: "" },
  { name: "Zod", version: "" },
  { name: "lucide-react", version: "" },
];

type TabID = "general" | "appearance" | "about";

const THEME_OPTIONS: { id: Theme; icon: typeof Sun }[] = [
  { id: "system", icon: Monitor },
  { id: "light", icon: Sun },
  { id: "dark", icon: Moon },
];

function detectKeyMismatch(key: string): string | null {
  if (!key || key.length < 5) return null;
  if (key.startsWith("sk-ant-")) return "This looks like a Claude (Anthropic) key, not a Gemini key.";
  if (key.startsWith("sk-proj-") || key.startsWith("sk-")) return "This looks like an OpenAI key, not a Gemini key.";
  return null;
}

export default function SettingsPage() {
  const t = useTranslations("settings");
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabID>("general");
  const [theme, setTheme] = useState<Theme>("system");

  const [settings, setSettings] = useState<AppSettings>({
    name: "",
    apiKey: "",
  });
  const [loaded, setLoaded] = useState(false);

  const [showApiKey, setShowApiKey] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Load settings on mount
  useEffect(() => {
    const s = getSettings();
    setSettings(s);
    setTheme(getStoredTheme());
    setLoaded(true);
  }, []);

  // Auto-save when settings change (after initial load)
  useEffect(() => {
    if (!loaded) return;
    saveSettings(settings);
  }, [settings, loaded]);

  const updateApiKey = (value: string) => {
    setSettings((prev) => ({
      ...prev,
      apiKey: value,
      verifiedModel: undefined,
      verifiedTier: undefined,
    }));
    setVerifyError(null);
  };

  const handleVerify = useCallback(async () => {
    if (!settings.apiKey.trim()) return;

    setVerifying(true);
    setVerifyError(null);

    try {
      const res = await fetch("/api/verify-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: settings.apiKey.trim(),
        }),
      });

      if (res.status === 504) {
        setVerifyError("Request timed out. Please try again.");
        setVerifying(false);
        return;
      }

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        setVerifyError(`Server error (${res.status}). Please try again.`);
        setVerifying(false);
        return;
      }

      if (data.valid) {
        setSettings((prev) => ({
          ...prev,
          verifiedModel: data.model,
          verifiedTier: data.tier ?? null,
        }));
      } else {
        setVerifyError(data.error || "Invalid API key");
        setSettings((prev) => ({
          ...prev,
          verifiedModel: undefined,
          verifiedTier: undefined,
        }));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("abort") || msg.includes("timeout")) {
        setVerifyError("Request timed out. The server may be busy — please try again.");
      } else {
        setVerifyError("Connection failed. Check your internet connection.");
      }
    } finally {
      setVerifying(false);
    }
  }, [settings]);

  const handleThemeChange = (newTheme: Theme) => {
    setStoredTheme(newTheme);
    setTheme(newTheme);
  };

  const tabs: { id: TabID; label: string }[] = [
    { id: "general", label: t("tab_general") },
    { id: "appearance", label: t("tab_appearance") },
    { id: "about", label: t("tab_about") },
  ];

  const isVerified = !!settings.verifiedModel;
  const hasKey = settings.apiKey.trim().length > 0;
  const keyMismatch = detectKeyMismatch(settings.apiKey);

  return (
    <PageContainer size="md">
      <PageHeader title={t("title")} />

      {/* Tab bar */}
      <div className="mb-6 flex gap-1 rounded-lg border border-border bg-muted/30 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors",
              activeTab === tab.id
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* General Tab */}
      {activeTab === "general" && (
        <div className="space-y-6">
          {/* Name */}
          <Card>
            <CardContent>
              <label className="mb-1.5 block text-sm font-medium">
                {t("name")}
              </label>
              <Input
                type="text"
                value={settings.name}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder={t("name_placeholder")}
              />
              <p className="mt-1 text-xs text-muted-foreground">{t("name_hint")}</p>
            </CardContent>
          </Card>

          {/* Gemini API Key */}
          <Card>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">{t("gemini_api_key")}</h3>
                {isVerified && (
                  <Badge variant="success">{t("verified")}</Badge>
                )}
              </div>

              {/* API Key input */}
              <div className="relative">
                <Input
                  type={showApiKey ? "text" : "password"}
                  value={settings.apiKey}
                  onChange={(e) => updateApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
                  tabIndex={-1}
                >
                  {showApiKey ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>

              {/* Key format warning */}
              {keyMismatch && (
                <div className="flex items-start gap-2 rounded-lg bg-accent/10 px-3 py-2 text-xs text-accent">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{keyMismatch}</span>
                </div>
              )}

              {/* Verify button */}
              {hasKey && !isVerified && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleVerify}
                  disabled={verifying}
                >
                  {verifying ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      {t("verifying")}
                    </>
                  ) : (
                    t("verify")
                  )}
                </Button>
              )}

              {/* Verified model display */}
              {isVerified && (
                <div className="rounded-lg border border-success/30 bg-success/5 px-3 py-2">
                  <div className="flex items-center gap-2 text-xs">
                    <ShieldCheck className="h-3.5 w-3.5 text-success" />
                    <span className="font-medium text-success">
                      {t("active_model")}:
                    </span>
                    <code className="rounded bg-success/10 px-1.5 py-0.5 font-mono text-[11px] font-bold text-success">
                      {settings.verifiedModel}
                    </code>
                    {settings.verifiedTier && (
                      <span
                        className={cn(
                          "rounded-md px-1.5 py-0.5 text-[10px] font-medium",
                          settings.verifiedTier === "paid"
                            ? "bg-success/20 text-success"
                            : "bg-accent/10 text-accent"
                        )}
                      >
                        {t(`tier_${settings.verifiedTier}`)}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {t("key_validated")}
                  </p>
                </div>
              )}

              {/* Verify error */}
              {verifyError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
                  <div className="flex items-start gap-2 text-xs text-destructive">
                    <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{verifyError}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Research & Data Collection APIs */}
          <Card>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold">{t("research_apis_title")}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{t("research_apis_hint")}</p>
              </div>

              {/* Semantic Scholar */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  {t("semantic_scholar_key")}
                </label>
                <Input
                  type="password"
                  value={settings.semantic_scholar_api_key || ""}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, semantic_scholar_api_key: e.target.value }))
                  }
                  placeholder="Optional"
                />
                <p className="mt-1 text-xs text-muted-foreground">{t("semantic_scholar_hint")}</p>
              </div>

              {/* Exa */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  {t("exa_key")}
                </label>
                <Input
                  type="password"
                  value={settings.exa_api_key || ""}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, exa_api_key: e.target.value }))
                  }
                  placeholder="Optional"
                />
                <p className="mt-1 text-xs text-muted-foreground">{t("exa_hint")}</p>
              </div>

              {/* O*NET */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  {t("onet_key")}
                </label>
                <Input
                  type="password"
                  value={settings.onet_api_key || ""}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, onet_api_key: e.target.value }))
                  }
                  placeholder="Optional"
                />
                <p className="mt-1 text-xs text-muted-foreground">{t("onet_hint")}</p>
              </div>

              {/* BLS */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  {t("bls_key")}
                </label>
                <Input
                  type="password"
                  value={settings.bls_api_key || ""}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, bls_api_key: e.target.value }))
                  }
                  placeholder="Optional"
                />
                <p className="mt-1 text-xs text-muted-foreground">{t("bls_hint")}</p>
              </div>

              {/* Tavily */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  {t("tavily_key")}
                </label>
                <Input
                  type="password"
                  value={settings.tavily_api_key || ""}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, tavily_api_key: e.target.value }))
                  }
                  placeholder="Optional"
                />
                <p className="mt-1 text-xs text-muted-foreground">{t("tavily_hint")}</p>
              </div>

              {/* Firecrawl */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  {t("firecrawl_key")}
                </label>
                <Input
                  type="password"
                  value={settings.firecrawl_api_key || ""}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, firecrawl_api_key: e.target.value }))
                  }
                  placeholder="Optional"
                />
                <p className="mt-1 text-xs text-muted-foreground">{t("firecrawl_hint")}</p>
              </div>

              {/* BERTopic Service URL */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  {t("bertopic_url")}
                </label>
                <Input
                  type="text"
                  value={settings.bertopic_service_url || ""}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, bertopic_service_url: e.target.value }))
                  }
                  placeholder="https://your-bertopic-service.railway.app"
                />
                <p className="mt-1 text-xs text-muted-foreground">{t("bertopic_url_hint")}</p>
              </div>
            </CardContent>
          </Card>

          {/* Done / Cancel */}
          <div className="flex gap-3">
            <Button
              variant="secondary"
              size="md"
              className="flex-1"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-4 w-4" />
              {t("cancel")}
            </Button>
            <Button
              variant="primary"
              size="md"
              className="flex-1"
              onClick={() => router.back()}
            >
              {t("done")}
            </Button>
          </div>
        </div>
      )}

      {/* Appearance Tab */}
      {activeTab === "appearance" && (
        <div className="space-y-6">
          <Card>
            <CardContent>
              <h2 className="mb-1 text-sm font-semibold">{t("theme")}</h2>
              <p className="mb-4 text-xs text-muted-foreground">{t("theme_hint")}</p>
              <div className="grid grid-cols-3 gap-3">
                {THEME_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = theme === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => handleThemeChange(opt.id)}
                      className={cn(
                        "flex flex-col items-center gap-2 rounded-xl border px-4 py-4 text-sm font-medium transition-all",
                        isSelected
                          ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/30"
                          : "border-border hover:bg-muted"
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      {t(`theme_${opt.id}`)}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* About Tab */}
      {activeTab === "about" && (
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-5">
              <h2 className="text-sm font-semibold">{t("about_title")}</h2>

              {/* Creator */}
              <div className="flex items-start gap-3">
                <User className="mt-0.5 h-4 w-4 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">{t("creator")}</p>
                  <p className="text-sm font-medium">{t("creator_name")}</p>
                  <a
                    href={`mailto:${t("creator_email")}`}
                    className="text-xs text-primary hover:underline"
                  >
                    {t("creator_email")}
                  </a>
                </div>
              </div>

              {/* Supervisor */}
              <div className="flex items-start gap-3">
                <GraduationCap className="mt-0.5 h-4 w-4 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">{t("supervisor")}</p>
                  <p className="text-sm font-medium">{t("supervisor_name")}</p>
                </div>
              </div>

              {/* Organization */}
              <div className="flex items-start gap-3">
                <Building2 className="mt-0.5 h-4 w-4 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">{t("organization")}</p>
                  <p className="text-sm font-medium">{t("organization_name")}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Research reference */}
          <Card>
            <CardContent>
              <div className="flex items-start gap-3">
                <BookOpen className="mt-0.5 h-4 w-4 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">{t("based_on")}</p>
                  <p className="mt-1 text-sm leading-relaxed">
                    {t("reference_text")}
                  </p>
                  <a
                    href={`https://doi.org/${t("reference_doi")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    DOI: {t("reference_doi")}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tech stack */}
          <Card>
            <CardContent>
              <div className="mb-3 flex items-center gap-2">
                <Code2 className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">{t("tech_stack")}</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {TECH_STACK.map((tech) => (
                  <Badge key={tech.name} variant="muted">
                    {tech.name}
                    {tech.version ? ` ${tech.version}` : ""}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Version */}
          <p className="text-center text-xs text-muted-foreground">
            {t("version")} 0.1.0
          </p>
        </div>
      )}
    </PageContainer>
  );
}
