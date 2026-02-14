"use client";

import { useTranslations } from "next-intl";
import { Upload, Sparkles, BarChart3, GraduationCap } from "lucide-react";

const STEPS = [
  { key: "step1", descKey: "step1_desc", icon: Upload },
  { key: "step2", descKey: "step2_desc", icon: Sparkles },
  { key: "step3", descKey: "step3_desc", icon: BarChart3 },
  { key: "step4", descKey: "step4_desc", icon: GraduationCap },
];

export default function HowItWorks() {
  const t = useTranslations("home");

  return (
    <section className="mb-12">
      <h2 className="mb-6 text-center text-xl font-bold sm:text-2xl">
        {t("how_it_works")}
      </h2>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          return (
            <div key={step.key} className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div className="mb-1.5 text-xs font-bold uppercase tracking-wider text-primary">
                Step {i + 1}
              </div>
              <h3 className="mb-1 text-sm font-semibold">{t(step.key)}</h3>
              <p className="text-xs text-muted-foreground">{t(step.descKey)}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
