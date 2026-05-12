import { NextRequest, NextResponse } from "next/server";
import {
  searchONETOccupations,
  getONETSkills,
  getONETTechnology,
  getONETWorkActivities,
  getONETKnowledge,
  getONETOccupationDetails,
} from "@/lib/apis/onet";
import {
  getBLSData,
  getWageSeriesId,
  getEmploymentSeriesId,
  getLatestValue,
  getTrend,
} from "@/lib/apis/bls";
import {
  searchESCOOccupations,
  getESCOEssentialSkills,
  getESCOOptionalSkills,
  categorizeSkills,
} from "@/lib/apis/esco";
import {
  getEurostatEmploymentByOccupation,
  getLatestEmploymentValue,
  getISCOMajorGroup,
} from "@/lib/apis/eurostat";
import { getOECDEducationData } from "@/lib/apis/oecd";
import type {
  LaborMarketData,
  OccupationTaxonomy,
  SkillsData,
  EmploymentData,
  WageData,
  AutomationRisk,
} from "@/lib/types/research";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes

interface LaborMarketRequest {
  occupation: string;
  region: "US" | "EU" | "Global";
  onet_api_key?: string;
  bls_api_key?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: LaborMarketRequest = await request.json();
    const { occupation, region = "Global", onet_api_key, bls_api_key } = body;

    if (!occupation) {
      return NextResponse.json(
        { error: "Missing required field: occupation" },
        { status: 400 }
      );
    }

    // Use API keys from request body (passed from client-side localStorage)
    const onetApiKey = onet_api_key;
    const blsApiKey = bls_api_key;

    // Initialize result structure
    let laborMarketData: Partial<LaborMarketData> = {
      metadata: {
        region,
        data_sources: [],
        last_updated: new Date().toISOString(),
      },
    };

    // Collect occupation taxonomy data
    const taxonomy: Partial<OccupationTaxonomy> = {
      input: occupation,
      region,
      keywords: [],
      synonyms: [],
    };

    // ============================================================
    // US-specific data (O*NET + BLS)
    // ============================================================
    if (region === "US" || region === "Global") {
      if (!onetApiKey) {
        console.warn("[labor-market-data] O*NET API key not configured, skipping US data");
        // Continue to EU data if applicable, don't fail
      } else {
        try {
          // Search for occupation in O*NET
          const onetResults = await searchONETOccupations(occupation, onetApiKey);

          if (onetResults.length > 0) {
            const bestMatch = onetResults[0];
            const onetCode = bestMatch.code;

            // Store O*NET data in taxonomy
            taxonomy.onet = {
              code: onetCode,
              title: bestMatch.title,
              description: bestMatch.description,
            };

            // Fetch O*NET skills, technology, activities, knowledge in parallel
            const [skills, technology, workActivities, knowledge] = await Promise.all([
              getONETSkills(onetCode, onetApiKey),
              getONETTechnology(onetCode, onetApiKey),
              getONETWorkActivities(onetCode, onetApiKey),
              getONETKnowledge(onetCode, onetApiKey),
            ]);

            // Build SkillsData
            const skillsData: SkillsData = {
              core_skills: skills
                .map((s) => ({
                  name: s.name,
                  importance: s.importance,
                  level: 0,
                  category: "technical", // Simplified categorization
                })),
              technology_skills: technology.map((t) => ({
                name: t.title,
                category: "Software", // Simplified
                examples: [t.title],
              })),
              work_activities: workActivities
                .map((a) => ({
                  name: a.name,
                  importance: a.importance,
                  level: 0,
                })),
              knowledge_requirements: knowledge
                .map((k) => ({
                  name: k.name,
                  importance: k.importance,
                  level: 0,
                })),
            };

            laborMarketData.skills = skillsData;
            laborMarketData.metadata!.data_sources.push("O*NET");

            // Fetch BLS employment and wage data
            if (blsApiKey) {
              try {
                const currentYear = new Date().getFullYear();
                const startYear = currentYear - 5;

                const wageSeriesId = getWageSeriesId(onetCode);
                const employmentSeriesId = getEmploymentSeriesId(onetCode);

                const blsData = await getBLSData(
                  [wageSeriesId, employmentSeriesId],
                  startYear,
                  currentYear,
                  blsApiKey
                );

                const wageSeries = blsData.find((s) => s.seriesID === wageSeriesId);
                const employmentSeries = blsData.find((s) => s.seriesID === employmentSeriesId);

                if (wageSeries) {
                  const medianWage = getLatestValue(wageSeries);
                  if (medianWage !== null) {
                    laborMarketData.wages = {
                      median_wage: medianWage,
                      currency: "USD",
                    };
                  }
                }

                if (employmentSeries) {
                  const totalEmployment = getLatestValue(employmentSeries);
                  const employmentTrend = getTrend(employmentSeries);

                  if (totalEmployment !== null) {
                    laborMarketData.employment = {
                      total_employment: totalEmployment,
                      employment_trends: employmentTrend.map((t) => ({
                        year: t.year,
                        employment: t.value,
                      })),
                    };
                  }
                }

                laborMarketData.metadata!.data_sources.push("BLS");
              } catch (blsError) {
                console.error("BLS API error:", blsError);
                // Continue without BLS data
              }
            }
          }
        } catch (onetError) {
          console.error("O*NET API error:", onetError);
          // Continue to EU data if applicable
        }
      }
    }

