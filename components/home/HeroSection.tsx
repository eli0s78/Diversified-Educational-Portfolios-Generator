"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { getSettings } from "@/lib/project-manager";

export default function HeroSection() {
  const t = useTranslations("home");
  const [userName, setUserName] = useState("");

  useEffect(() => {
    setUserName(getSettings().name);
  }, []);

  return (
    <section className="mb-12 text-center">
      {userName ? (
        <p className="mb-2 text-sm text-muted-foreground">
          {t("welcome_back", { name: userName })}
        </p>
      ) : null}
      <h1 className="text-2xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
        {t("title")}
      </h1>
    </section>
  );
}
