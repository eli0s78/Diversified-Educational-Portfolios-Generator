import Papa from "papaparse";
import type { TopicInfo, Paper } from "./portfolio-types";

function parseKeywordArray(raw: string): string[] {
  try {
    const cleaned = raw.replace(/'/g, '"');
    return JSON.parse(cleaned);
  } catch {
    return raw.split(",").map((s) => s.trim().replace(/[[\]']/g, ""));
  }
}

function parseDocArray(raw: string): string[] {
  try {
    const cleaned = raw.replace(/'/g, '"');
    return JSON.parse(cleaned);
  } catch {
    return [raw.trim()];
  }
}

/**
 * Parse topics from CSV string content (browser-safe, no fs dependency).
 */
export function parseTopicsCSV(csvContent: string): TopicInfo[] {
  const parsed = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true,
  });

  return (parsed.data as Record<string, string>[]).map((row) => {
    const topicNum = parseInt(row.Topic, 10);
    const count = parseInt(row.Count, 10);

    let rarityLabel: "COMMON" | "RARE" | "NO_TOPIC";
    if (topicNum === -1) {
      rarityLabel = "NO_TOPIC";
    } else if (count >= 8) {
      rarityLabel = "COMMON";
    } else {
      rarityLabel = "RARE";
    }

    return {
      topicNumber: topicNum,
      count,
      name: row.Name || "",
      keywords: parseKeywordArray(row.Representation || "[]"),
      representativeDocs: parseDocArray(row.Representative_Docs || "[]"),
      rarityLabel,
    };
  });
}

/**
 * Parse papers from CSV string content (browser-safe, no fs dependency).
 */
export function parsePapersCSV(csvContent: string): Paper[] {
  const parsed = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true,
  });

  return (parsed.data as Record<string, string>[]).map((row) => ({
    id: row.id || "",
    doi: row.doi || "",
    title: row.title || "",
    abstract: row.abstract || undefined,
    year: parseInt(row.year, 10) || 2026,
    venue: row.venue || "",
    authors: row.authors || "",
    url: row.url || "",
    source: row.source || "Scopus",
    fields: row.fields || undefined,
    topicNumber: parseInt(row.Topic, 10) || -1,
    rarityLabel: (row.RarityLabel as "COMMON" | "RARE" | "NO_TOPIC") || "NO_TOPIC",
  }));
}

export function getTopicStats(topics: TopicInfo[]) {
  const activeTopics = topics.filter((t) => t.topicNumber !== -1);
  const totalPapers = topics.reduce((sum, t) => sum + t.count, 0);
  const commonTopics = activeTopics.filter((t) => t.rarityLabel === "COMMON");
  const rareTopics = activeTopics.filter((t) => t.rarityLabel === "RARE");

  return {
    totalTopics: activeTopics.length,
    totalPapers,
    commonCount: commonTopics.length,
    rareCount: rareTopics.length,
    noTopicCount: topics.find((t) => t.topicNumber === -1)?.count || 0,
    averageTopicSize: totalPapers / Math.max(activeTopics.length, 1),
  };
}

export function getPapersForTopic(papers: Paper[], topicNumber: number): Paper[] {
  return papers.filter((p) => p.topicNumber === topicNumber);
}