    // ============================================================
    // EU-specific data (ESCO + Eurostat)
    // ============================================================
    if (region === "EU" || region === "Global") {
      try {
        // Search for occupation in ESCO
        const escoResults = await searchESCOOccupations(occupation, "en", 5);

        if (escoResults.length > 0) {
          const bestMatch = escoResults[0];

          // Store ESCO data in taxonomy
          taxonomy.esco = bestMatch;

          // Fetch essential and optional skills
          const [essentialSkills, optionalSkills] = await Promise.all([
            getESCOEssentialSkills(bestMatch.uri, "en"),
            getESCOOptionalSkills(bestMatch.uri, "en"),
          ]);

          const allSkills = [...essentialSkills, ...optionalSkills];
          const categorized = categorizeSkills(allSkills);

          // Build SkillsData (merge with O*NET if available)
          if (!laborMarketData.skills) {
            laborMarketData.skills = {
              core_skills: [],
              technology_skills: [],
              work_activities: [],
              knowledge_requirements: [],
            };
          }

          // Add ESCO skills
          laborMarketData.skills.core_skills.push(
            ...categorized.technical.map((s) => ({
              name: s.preferredLabel.en,
              importance: 80, // Default importance
              level: 70,
              category: "technical" as const,
            }))
          );

          laborMarketData.skills.core_skills.push(
            ...categorized.soft.map((s) => ({
              name: s.preferredLabel.en,
              importance: 75,
              level: 65,
              category: "soft" as const,
            }))
          );

          laborMarketData.skills.core_skills.push(
            ...categorized.digital.map((s) => ({
              name: s.preferredLabel.en,
              importance: 85,
              level: 75,
              category: "digital" as const,
            }))
          );

          laborMarketData.metadata!.data_sources.push("ESCO");

          // Fetch Eurostat employment data
          if (bestMatch.iscoGroup) {
            const iscoMajorGroup = getISCOMajorGroup(bestMatch.iscoGroup);

            try {
              const eurostatData = await getEurostatEmploymentByOccupation(iscoMajorGroup);
              const employment = getLatestEmploymentValue(eurostatData);

              if (employment !== null) {
                if (!laborMarketData.employment) {
                  laborMarketData.employment = {
                    total_employment: employment,
                  };
                }
                laborMarketData.metadata!.data_sources.push("Eurostat");
              }
            } catch (eurostatError) {
              console.error("Eurostat API error:", eurostatError);
              // Continue without Eurostat data
            }
          }

          // Fetch OECD Data (Adult Education / Tertiary Attainment)
          try {
            const oecdData = await getOECDEducationData("OAVG"); // OECD Average
            if (oecdData && oecdData.length > 0) {
              const latestOECD = oecdData[0]; // Assuming highest year is first or only one
              laborMarketData.metadata!.data_sources.push("OECD.Stat");

              // We'll insert it into skills metadata or education metadata in taxonomy
              taxonomy.education_attainment_oecd_average = {
                year: latestOECD.year,
                tertiary_percentage: latestOECD.value
              };
            }
          } catch (oecdError) {
            console.error("OECD API error:", oecdError);
          }

        }
      } catch (escoError) {
        console.error("ESCO API error:", escoError);
        // Continue without ESCO data
      }
    }

    // ============================================================
    // Automation risk (placeholder - would use AI analysis)
    // ============================================================
    const automationRisk: AutomationRisk = {
      automation_probability: 0.5, // Placeholder
      routine_task_intensity: 0.5,
      technology_adoption_trend: "medium",
      time_horizon: "5-10 years",
      vulnerable_tasks: [],
      resilient_tasks: [],
    };

    laborMarketData.automation_risk = automationRisk;

    // ============================================================
    // Assemble final response
    // ============================================================
    laborMarketData.occupation = taxonomy as OccupationTaxonomy;

    return NextResponse.json(laborMarketData);
  } catch (error) {
    console.error("Labor market data collection error:", error);
    return NextResponse.json(
      {
        error: "Failed to collect labor market data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
