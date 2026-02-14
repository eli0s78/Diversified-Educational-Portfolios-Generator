/**
 * Seed script: parses academics_specialties.txt and populates the supervisors DB.
 *
 * Usage:  npx tsx scripts/seed-supervisors.ts
 */

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { sql } from "drizzle-orm";
import fs from "fs";
import path from "path";
import * as schema from "../lib/db/schema";

// ── paths ──────────────────────────────────────────────────
const DB_PATH = path.join(process.cwd(), "data", "supervisors.db");
const DATA_PATH = path.join(process.cwd(), "academics_specialties.txt");

// ── keyword → direction affinity rules ─────────────────────
// Each training direction has keywords that boost affinity when
// matched against a supervisor's domain/field/specialty/topic.

const DIRECTION_KEYWORDS: Record<number, string[]> = {
  // 1: New Technologies & Communication Media
  1: [
    "computer science", "informatics", "information systems",
    "telecommunications", "digital", "electronics", "automation",
    "robotics", "ai", "artificial intelligence", "machine learning",
    "software", "iot", "bim", "multimedia", "information security",
    "cryptography", "computer technology", "digital systems",
    "computer aided design", "health informatics", "telematics",
    "logistics", "intelligent information systems", "3d animation",
    "audiovisual translation", "engineering", "electrical engineering",
    "aerospace engineering", "naval architecture", "materials science",
  ],
  // 2: Trend Analysis & Strategic Planning
  2: [
    "economics", "finance", "strategic", "planning", "foresight",
    "statistics", "mathematics", "data", "analysis", "market",
    "innovation management", "applied economics", "tourism economics",
    "real estate economics", "financial accounting", "auditing",
    "banking management", "economic development", "control theory",
    "business administration", "management", "commercial management",
  ],
  // 3: Contemporary Sales Techniques
  3: [
    "marketing", "sales", "business development", "customer",
    "tourism management", "tourism marketing", "commercial",
    "advertising", "media studies", "journalism", "communication",
    "public relations",
  ],
  // 4: Negotiation & HR Management
  4: [
    "human resource", "hr management", "negotiation", "leadership",
    "organizational", "law", "public law", "civil law", "private law",
    "sports law", "maritime law", "military law", "sports management",
    "criminology", "sociology", "social anthropology", "social exclusion",
    "political science", "international politics", "international studies",
    "political communication", "migration policy", "european studies",
    "conflict resolution",
  ],
  // 5: Personal Growth & Entrepreneurship (Theoretical)
  5: [
    "psychology", "education", "pedagogy", "philosophy", "ethics",
    "applied ethics", "counseling", "developmental psychology",
    "educational psychology", "school psychology", "health psychology",
    "adult education", "comparative education", "history of education",
    "educational administration", "epistemology", "science education",
    "gender studies", "theology", "religious studies", "social theology",
    "philosophy of religion", "philosophy of science", "aesthetics",
    "history", "historiography", "modern greek history",
    "history of technology", "early childhood education",
    "comparative literature", "literary theory",
  ],
  // 6: Personal Growth & Entrepreneurship (Practical)
  6: [
    "sports science", "sports research methodology", "physiotherapy",
    "musculoskeletal", "occupational therapy", "nursing",
    "intensive care", "surgery", "general surgery", "nutrition",
    "food science", "food technology", "dairy science", "enology",
    "cosmetology", "dietetics", "agriculture", "precision agriculture",
    "landscape architecture", "architecture", "built environment",
    "conservation", "art conservation", "performing arts",
    "theatre studies", "film studies", "directing", "visual arts",
    "music studies", "musicology", "ethnomusicology",
  ],
};

interface AcademicEntry {
  id: number;
  "Ονοματεπώνυμο": string;
  Metadata: string[];
}

function parseMetadata(meta: string[]) {
  const result = {
    domain: "",
    field: "",
    specialties: [] as string[],
    topics: [] as string[],
    role: "",
  };

  for (const tag of meta) {
    const colonIdx = tag.indexOf(":");
    if (colonIdx === -1) continue;
    const key = tag.slice(0, colonIdx).trim();
    const val = tag.slice(colonIdx + 1).trim();
    switch (key) {
      case "domain":
        result.domain = val;
        break;
      case "field":
        result.field = val;
        break;
      case "specialty":
        result.specialties.push(val);
        break;
      case "topic":
        result.topics.push(val);
        break;
      case "role":
        result.role = val;
        break;
    }
  }
  return result;
}

function computeAffinity(
  domain: string,
  field: string,
  specialties: string[],
  topics: string[],
  directionId: number
): number {
  const keywords = DIRECTION_KEYWORDS[directionId] ?? [];
  if (keywords.length === 0) return 0;

  // Combine all supervisor text into searchable tokens
  const tokens = [domain, field, ...specialties, ...topics]
    .map((s) => s.toLowerCase())
    .join(" | ");

  let hits = 0;
  for (const kw of keywords) {
    if (tokens.includes(kw.toLowerCase())) {
      hits++;
    }
  }

  // Normalize: cap at 1.0, scale so 1 hit = 0.3, 2 = 0.5, 3+ = 0.7+
  if (hits === 0) return 0;
  if (hits === 1) return 0.3;
  if (hits === 2) return 0.5;
  if (hits === 3) return 0.7;
  return Math.min(1.0, 0.7 + hits * 0.05);
}

