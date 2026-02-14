"use client";

import { useTranslations } from "next-intl";

export default function ConceptSection() {
  const t = useTranslations("home");

  return (
    <section className="mb-12">
      <div className="rounded-2xl border border-border bg-card p-8 sm:p-10">
        <h2 className="mb-3 text-xl font-bold">{t("concept_title")}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed sm:text-base">
          {t("concept_text")}
        </p>
      </div>
    </section>
  );
}
