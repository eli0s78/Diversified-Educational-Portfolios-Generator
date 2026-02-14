"use client";

import { useState, useEffect } from "react";
import { getSettings } from "@/lib/project-manager";
import { PageContainer } from "@/components/ui/PageContainer";
import HeroSection from "@/components/home/HeroSection";
import ProjectsDashboard from "@/components/home/ProjectsDashboard";
import ApiKeyWarning from "@/components/home/ApiKeyWarning";
import ConceptSection from "@/components/home/ConceptSection";
import HowItWorks from "@/components/home/HowItWorks";
import DirectionsGrid from "@/components/home/DirectionsGrid";

export default function HomePage() {
  const [hasAI, setHasAI] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const settings = getSettings();
    setHasAI(!!settings.apiKey);
    setReady(true);
  }, []);

  if (!ready) return null;

  return (
    <PageContainer size="xl">
      <HeroSection />
      <ProjectsDashboard />
      <ApiKeyWarning show={!hasAI} />
      <ConceptSection />
      <HowItWorks />
      <DirectionsGrid />
    </PageContainer>
  );
}