// ── main ───────────────────────────────────────────────────
function main() {
  // Ensure data/ directory exists
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Read and parse academics file
  if (!fs.existsSync(DATA_PATH)) {
    console.error(`File not found: ${DATA_PATH}`);
    process.exit(1);
  }

  const lines = fs
    .readFileSync(DATA_PATH, "utf-8")
    .split("\n")
    .filter((l) => l.trim());

  const entries: AcademicEntry[] = lines.map((line) => JSON.parse(line));
  console.log(`Parsed ${entries.length} academics`);

  // Open DB and create tables
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });

  // Drop existing tables (idempotent re-seed)
  sqlite.exec(`DROP TABLE IF EXISTS course_supervisors`);
  sqlite.exec(`DROP TABLE IF EXISTS supervisor_direction_affinity`);
  sqlite.exec(`DROP TABLE IF EXISTS supervisor_topics`);
  sqlite.exec(`DROP TABLE IF EXISTS supervisor_specialties`);
  sqlite.exec(`DROP TABLE IF EXISTS supervisors`);

  // Create tables via raw SQL (matching schema.ts)
  sqlite.exec(`
    CREATE TABLE supervisors (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      name_en TEXT,
      domain TEXT NOT NULL,
      field TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE supervisor_specialties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supervisor_id INTEGER NOT NULL REFERENCES supervisors(id) ON DELETE CASCADE,
      specialty TEXT NOT NULL
    );

    CREATE TABLE supervisor_topics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supervisor_id INTEGER NOT NULL REFERENCES supervisors(id) ON DELETE CASCADE,
      topic TEXT NOT NULL
    );

    CREATE TABLE supervisor_direction_affinity (
      supervisor_id INTEGER NOT NULL REFERENCES supervisors(id) ON DELETE CASCADE,
      direction_id INTEGER NOT NULL,
      affinity_score REAL NOT NULL DEFAULT 0,
      PRIMARY KEY (supervisor_id, direction_id)
    );

    CREATE TABLE course_supervisors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL,
      course_title TEXT NOT NULL,
      training_direction_key TEXT NOT NULL,
      supervisor_id INTEGER NOT NULL REFERENCES supervisors(id),
      assigned_at TEXT NOT NULL
    );
  `);

  // Insert data
  const now = new Date().toISOString();
  let specialtyCount = 0;
  let topicCount = 0;
  let affinityCount = 0;

  const insertSupervisor = sqlite.prepare(
    `INSERT INTO supervisors (id, name, domain, field, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const insertSpecialty = sqlite.prepare(
    `INSERT INTO supervisor_specialties (supervisor_id, specialty) VALUES (?, ?)`
  );
  const insertTopic = sqlite.prepare(
    `INSERT INTO supervisor_topics (supervisor_id, topic) VALUES (?, ?)`
  );
  const insertAffinity = sqlite.prepare(
    `INSERT INTO supervisor_direction_affinity (supervisor_id, direction_id, affinity_score) VALUES (?, ?, ?)`
  );

  const insertAll = sqlite.transaction(() => {
    for (const entry of entries) {
      const meta = parseMetadata(entry.Metadata);

      insertSupervisor.run(
        entry.id,
        entry["Ονοματεπώνυμο"],
        meta.domain,
        meta.field,
        meta.role,
        now,
        now
      );

      for (const spec of meta.specialties) {
        insertSpecialty.run(entry.id, spec);
        specialtyCount++;
      }

      for (const topic of meta.topics) {
        insertTopic.run(entry.id, topic);
        topicCount++;
      }

      // Compute affinity for all 6 directions
      for (let d = 1; d <= 6; d++) {
        const score = computeAffinity(
          meta.domain,
          meta.field,
          meta.specialties,
          meta.topics,
          d
        );
        if (score > 0) {
          insertAffinity.run(entry.id, d, score);
          affinityCount++;
        }
      }
    }
  });

  insertAll();

  console.log(`Inserted ${entries.length} supervisors`);
  console.log(`Inserted ${specialtyCount} specialties`);
  console.log(`Inserted ${topicCount} topics`);
  console.log(`Inserted ${affinityCount} direction affinity scores`);

  // Quick stats
  const dirStats = sqlite
    .prepare(
      `SELECT direction_id, COUNT(*) as cnt, ROUND(AVG(affinity_score), 2) as avg_score
       FROM supervisor_direction_affinity
       GROUP BY direction_id
       ORDER BY direction_id`
    )
    .all() as { direction_id: number; cnt: number; avg_score: number }[];

  const dirNames = [
    "",
    "New Technologies & Communication Media",
    "Trend Analysis & Strategic Planning",
    "Contemporary Sales Techniques",
    "Negotiation & HR Management",
    "Personal Growth & Entrepreneurship (Theory)",
    "Personal Growth & Entrepreneurship (Practical)",
  ];

  console.log("\nDirection affinity summary:");
  for (const row of dirStats) {
    console.log(
      `  ${row.direction_id}. ${dirNames[row.direction_id]}: ${row.cnt} supervisors (avg score ${row.avg_score})`
    );
  }

  sqlite.close();
  console.log(`\nDatabase saved to ${DB_PATH}`);
}

main();
