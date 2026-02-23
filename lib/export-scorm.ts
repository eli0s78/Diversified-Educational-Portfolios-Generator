import JSZip from "jszip";
import type { CourseOutline, SupervisorMatch } from "@/lib/engine/portfolio-types";
import { TRAINING_DIRECTIONS } from "@/lib/engine/portfolio-types";
import { parseRichContent } from "@/lib/rich-text";
import { nativeSaveFile } from "@/lib/native-save";

// ─────────────────────────────────────────────────
// SCORM 1.2 Package Export
// ─────────────────────────────────────────────────

function getDirectionName(key: string, locale: string): string {
  const dir = TRAINING_DIRECTIONS.find((d) => d.key === key);
  if (!dir) return key;
  return locale === "el" ? dir.name_el : dir.name;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Convert rich content to HTML paragraphs */
function richContentToHtml(content: string): string {
  const blocks = parseRichContent(content);
  const parts: string[] = [];
  let listOpen = false;

  for (const block of blocks) {
    if (block.type === "list-item") {
      if (!listOpen) {
        parts.push("<ol>");
        listOpen = true;
      }
      const segs = block.segments
        .map((s) => (s.bold ? `<strong>${escapeHtml(s.text)}</strong>` : escapeHtml(s.text)))
        .join("");
      parts.push(`<li>${segs}</li>`);
    } else {
      if (listOpen) {
        parts.push("</ol>");
        listOpen = false;
      }
      const segs = block.segments
        .map((s) => (s.bold ? `<strong>${escapeHtml(s.text)}</strong>` : escapeHtml(s.text)))
        .join("");
      parts.push(`<p>${segs}</p>`);
    }
  }
  if (listOpen) parts.push("</ol>");

  return parts.join("\n");
}

/** Generate an HTML page for a single course */
function generateCourseHtml(
  course: CourseOutline,
  supervisors: SupervisorMatch[],
  locale: string
): string {
  const dirName = getDirectionName(course.trainingDirection, locale);
  const l = {
    direction: locale === "el" ? "Κατεύθυνση" : "Direction",
    hours: locale === "el" ? "ώρες" : "hours",
    overview: locale === "el" ? "Επισκόπηση" : "Overview",
    supervisors: locale === "el" ? "Ακαδημαϊκοί Επόπτες" : "Academic Supervisors",
    module: locale === "el" ? "Ενότητα" : "Module",
    unit: locale === "el" ? "Μονάδα" : "Unit",
    minutes: locale === "el" ? "λεπτά" : "min",
    objectives: locale === "el" ? "Μαθησιακοί Στόχοι" : "Learning Objectives",
    skills: locale === "el" ? "Δεξιότητες" : "Skills",
    references: locale === "el" ? "Βιβλιογραφία" : "References",
  };

  const sections: string[] = [];

  // Header
  sections.push(`
    <div class="header">
      <span class="badge">${escapeHtml(dirName)}</span>
      <span class="meta">${course.totalHours} ${l.hours}</span>
    </div>
    <h1>${escapeHtml(course.title)}</h1>
    <h2>${l.overview}</h2>
    ${richContentToHtml(course.overview)}
  `);

  // Supervisors
  if (supervisors.length > 0) {
    sections.push(`<h2>${l.supervisors}</h2><ul>`);
    for (const sup of supervisors) {
      sections.push(`<li><strong>${escapeHtml(sup.name)}</strong> — ${escapeHtml(sup.role)} (${escapeHtml(sup.field)})</li>`);
    }
    sections.push("</ul>");
  }

  // Modules
  for (const mod of course.modules) {
    sections.push(`<h2>${l.module} ${mod.moduleNumber}: ${escapeHtml(mod.title)}</h2>`);
    sections.push(`<p class="description">${escapeHtml(mod.description)}</p>`);

    if (mod.learningObjectives.length > 0) {
      sections.push(`<h3>${l.objectives}</h3><ul>`);
      for (const obj of mod.learningObjectives) {
        sections.push(`<li>${escapeHtml(obj)}</li>`);
      }
      sections.push("</ul>");
    }

    for (const unit of mod.units) {
      sections.push(`
        <div class="unit">
          <h3>${l.unit} ${mod.moduleNumber}.${unit.unitNumber}: ${escapeHtml(unit.title)}
            <span class="meta">${unit.estimatedMinutes} ${l.minutes}</span>
          </h3>
          ${richContentToHtml(unit.content)}
      `);

      if (unit.learningObjectives.length > 0) {
        sections.push(`<h4>${l.objectives}</h4><ul>`);
        for (const obj of unit.learningObjectives) {
          sections.push(`<li>${escapeHtml(obj)}</li>`);
        }
        sections.push("</ul>");
      }

      if (unit.skillTags.length > 0) {
        sections.push(`<div class="tags"><strong>${l.skills}:</strong> `);
        sections.push(unit.skillTags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join(" "));
        sections.push("</div>");
      }

      if (unit.paperReferences.length > 0) {
        sections.push(`<h4>${l.references}</h4><ul class="refs">`);
        for (const ref of unit.paperReferences) {
          sections.push(`<li>${escapeHtml(ref)}</li>`);
        }
        sections.push("</ul>");
      }

      sections.push("</div>");
    }
  }

  return `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(course.title)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #1e293b; max-width: 900px; margin: 0 auto; padding: 2rem; }
    h1 { font-size: 1.75rem; color: #2563eb; margin: 0.5rem 0 1.5rem; }
    h2 { font-size: 1.25rem; color: #1e293b; margin: 1.5rem 0 0.75rem; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.25rem; }
    h3 { font-size: 1.1rem; color: #334155; margin: 1rem 0 0.5rem; }
    h4 { font-size: 0.95rem; color: #64748b; margin: 0.75rem 0 0.5rem; }
    p { margin: 0.5rem 0; }
    ul, ol { padding-left: 1.5rem; margin: 0.5rem 0; }
    li { margin: 0.25rem 0; }
    .header { display: flex; align-items: center; gap: 1rem; margin-bottom: 0.5rem; }
    .badge { background: #eff6ff; color: #2563eb; padding: 0.25rem 0.75rem; border-radius: 0.375rem; font-size: 0.85rem; font-weight: 600; }
    .meta { color: #64748b; font-size: 0.85rem; }
    .description { color: #64748b; font-style: italic; }
    .unit { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0.5rem; padding: 1rem; margin: 0.75rem 0; }
    .tags { margin: 0.5rem 0; font-size: 0.9rem; }
    .tag { background: #eff6ff; color: #2563eb; padding: 0.125rem 0.5rem; border-radius: 0.25rem; font-size: 0.8rem; display: inline-block; margin: 0.125rem; }
    .refs { font-size: 0.85rem; color: #64748b; }
  </style>
</head>
<body>
  ${sections.join("\n")}
  <script>
    // SCORM 1.2 API wrapper
    var API = null;
    function findAPI(win) {
      try {
        while (win && !win.API) { win = win.parent; if (win === win.parent) break; }
        return win ? win.API : null;
      } catch(e) { return null; }
    }
    API = findAPI(window);
    if (API) {
      API.LMSInitialize("");
      API.LMSSetValue("cmi.core.lesson_status", "completed");
      API.LMSCommit("");
    }
  </script>
</body>
</html>`;
}

/** Generate imsmanifest.xml for SCORM 1.2 */
function generateManifest(
  programTitle: string,
  courses: CourseOutline[],
  locale: string
): string {
  const orgId = "ORG-DEP-001";
  const items: string[] = [];
  const resources: string[] = [];

  for (let i = 0; i < courses.length; i++) {
    const itemId = `ITEM-${i + 1}`;
    const resId = `RES-${i + 1}`;
    const fileName = `course_${i + 1}.html`;
    const dirName = getDirectionName(courses[i].trainingDirection, locale);

    items.push(`
      <item identifier="${itemId}" identifierref="${resId}">
        <title>${escapeXml(courses[i].title)}</title>
        <metadata>
          <schema>ADL SCORM</schema>
          <schemaversion>1.2</schemaversion>
        </metadata>
      </item>`);

    resources.push(`
      <resource identifier="${resId}" type="webcontent" adlcp:scormtype="sco" href="${fileName}">
        <file href="${fileName}"/>
      </resource>`);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="DEP-MANIFEST-001"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd
    http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="${orgId}">
    <organization identifier="${orgId}">
      <title>${escapeXml(programTitle)}</title>
      ${items.join("\n")}
    </organization>
  </organizations>
  <resources>
    ${resources.join("\n")}
  </resources>
</manifest>`;
}

/**
 * Export courses as a SCORM 1.2 package (.zip).
 * Each course becomes a separate SCO (Shareable Content Object).
 */
export async function exportToScorm(
  courses: CourseOutline[],
  supervisors: Record<string, SupervisorMatch[]>,
  programTitle: string,
  locale: string
): Promise<void> {
  const zip = new JSZip();

  // Generate imsmanifest.xml
  zip.file("imsmanifest.xml", generateManifest(programTitle, courses, locale));

  // Generate HTML for each course
  for (let i = 0; i < courses.length; i++) {
    const course = courses[i];
    const sups = supervisors[course.trainingDirection] || [];
    const html = generateCourseHtml(course, sups, locale);
    zip.file(`course_${i + 1}.html`, html);
  }

  // Generate the ZIP blob
  const blob = await zip.generateAsync({ type: "blob" });
  let safeName = (programTitle || "scorm_package").replace(/[<>:"/\\|?*\x00-\x1F]/g, "").trim().replace(/\s+/g, "_");
  if (!safeName) safeName = "scorm_package";
  await nativeSaveFile(blob, `${safeName}_SCORM.zip`, ['.zip'], 'SCORM Package (ZIP)');
}
