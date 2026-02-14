"use client";

import { useTranslations } from "next-intl";

export default function HeroSection() {
  const t = useTranslations("home");

  return (
    <section className="mb-12 text-center">
      <h1 className="text-2xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
        {t("title")}
      </h1>
    </section>
  );
}
