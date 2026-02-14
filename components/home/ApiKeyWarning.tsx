"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { AlertCircle, Settings } from "lucide-react";

interface ApiKeyWarningProps {
  show: boolean;
}

export default function ApiKeyWarning({ show }: ApiKeyWarningProps) {
  const t = useTranslations("home");

  if (!show) return null;

  return (
    <section className="mb-12">
      <Link
        href="/settings"
        className="flex items-center justify-between rounded-xl border border-accent/30 bg-accent/5 px-6 py-4 transition-all duration-200 hover:bg-accent/10 hover:shadow-md"
      >
        <div className="flex items-center gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 text-accent" />
          <div>
            <p className="text-sm font-semibold text-foreground">
              {t("api_key_warning")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("api_key_warning_action")}
            </p>
          </div>
        </div>
        <Settings className="h-5 w-5 shrink-0 text-muted-foreground" />
      </Link>
    </section>
  );
}
