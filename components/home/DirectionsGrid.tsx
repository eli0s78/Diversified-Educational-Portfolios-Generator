"use client";

import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { TRAINING_DIRECTIONS } from "@/lib/engine/portfolio-types";
import { Cpu, TrendingUp, ShoppingCart, Users, BookOpen, Wrench } from "lucide-react";

const DIRECTION_ICONS = [Cpu, TrendingUp, ShoppingCart, Users, BookOpen, Wrench];

const DIRECTION_COLOR_CLASSES = [
  "bg-direction-1/10 text-direction-1",
  "bg-direction-2/10 text-direction-2",
  "bg-direction-3/10 text-direction-3",
  "bg-direction-4/10 text-direction-4",
  "bg-direction-5/10 text-direction-5",
  "bg-direction-6/10 text-direction-6",
];

export default function DirectionsGrid() {
  const t = useTranslations("home");
  const locale = useLocale();

  return (
    <section className="mb-12">
      <h2 className="mb-6 text-center text-xl font-bold sm:text-2xl">
        {t("directions_title")}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TRAINING_DIRECTIONS.map((dir, i) => {
          const Icon = DIRECTION_ICONS[i];
          return (
            <div
              key={dir.key}
              className="rounded-xl border border-border bg-card p-5 transition-all duration-200 hover:shadow-md"
            >
              <div className="mb-3 flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-lg ${DIRECTION_COLOR_CLASSES[i]}`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-sm font-medium text-muted-foreground">
                  #{dir.id}
                </span>
              </div>
              <h3 className="mb-1.5 font-semibold text-sm">
                {locale === "el" ? dir.name_el : dir.name}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {dir.description}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
