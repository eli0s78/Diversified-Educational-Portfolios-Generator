"use client";

import { useTranslations } from "next-intl";

export default function ConceptSection() {
  const t = useTranslations("home");

  return (
    <section className="mb-12">
      <div className="rounded-2xl border border-border bg-card p-8 sm:p-10">
        <h2 className="mb-2 text-xl font-bold">{t("subtitle")}</h2>
        <p className="mb-6 text-sm text-muted-foreground leading-relaxed sm:text-base">
          {t("description")}
        </p>
        <div className="border-t border-border pt-6">
          <h3 className="mb-2 text-base font-semibold">{t("concept_title")}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed sm:text-base">
            {t("concept_text")}
          </p>
        </div>
      </div>
    </section>
  );
}
