"use client";

import { useTranslations } from "next-intl";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";
import {
  Check,
  Eye,
  EyeOff,
  Settings,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  ArrowLeft,
} from "lucide-react";
import { getSettings, saveSettings, type AppSettings } from "@/lib/project-manager";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const AI_PROVIDERS = [
  { id: "claude", label: "Claude (Anthropic)", keyHint: "sk-ant-api03-..." },
  { id: "openai", label: "GPT (OpenAI)", keyHint: "sk-proj-..." },
  { id: "gemini", label: "Gemini (Google)", keyHint: "AIzaSy..." },
] as const;

export default function SettingsPage() {
  const t = useTranslations("settings");
  const router = useRouter();

  const [settings, setSettings] = useState<AppSettings>({
    name: "",
    aiProvider: "claude",
    apiKey: "",
  });
  const [savedSnapshot, setSavedSnapshot] = useState<AppSettings>({
    name: "",
    aiProvider: "claude",
    apiKey: "",
  });

  const [showApiKey, setShowApiKey] = useState(false);
  const [verifiedModel, setVerifiedModel] = useState<string | null>(null);
  const [verifiedTier, setVerifiedTier] = useState<"free" | "paid" | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [keyFormatWarning, setKeyFormatWarning] = useState<string | null>(null);

  const isDirty =
    settings.name !== savedSnapshot.name ||
    settings.aiProvider !== savedSnapshot.aiProvider ||
    settings.apiKey !== savedSnapshot.apiKey;

  // Clear verification state when settings change
  useEffect(() => {
    if (isDirty) {
      setVerifiedModel(null);
      setVerifiedTier(null);
      setVerifyError(null);
    }
  }, [isDirty]);

  // Client-side key format check
  useEffect(() => {
    const key = settings.apiKey.trim();
    if (!key || key.length < 5) {
      setKeyFormatWarning(null);
      return;
    }

    const provider = settings.aiProvider;
    let warning: string | null = null;

    if (provider === "claude" && key.startsWith("AIza")) {
      warning = "This looks like a Gemini key. Select the Gemini provider.";
    } else if (provider === "claude" && key.startsWith("sk-proj-")) {
      warning = "This looks like an OpenAI key. Select the GPT provider.";
    } else if (provider === "openai" && key.startsWith("AIza")) {
      warning = "This looks like a Gemini key. Select the Gemini provider.";
    } else if (provider === "openai" && key.startsWith("sk-ant-")) {
      warning = "This looks like a Claude key. Select the Claude provider.";
    } else if (provider === "gemini" && key.startsWith("sk-ant-")) {
      warning = "This looks like a Claude key. Select the Claude provider.";
    } else if (provider === "gemini" && key.startsWith("sk-")) {
      warning = "This looks like an OpenAI key. Select the GPT provider.";
    }

    setKeyFormatWarning(warning);
  }, [settings.apiKey, settings.aiProvider]);

  // Load settings on mount
  useEffect(() => {
    const loaded = getSettings();
    setSettings(loaded);
    setSavedSnapshot(loaded);
    // Restore previously verified model if available
    if (loaded.verifiedModel) {
      setVerifiedModel(loaded.verifiedModel);
      setVerifiedTier(loaded.verifiedTier ?? null);
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!settings.apiKey.trim()) return;

    setVerifying(true);
    setVerifyError(null);
    setVerifiedModel(null);
    setVerifiedTier(null);

    // Save name + provider immediately
    saveSettings(settings);
    setSavedSnapshot({ ...settings });

    try {
      const res = await fetch("/api/verify-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aiProvider: settings.aiProvider,
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
        setVerifiedModel(data.model);
        setVerifiedTier(data.tier ?? null);
        // Persist verified model info
        const updated: AppSettings = {
          ...settings,
          verifiedModel: data.model,
          verifiedTier: data.tier ?? null,
        };
        saveSettings(updated);
        setSavedSnapshot(updated);
        setSettings(updated);
      } else {
        setVerifyError(data.error || "Invalid API key");
        // Clear persisted verification on failure
        const cleared: AppSettings = {
          ...settings,
          verifiedModel: undefined,
          verifiedTier: undefined,
        };
        saveSettings(cleared);
        setSavedSnapshot(cleared);
        setSettings(cleared);
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

  const currentProvider = AI_PROVIDERS.find((p) => p.id === settings.aiProvider);

  return (
    <PageContainer size="md">
      <PageHeader title={t("title")} />

      <Card>
        <CardContent className="space-y-6">
          {/* Name */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              {t("name")}
            </label>
            <Input
              type="text"
              value={settings.name}
              onChange={(e) =>
                setSettings({ ...settings, name: e.target.value })
              }
              placeholder={t("name_placeholder")}
            />
          </div>

          {/* AI Provider */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              {t("ai_provider")}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {AI_PROVIDERS.map((prov) => (
                <button
                  key={prov.id}
                  onClick={() =>
                    setSettings({
                      ...settings,
                      aiProvider: prov.id as AppSettings["aiProvider"],
                    })
                  }
                  className={cn(
                    "rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
                    settings.aiProvider === prov.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:bg-muted"
                  )}
                >
                  {prov.label}
                </button>
              ))}
            </div>
          </div>

          {/* API Key */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              {t("api_key")}
            </label>
            <div className="relative">
              <Input
                type={showApiKey ? "text" : "password"}
                value={settings.apiKey}
                onChange={(e) =>
                  setSettings({ ...settings, apiKey: e.target.value })
                }
                placeholder={currentProvider?.keyHint || "Enter API key..."}
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
            <p className="mt-1 text-xs text-muted-foreground">
              {t("api_key_hint")}
            </p>
          </div>

          {/* Key Format Warning (client-side instant feedback) */}
          {keyFormatWarning && (
            <div className="flex items-start gap-2 rounded-lg bg-accent/10 px-4 py-3 text-sm text-accent">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{keyFormatWarning}</span>
            </div>
          )}

          {/* Verified Model — Success */}
          {verifiedModel && !isDirty && (
            <div className="rounded-lg border border-success/30 bg-success/5 px-4 py-3">
              <div className="flex items-center gap-2 text-sm">
                <ShieldCheck className="h-4 w-4 text-success" />
                <span className="font-medium text-success">
                  {t("active_model")}:
                </span>
                <code className="rounded bg-success/10 px-1.5 py-0.5 font-mono text-xs font-bold text-success">
                  {verifiedModel}
                </code>
                {verifiedTier && (
                  <span
                    className={cn(
                      "rounded-md px-2 py-0.5 text-xs font-medium",
                      verifiedTier === "paid"
                        ? "bg-success/20 text-success"
                        : "bg-accent/10 text-accent"
                    )}
                  >
                    {t(`tier_${verifiedTier}`)}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Key validated and generation test passed.
              </p>
            </div>
          )}

          {/* Verify Error */}
          {verifyError && !isDirty && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
              <div className="flex items-start gap-2 text-sm text-destructive">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-medium">Verification Failed</p>
                  <p className="mt-0.5 text-xs opacity-80">{verifyError}</p>
                </div>
              </div>
            </div>
          )}

          {/* Save Button */}
          <Button
            onClick={handleSave}
            loading={verifying}
            disabled={!settings.apiKey.trim()}
            variant={!isDirty && verifiedModel ? "success" : "primary"}
            size="lg"
            className="w-full"
          >
            {verifying ? (
              t("verifying")
            ) : !isDirty && verifiedModel ? (
              <>
                <Check className="h-4 w-4" />
                {t("saved")}
              </>
            ) : (
              <>
                <Settings className="h-4 w-4" />
                {t("save")}
              </>
            )}
          </Button>

          {/* Done / Cancel */}
          <div className="flex gap-3">
            <Button
              variant="secondary"
              size="md"
              className="flex-1"
              onClick={() => {
                // Revert unsaved changes
                if (isDirty) {
                  setSettings(savedSnapshot);
                }
                router.back();
              }}
            >
              <ArrowLeft className="h-4 w-4" />
              {t("cancel")}
            </Button>
            <Button
              variant="primary"
              size="md"
              className="flex-1"
              disabled={isDirty || verifying}
              onClick={() => router.back()}
            >
              {t("done")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
