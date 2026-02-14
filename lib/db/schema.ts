import {
  sqliteTable,
  text,
  integer,
  real,
  primaryKey,
} from "drizzle-orm/sqlite-core";

// ============================================================
// Academic Supervisors
// ============================================================

export const supervisors = sqliteTable("supervisors", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  nameEn: text("name_en"),
  domain: text("domain").notNull(), // STEM, Health Sciences, Social Sciences, Humanities, Arts
  field: text("field").notNull(), // Computer Science, Medicine, Economics, etc.
  role: text("role").notNull(), // Professor, Associate Professor, etc.
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// A supervisor can have 0-N specialties (e.g. Pathology + Immunology)
export const supervisorSpecialties = sqliteTable("supervisor_specialties", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  supervisorId: integer("supervisor_id")
    .notNull()
    .references(() => supervisors.id, { onDelete: "cascade" }),
  specialty: text("specialty").notNull(),
});

// A supervisor can have 0-N specific research topics
export const supervisorTopics = sqliteTable("supervisor_topics", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  supervisorId: integer("supervisor_id")
    .notNull()
    .references(() => supervisors.id, { onDelete: "cascade" }),
  topic: text("topic").notNull(),
});

// Affinity score (0.0–1.0) linking each supervisor to each of the 6 training directions.
// Computed by keyword matching during seed, can be refined by AI later.
export const supervisorDirectionAffinity = sqliteTable(
  "supervisor_direction_affinity",
  {
    supervisorId: integer("supervisor_id")
      .notNull()
      .references(() => supervisors.id, { onDelete: "cascade" }),
    directionId: integer("direction_id").notNull(), // 1-6
    affinityScore: real("affinity_score").notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.supervisorId, table.directionId] }),
  ]
);

// ============================================================
// Course–Supervisor Assignments
// ============================================================

// Links supervisors to generated courses within a project
export const courseSupervisors = sqliteTable("course_supervisors", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: text("project_id").notNull(),
  courseTitle: text("course_title").notNull(),
  trainingDirectionKey: text("training_direction_key").notNull(),
  supervisorId: integer("supervisor_id")
    .notNull()
    .references(() => supervisors.id),
  assignedAt: text("assigned_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});
