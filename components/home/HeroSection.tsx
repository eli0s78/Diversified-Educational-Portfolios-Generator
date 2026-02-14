"use client";

import { useTranslations } from "next-intl";
import { PieChart } from "lucide-react";

interface HeroSectionProps {
  compact?: boolean;
}

export default function HeroSection({ compact = false }: HeroSectionProps) {
  const t = useTranslations("home");

  if (compact) {
    return (
      <section className="mb-8 text-center">
        <div className="mb-3 inline-flex items-center justify-center rounded-lg bg-primary/10 p-2">
          <PieChart className="h-5 w-5 text-primary" />
        </div>
        <h1 className="text-xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </section>
    );
  }

  return (
    <section className="mb-12 text-center">
      <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary">
        <PieChart className="h-4 w-4" />
        Modern Portfolio Theory + Education
      </div>
      <h1 className="mb-4 text-2xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
        {t("title")}
      </h1>
      <p className="mx-auto mb-3 max-w-2xl text-base text-secondary sm:text-lg">
        {t("subtitle")}
      </p>
      <p className="mx-auto max-w-3xl text-sm text-muted-foreground sm:text-base">
        {t("description")}
      </p>
    </section>
  );
}
