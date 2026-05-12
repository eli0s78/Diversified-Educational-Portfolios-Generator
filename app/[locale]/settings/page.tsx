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
  CheckCircle2,
  Search,
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

  // Gemini active model state
  const [activeGeminiModel, setActiveGeminiModel] = useState<string | null>(null);
  const [geminiStatusError, setGeminiStatusError] = useState<string | null>(null);
  const [geminiStatusLoading, setGeminiStatusLoading] = useState(true);

  // API Key validation state
  type ServiceValidationState = {
    validating: boolean;
    valid: boolean | null;
    message: string | null;
  };
  const [validationState, setValidationState] = useState<
    Record<string, ServiceValidationState>
  >({});

  // Load settings on mount
  useEffect(() => {
    const s = getSettings();
    setSettings(s);
    setTheme(getStoredTheme());

    // Initialize validation state from persisted settings
    const initialValidationState: Record<string, ServiceValidationState> = {};
    if (s.semantic_scholar_validated) {
      initialValidationState.semantic_scholar = {
        validating: false,
        valid: true,
        message: null,
      };
    }
    if (s.onet_validated) {
      initialValidationState.onet = {
        validating: false,
        valid: true,
        message: null,
      };
    }
    if (s.bls_validated) {
      initialValidationState.bls = {
        validating: false,
        valid: true,
        message: null,
      };
    }
    if (s.tavily_validated) {
      initialValidationState.tavily = {
        validating: false,
        valid: true,
        message: null,
      };
    }
    if (s.firecrawl_validated) {
      initialValidationState.firecrawl = {
        validating: false,
        valid: true,
        message: null,
      };
    }
    if (s.fred_validated) {
      initialValidationState.fred = {
        validating: false,
        valid: true,
        message: null,
      };
    }
    if (s.core_validated) {
      initialValidationState.core = {
        validating: false,
        valid: true,
        message: null,
      };
    }
    if (s.google_books_validated) {
      initialValidationState.google_books = {
        validating: false,
        valid: true,
        message: null,
      };
    }
    if (s.exa_validated) {
      initialValidationState.exa = {
        validating: false,
        valid: true,
        message: null,
      };
    }
    setValidationState(initialValidationState);

    // Fetch Gemini active model status
    fetch("/api/gemini-status")
      .then((res) => res.json())
      .then((data) => {
        if (data.valid) {
          setActiveGeminiModel(data.model);
        } else {
          setGeminiStatusError(data.error || "Failed to resolve Gemini model");
        }
      })
      .catch((err) => {
        setGeminiStatusError("Could not connect to Gemini status API.");
      })
      .finally(() => {
        setGeminiStatusLoading(false);
      });

    setLoaded(true);
  }, []);

  // Auto-save when settings change (after initial load)
  useEffect(() => {
    if (!loaded) return;
    saveSettings(settings);
  }, [settings, loaded]);

  // Validate API key for a service
  const validateApiKey = async (
    service: "onet" | "semantic_scholar" | "tavily" | "firecrawl" | "bertopic" | "bls" | "fred" | "exa" | "core" | "google_books",
    apiKey?: string,
    serviceUrl?: string
  ) => {
    setValidationState((prev) => ({
      ...prev,
      [service]: { validating: true, valid: null, message: null },
    }));

    try {
      const response = await fetch("/api/validate-api-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service, apiKey, serviceUrl }),
      });

      const data = await response.json();

      setValidationState((prev) => ({
        ...prev,
        [service]: {
          validating: false,
          valid: data.valid,
          message: data.message,
        },
      }));

      // Persist validation state to settings
      if (data.valid) {
        setSettings((prev) => ({
          ...prev,
          [`${service}_validated`]: true,
        }));

        // Auto-hide success MESSAGE after 5 seconds (but keep valid flag)
        setTimeout(() => {
          setValidationState((prev) => ({
            ...prev,
            [service]: { ...prev[service], message: null },
          }));
        }, 5000);
      } else {
        // Clear validation flag if validation failed
        setSettings((prev) => ({
          ...prev,
          [`${service}_validated`]: false,
        }));
      }
    } catch (error) {
      setValidationState((prev) => ({
        ...prev,
        [service]: {
          validating: false,
          valid: false,
          message: `Connection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        },
      }));
    }
  };

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

          {/* Gemini AI - Server-Side Configured */}
          <Card>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">Gemini AI</h3>
                {!geminiStatusLoading && activeGeminiModel && (
                  <Badge variant="success">
                    <ShieldCheck className="mr-1 h-3 w-3" />
                    3.1+ Verified
                  </Badge>
                )}
                {!geminiStatusLoading && geminiStatusError && (
                  <Badge variant="destructive">
                    <AlertTriangle className="mr-1 h-3 w-3" />
                    Validation Failed
                  </Badge>
                )}
                {geminiStatusLoading && (
                  <Badge variant="muted">
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    Checking...
                  </Badge>
                )}
              </div>

              {geminiStatusLoading ? (
                <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                  <div className="flex items-start gap-2 text-xs text-muted-foreground">
                    <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
                    <div>
                      <p className="font-medium">Checking active Gemini model...</p>
                    </div>
                  </div>
                </div>
              ) : activeGeminiModel ? (
                <div className="rounded-lg border border-success/30 bg-success/5 px-3 py-2.5">
                  <div className="flex items-start gap-2 text-xs text-success">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <p className="font-medium">Active Model: {activeGeminiModel}</p>
                      <p className="mt-1 text-[11px] opacity-80">
                        The Gemini API key is securely configured and a compatible Gemini 3.1+ model was found.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5">
                  <div className="flex items-start gap-2 text-xs text-destructive">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <p className="font-medium">Model Resolution Error</p>
                      <p className="mt-1 text-[11px] opacity-80">
                        {geminiStatusError || "Failed to find a compatible Gemini 3.1+ model. Check your server API key and billing status."}
                      </p>
                    </div>
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
                <div className="flex gap-2">
                  <Input
                    type="password"
                    value={settings.semantic_scholar_api_key || ""}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, semantic_scholar_api_key: e.target.value }))
                    }
                    placeholder="Optional"
                    className="flex-1"
                  />
                  <Button
                    variant={validationState.semantic_scholar?.valid ? "success" : "secondary"}
                    size="sm"
                    onClick={() => validateApiKey("semantic_scholar", settings.semantic_scholar_api_key)}
                    disabled={validationState.semantic_scholar?.validating}
                  >
                    {validationState.semantic_scholar?.validating ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : validationState.semantic_scholar?.valid ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <ShieldCheck className="h-3.5 w-3.5" />
                    )}
                    {validationState.semantic_scholar?.valid ? "✓ Validated" : "Validate"}
                  </Button>
                </div>
                {validationState.semantic_scholar?.message && (
                  <div
                    className={cn(
                      "mt-2 flex items-start gap-2 rounded-md px-2 py-1.5 text-xs",
                      validationState.semantic_scholar.valid
                        ? "bg-success/10 text-success"
                        : "bg-destructive/10 text-destructive"
                    )}
                  >
                    {validationState.semantic_scholar.valid ? (
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    )}
                    <span>{validationState.semantic_scholar.message}</span>
                  </div>
                )}
                <p className="mt-1 text-xs text-muted-foreground">{t("semantic_scholar_hint")}</p>
              </div>

              {/* Exa */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  {t("exa_key")}
                </label>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    value={settings.exa_api_key || ""}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, exa_api_key: e.target.value }))
                    }
                    placeholder="Optional"
                    className="flex-1"
                  />
                  <Button
                    variant={validationState.exa?.valid ? "success" : "secondary"}
                    size="sm"
                    onClick={() => validateApiKey("exa", settings.exa_api_key)}
                    disabled={!settings.exa_api_key || validationState.exa?.validating}
                  >
                    {validationState.exa?.validating ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : validationState.exa?.valid ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <ShieldCheck className="h-3.5 w-3.5" />
                    )}
                    {validationState.exa?.valid ? "✓ Validated" : "Validate"}
                  </Button>
                </div>
                {validationState.exa?.message && (
                  <div
                    className={cn(
                      "mt-2 flex items-start gap-2 rounded-md px-2 py-1.5 text-xs",
                      validationState.exa.valid
                        ? "bg-success/10 text-success"
                        : "bg-destructive/10 text-destructive"
                    )}
                  >
                    {validationState.exa.valid ? (
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    )}
                    <span>{validationState.exa.message}</span>
                  </div>
                )}
                <p className="mt-1 text-xs text-muted-foreground">{t("exa_hint")}</p>
              </div>

              {/* O*NET */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  {t("onet_key")}
                </label>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    value={settings.onet_api_key || ""}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, onet_api_key: e.target.value }))
                    }
                    placeholder="Optional"
                    className="flex-1"
                  />
                  <Button
                    variant={validationState.onet?.valid ? "success" : "secondary"}
                    size="sm"
                    onClick={() => validateApiKey("onet", settings.onet_api_key)}
                    disabled={!settings.onet_api_key || validationState.onet?.validating}
                  >
                    {validationState.onet?.validating ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : validationState.onet?.valid ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <ShieldCheck className="h-3.5 w-3.5" />
                    )}
                    {validationState.onet?.valid ? "✓ Validated" : "Validate"}
                  </Button>
                </div>
                {validationState.onet?.message && (
                  <div
                    className={cn(
                      "mt-2 flex items-start gap-2 rounded-md px-2 py-1.5 text-xs",
                      validationState.onet.valid
                        ? "bg-success/10 text-success"
                        : "bg-destructive/10 text-destructive"
                    )}
                  >
                    {validationState.onet.valid ? (
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    )}
                    <span>{validationState.onet.message}</span>
                  </div>
                )}
                <p className="mt-1 text-xs text-muted-foreground">{t("onet_hint")}</p>
              </div>

              {/* BLS */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  {t("bls_key")}
                </label>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    value={settings.bls_api_key || ""}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, bls_api_key: e.target.value }))
                    }
                    placeholder="Optional"
                    className="flex-1"
                  />
                  <Button
                    variant={validationState.bls?.valid ? "success" : "secondary"}
                    size="sm"
                    onClick={() => validateApiKey("bls", settings.bls_api_key)}
                    disabled={!settings.bls_api_key || validationState.bls?.validating}
                  >
                    {validationState.bls?.validating ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : validationState.bls?.valid ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <ShieldCheck className="h-3.5 w-3.5" />
                    )}
                    {validationState.bls?.valid ? "✓ Validated" : "Validate"}
                  </Button>
                </div>
                {validationState.bls?.message && (
                  <div
                    className={cn(
                      "mt-2 flex items-start gap-2 rounded-md px-2 py-1.5 text-xs",
                      validationState.bls.valid
                        ? "bg-success/10 text-success"
                        : "bg-destructive/10 text-destructive"
                    )}
                  >
                    {validationState.bls.valid ? (
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    )}
                    <span>{validationState.bls.message}</span>
                  </div>
                )}
                <p className="mt-1 text-xs text-muted-foreground">{t("bls_hint")}</p>
              </div>

              {/* Google Books */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  {t("google_books_key")}
                </label>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    value={settings.google_books_api_key || ""}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, google_books_api_key: e.target.value }))
                    }
                    placeholder="Optional"
                    className="flex-1"
                  />
                  <Button
                    variant={validationState.google_books?.valid ? "success" : "secondary"}
                    size="sm"
                    onClick={() => validateApiKey("google_books", settings.google_books_api_key)}
                    disabled={!settings.google_books_api_key || validationState.google_books?.validating}
                  >
                    {validationState.google_books?.validating ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : validationState.google_books?.valid ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <ShieldCheck className="h-3.5 w-3.5" />
                    )}
                    {validationState.google_books?.valid ? "✓ Validated" : "Validate"}
                  </Button>
                </div>
                {validationState.google_books?.message && (
                  <div
                    className={cn(
                      "mt-2 flex items-start gap-2 rounded-md px-2 py-1.5 text-xs",
                      validationState.google_books.valid
                        ? "bg-success/10 text-success"
                        : "bg-destructive/10 text-destructive"
                    )}
                  >
                    {validationState.google_books.valid ? (
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    )}
                    <span>{validationState.google_books.message}</span>
                  </div>
                )}
                <p className="mt-1 text-xs text-muted-foreground">{t("google_books_hint")}</p>
              </div>

              {/* Tavily */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  {t("tavily_key")}
                </label>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    value={settings.tavily_api_key || ""}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, tavily_api_key: e.target.value }))
                    }
                    placeholder="Optional"
                    className="flex-1"
                  />
                  <Button
                    variant={validationState.tavily?.valid ? "success" : "secondary"}
                    size="sm"
                    onClick={() => validateApiKey("tavily", settings.tavily_api_key)}
                    disabled={!settings.tavily_api_key || validationState.tavily?.validating}
                  >
                    {validationState.tavily?.validating ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : validationState.tavily?.valid ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <ShieldCheck className="h-3.5 w-3.5" />
                    )}
                    {validationState.tavily?.valid ? "✓ Validated" : "Validate"}
                  </Button>
                </div>
                {validationState.tavily?.message && (
                  <div
                    className={cn(
                      "mt-2 flex items-start gap-2 rounded-md px-2 py-1.5 text-xs",
                      validationState.tavily.valid
                        ? "bg-success/10 text-success"
                        : "bg-destructive/10 text-destructive"
                    )}
                  >
                    {validationState.tavily.valid ? (
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    )}
                    <span>{validationState.tavily.message}</span>
                  </div>
                )}
                <p className="mt-1 text-xs text-muted-foreground">{t("tavily_hint")}</p>
              </div>

              {/* Firecrawl */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  {t("firecrawl_key")}
                </label>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    value={settings.firecrawl_api_key || ""}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, firecrawl_api_key: e.target.value }))
                    }
                    placeholder="Optional"
                    className="flex-1"
                  />
                  <Button
                    variant={validationState.firecrawl?.valid ? "success" : "secondary"}
                    size="sm"
                    onClick={() => validateApiKey("firecrawl", settings.firecrawl_api_key)}
                    disabled={!settings.firecrawl_api_key || validationState.firecrawl?.validating}
                  >
                    {validationState.firecrawl?.validating ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : validationState.firecrawl?.valid ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <ShieldCheck className="h-3.5 w-3.5" />
                    )}
                    {validationState.firecrawl?.valid ? "✓ Validated" : "Validate"}
                  </Button>
                </div>
                {validationState.firecrawl?.message && (
                  <div
                    className={cn(
                      "mt-2 flex items-start gap-2 rounded-md px-2 py-1.5 text-xs",
                      validationState.firecrawl.valid
                        ? "bg-success/10 text-success"
                        : "bg-destructive/10 text-destructive"
                    )}
                  >
                    {validationState.firecrawl.valid ? (
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    )}
                    <span>{validationState.firecrawl.message}</span>
                  </div>
                )}
                <p className="mt-1 text-xs text-muted-foreground">{t("firecrawl_hint")}</p>
              </div>

              {/* FRED */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  FRED API Key (Federal Reserve Economic Data)
                </label>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    value={settings.fred_api_key || ""}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, fred_api_key: e.target.value }))
                    }
                    placeholder="Optional"
                    className="flex-1"
                  />
                  <Button
                    variant={validationState.fred?.valid ? "success" : "secondary"}
                    size="sm"
                    onClick={() => validateApiKey("fred", settings.fred_api_key)}
                    disabled={!settings.fred_api_key || validationState.fred?.validating}
                  >
                    {validationState.fred?.validating ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : validationState.fred?.valid ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <ShieldCheck className="h-3.5 w-3.5" />
                    )}
                    {validationState.fred?.valid ? "✓ Validated" : "Validate"}
                  </Button>
                </div>
                {validationState.fred?.message && (
                  <div
                    className={cn(
                      "mt-2 flex items-start gap-2 rounded-md px-2 py-1.5 text-xs",
                      validationState.fred.valid
                        ? "bg-success/10 text-success"
                        : "bg-destructive/10 text-destructive"
                    )}
                  >
                    {validationState.fred.valid ? (
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    )}
                    <span>{validationState.fred.message}</span>
                  </div>
                )}
                <p className="mt-1 text-xs text-muted-foreground">Used for economic/finance sector trends. Free key available at fred.stlouisfed.org</p>
              </div>

              {/* CORE */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  {t("core_key")}
                </label>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    value={settings.core_api_key || ""}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, core_api_key: e.target.value }))
                    }
                    placeholder="Optional"
                    className="flex-1"
                  />
                  <Button
                    variant={validationState.core?.valid ? "success" : "secondary"}
                    size="sm"
                    onClick={() => validateApiKey("core", settings.core_api_key)}
                    disabled={!settings.core_api_key || validationState.core?.validating}
                  >
                    {validationState.core?.validating ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : validationState.core?.valid ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <ShieldCheck className="h-3.5 w-3.5" />
                    )}
                    {validationState.core?.valid ? "✓ Validated" : "Validate"}
                  </Button>
                </div>
                {validationState.core?.message && (
                  <div
                    className={cn(
                      "mt-2 flex items-start gap-2 rounded-md px-2 py-1.5 text-xs",
                      validationState.core.valid
                        ? "bg-success/10 text-success"
                        : "bg-destructive/10 text-destructive"
                    )}
                  >
                    {validationState.core.valid ? (
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    )}
                    <span>{validationState.core.message}</span>
                  </div>
                )}
                <p className="mt-1 text-xs text-muted-foreground">{t("core_hint")}</p>
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

          {/* Research Engines */}
          <Card>
            <CardContent>
              <div className="mb-3 flex items-center gap-2">
                <Search className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">{t("research_engines")}</h2>
              </div>
              <p className="mb-4 text-xs text-muted-foreground leading-relaxed">
                {t("research_engines_desc")}
              </p>

              <div className="space-y-4 rounded-lg bg-muted/30 p-4 border border-border">
                <div>
                  <h3 className="text-xs font-semibold text-foreground">{t("research_search")}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{t("research_search_desc")}</p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-foreground">{t("research_scrape")}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{t("research_scrape_desc")}</p>
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
