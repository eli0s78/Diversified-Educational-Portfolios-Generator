import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  PageBreak,
} from "docx";
import { saveAs } from "file-saver";
import type { CourseOutline, SupervisorMatch } from "@/lib/engine/portfolio-types";
import { TRAINING_DIRECTIONS } from "@/lib/engine/portfolio-types";
import { parseRichContent, type RichSegment } from "@/lib/rich-text";

// ─────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────

function getDirectionName(key: string, locale: string): string {
  const dir = TRAINING_DIRECTIONS.find((d) => d.key === key);
  if (!dir) return key;
  return locale === "el" ? dir.name_el : dir.name;
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\- ]/g, "").replace(/\s+/g, "_");
}

// ─────────────────────────────────────────────────
// DOCX helpers
// ─────────────────────────────────────────────────

const COLORS = {
  primary: "2563EB",
  dark: "1E293B",
  muted: "64748B",
  white: "FFFFFF",
};

function heading(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel]) {
  return new Paragraph({
    heading: level,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, color: COLORS.dark })],
  });
}

function labelValue(label: string, value: string) {
  return new Paragraph({
    spacing: { after: 60 },
    children: [
      new TextRun({ text: `${label}: `, bold: true, size: 20, color: COLORS.muted }),
      new TextRun({ text: value, size: 20, color: COLORS.dark }),
    ],
  });
}

function bullet(text: string, level = 0) {
  return new Paragraph({
    bullet: { level },
    spacing: { after: 40 },
    children: [new TextRun({ text, size: 20 })],
  });
}

function emptyLine() {
  return new Paragraph({ spacing: { after: 100 }, children: [] });
}

/** Convert RichSegments to docx TextRun children */
function segmentsToTextRuns(segments: RichSegment[], size = 20): TextRun[] {
  return segments.map(
    (seg) => new TextRun({ text: seg.text, size, bold: seg.bold || undefined })
  );
}

/** Convert content string with **bold** and numbered lists into Paragraph[] */
function richContentToParagraphs(content: string): Paragraph[] {
  const blocks = parseRichContent(content);
  const paragraphs: Paragraph[] = [];

  for (const block of blocks) {
    if (block.type === "list-item") {
      paragraphs.push(
        new Paragraph({
          spacing: { after: 40 },
          indent: { left: 360 },
          children: [
            new TextRun({ text: `${block.number}. `, size: 20, bold: true }),
            ...segmentsToTextRuns(block.segments),
          ],
        })
      );
    } else {
      paragraphs.push(
        new Paragraph({
          spacing: { after: 80 },
          children: segmentsToTextRuns(block.segments),
        })
      );
    }
  }

  return paragraphs;
}

// ─────────────────────────────────────────────────
// DOCX Export
// ─────────────────────────────────────────────────

export async function exportCoursesToDocx(
  courses: CourseOutline[],
  supervisors: Record<string, SupervisorMatch[]>,
  programTitle: string,
  locale: string
): Promise<void> {
  const children: Paragraph[] = [];

  // Title page
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 2000, after: 200 },
      children: [
        new TextRun({
          text: programTitle || "Educational Program",
          bold: true,
          size: 52,
          color: COLORS.primary,
        }),
      ],
    })
  );
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: locale === "el" ? "Αναλυτικό Πρόγραμμα Μαθημάτων" : "Course Outlines",
          size: 28,
          color: COLORS.muted,
        }),
      ],
    })
  );
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [
        new TextRun({
          text: `${courses.length} ${locale === "el" ? "μαθήματα" : "courses"} — ${new Date().toLocaleDateString(locale)}`,
          size: 22,
          color: COLORS.muted,
          italics: true,
        }),
      ],
    })
  );

  // Each course
  for (let ci = 0; ci < courses.length; ci++) {
    const course = courses[ci];
    const dirName = getDirectionName(course.trainingDirection, locale);

    if (ci > 0) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }

    children.push(heading(`${ci + 1}. ${course.title}`, HeadingLevel.HEADING_1));
    children.push(labelValue(locale === "el" ? "Κατεύθυνση" : "Direction", dirName));
    children.push(
      labelValue(locale === "el" ? "Συνολικές Ώρες" : "Total Hours", `${course.totalHours}`)
    );
    children.push(emptyLine());

    // Overview
    children.push(heading(locale === "el" ? "Επισκόπηση" : "Overview", HeadingLevel.HEADING_2));
    children.push(...richContentToParagraphs(course.overview));

    // Supervisors
    const sups = supervisors[course.trainingDirection];
    if (sups?.length) {
      children.push(
        heading(
          locale === "el" ? "Προτεινόμενοι Επιβλέποντες" : "Recommended Supervisors",
          HeadingLevel.HEADING_2
        )
      );
      for (const sup of sups) {
        children.push(bullet(`${sup.name} — ${sup.role} (${sup.field})`));
      }
    }

    children.push(emptyLine());

    // Modules
    for (const mod of course.modules) {
      children.push(
        heading(
          `${locale === "el" ? "Ενότητα" : "Module"} ${mod.moduleNumber}: ${mod.title}`,
          HeadingLevel.HEADING_2
        )
      );
      children.push(
        new Paragraph({
          spacing: { after: 80 },
          children: [
            new TextRun({ text: mod.description, size: 20, italics: true, color: COLORS.muted }),
          ],
        })
      );

      // Module learning objectives
      if (mod.learningObjectives.length > 0) {
        children.push(
          new Paragraph({
            spacing: { before: 80, after: 40 },
            children: [
              new TextRun({
                text: locale === "el" ? "Μαθησιακοί Στόχοι:" : "Learning Objectives:",
                bold: true,
                size: 20,
              }),
            ],
          })
        );
        for (const obj of mod.learningObjectives) {
          children.push(bullet(obj));
        }
      }

      // Units
      for (const unit of mod.units) {
        children.push(
          heading(
            `${locale === "el" ? "Μονάδα" : "Unit"} ${mod.moduleNumber}.${unit.unitNumber}: ${unit.title}`,
            HeadingLevel.HEADING_3
          )
        );
        children.push(
          labelValue(
            locale === "el" ? "Εκτιμώμενη Διάρκεια" : "Estimated Duration",
            `${unit.estimatedMinutes} ${locale === "el" ? "λεπτά" : "min"}`
          )
        );

        // Content — rich text with bold and numbered lists
        children.push(...richContentToParagraphs(unit.content));

        // Unit learning objectives
        if (unit.learningObjectives.length > 0) {
          children.push(
            new Paragraph({
              spacing: { before: 60, after: 40 },
              children: [
                new TextRun({
                  text: locale === "el" ? "Μαθησιακοί Στόχοι:" : "Learning Objectives:",
                  bold: true,
                  size: 20,
                }),
              ],
            })
          );
          for (const obj of unit.learningObjectives) {
            children.push(bullet(obj));
          }
        }

        // Skill tags
        if (unit.skillTags.length > 0) {
          children.push(
            new Paragraph({
              spacing: { before: 60, after: 40 },
              children: [
                new TextRun({
                  text: `${locale === "el" ? "Δεξιότητες" : "Skills"}: `,
                  bold: true,
                  size: 18,
                  color: COLORS.muted,
                }),
                new TextRun({
                  text: unit.skillTags.join(", "),
                  size: 18,
                  color: COLORS.muted,
                }),
              ],
            })
          );
        }

        // Paper references
        if (unit.paperReferences.length > 0) {
          children.push(
            new Paragraph({
              spacing: { before: 60, after: 40 },
              children: [
                new TextRun({
                  text: locale === "el" ? "Βιβλιογραφία:" : "References:",
                  bold: true,
                  size: 18,
                  color: COLORS.muted,
                }),
              ],
            })
          );
          for (const ref of unit.paperReferences) {
            children.push(bullet(ref));
          }
        }

        children.push(emptyLine());
      }
    }
  }

  const doc = new Document({
    creator: "Diversified Educational Portfolios Generator",
    title: programTitle || "Course Outlines",
    sections: [{ children }],
  });

  const blob = await Packer.toBlob(doc);
  const fileName = sanitizeFileName(programTitle || "Course_Outlines") + ".docx";
  saveAs(blob, fileName);
}

// ─────────────────────────────────────────────────
// PDF Font Loading (Unicode / Greek support)
// ─────────────────────────────────────────────────

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunks: string[] = [];
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    chunks.push(String.fromCharCode(...chunk));
  }
  return btoa(chunks.join(""));
}

let fontCache: { regular: string; bold: string } | null = null;

async function tryFetch(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url);
    if (res.ok) {
      const buf = await res.arrayBuffer();
      // Validate: font files should be > 10KB
      if (buf.byteLength > 10000) return buf;
    }
  } catch {
    // ignore
  }
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadUnicodeFont(doc: any): Promise<string> {
  if (!fontCache) {
    // Try local files first (deployed with the app), then CDN fallback
    const sources = [
      { regular: "/fonts/NotoSans-Regular.ttf", bold: "/fonts/NotoSans-Bold.ttf" },
      {
        regular:
          "https://cdn.jsdelivr.net/gh/notofonts/notofonts.github.io@main/fonts/NotoSans/hinted/ttf/NotoSans-Regular.ttf",
        bold: "https://cdn.jsdelivr.net/gh/notofonts/notofonts.github.io@main/fonts/NotoSans/hinted/ttf/NotoSans-Bold.ttf",
      },
    ];

    for (const src of sources) {
      const [regular, bold] = await Promise.all([
        tryFetch(src.regular),
        tryFetch(src.bold),
      ]);
      if (regular && bold) {
        fontCache = {
          regular: arrayBufferToBase64(regular),
          bold: arrayBufferToBase64(bold),
        };
        break;
      }
    }
  }

  if (!fontCache) return "helvetica"; // fallback

  doc.addFileToVFS("NotoSans-Regular.ttf", fontCache.regular);
  doc.addFileToVFS("NotoSans-Bold.ttf", fontCache.bold);
  doc.addFont("NotoSans-Regular.ttf", "NotoSans", "normal");
  doc.addFont("NotoSans-Bold.ttf", "NotoSans", "bold");
  // Register regular as italic too (no italic font file)
  doc.addFont("NotoSans-Regular.ttf", "NotoSans", "italic");
  doc.setFont("NotoSans");

  return "NotoSans";
}

// ─────────────────────────────────────────────────
// PDF Rich Text Renderer
// ─────────────────────────────────────────────────

/**
 * Render rich content (bold + numbered lists) into jsPDF.
 * Returns the updated y position.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderRichContentPdf(
  doc: any,
  content: string,
  x: number,
  startY: number,
  maxWidth: number,
  fontSize: number,
  fontFamily: string,
  checkPageBreak: (needed: number) => void
): number {
  let y = startY;
  const blocks = parseRichContent(content);
  const lineHeight = fontSize * 0.45;

  for (const block of blocks) {
    doc.setFontSize(fontSize);
    doc.setTextColor(30, 41, 59);

    if (block.type === "list-item") {
      const indent = 6;
      const numText = `${block.number}. `;

      // Render number in bold
      doc.setFont(fontFamily, "bold");
      checkPageBreak(lineHeight + 2);
      doc.text(numText, x + indent, y);
      const numWidth = doc.getTextWidth(numText);

      // Render segments with word wrapping and inline bold
      y = renderSegmentsPdf(
        doc, block.segments, x + indent + numWidth, y,
        maxWidth - indent - numWidth, lineHeight, fontFamily, checkPageBreak
      );
      y += 1;
    } else {
      // Paragraph
      checkPageBreak(lineHeight + 2);
      y = renderSegmentsPdf(
        doc, block.segments, x, y,
        maxWidth, lineHeight, fontFamily, checkPageBreak
      );
      y += 2;
    }
  }

  return y;
}

/**
 * Render an array of RichSegments with word wrapping and inline bold.
 * Returns the updated y position.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderSegmentsPdf(
  doc: any,
  segments: RichSegment[],
  startX: number,
  startY: number,
  maxWidth: number,
  lineHeight: number,
  fontFamily: string,
  checkPageBreak: (needed: number) => void
): number {
  let x = startX;
  let y = startY;

  for (const seg of segments) {
    doc.setFont(fontFamily, seg.bold ? "bold" : "normal");

    // Split into words, preserving spaces
    const words = seg.text.split(/( +)/);

    for (const word of words) {
      if (!word) continue;

      const wordWidth = doc.getTextWidth(word);

      // Wrap to next line if needed
      if (x + wordWidth > startX + maxWidth && x > startX && word.trim()) {
        x = startX;
        y += lineHeight;
        checkPageBreak(lineHeight);
      }

      // Skip leading whitespace on a new line
      if (!word.trim() && x === startX) continue;

      doc.text(word, x, y);
      x += wordWidth;
    }
  }

  y += lineHeight;
  return y;
}

// ─────────────────────────────────────────────────
// PDF Export
// ─────────────────────────────────────────────────

export async function exportCoursesToPdf(
  courses: CourseOutline[],
  supervisors: Record<string, SupervisorMatch[]>,
  programTitle: string,
  locale: string
): Promise<void> {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;
  let y = margin;

  // Load Unicode font (supports Greek + Latin)
  const ff = await loadUnicodeFont(doc);

  const checkPageBreak = (needed: number) => {
    const pageHeight = doc.internal.pageSize.getHeight();
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  // ── Title Page ──
  y = 80;
  doc.setFontSize(24);
  doc.setFont(ff, "bold");
  doc.setTextColor(37, 99, 235);
  const titleLines = doc.splitTextToSize(programTitle || "Educational Program", contentWidth);
  doc.text(titleLines, pageWidth / 2, y, { align: "center" });
  y += titleLines.length * 10 + 8;

  doc.setFontSize(14);
  doc.setFont(ff, "normal");
  doc.setTextColor(100, 116, 139);
  const subtitle = locale === "el" ? "Αναλυτικό Πρόγραμμα Μαθημάτων" : "Course Outlines";
  doc.text(subtitle, pageWidth / 2, y, { align: "center" });
  y += 10;

  doc.setFontSize(11);
  doc.setFont(ff, "italic");
  const meta = `${courses.length} ${locale === "el" ? "μαθήματα" : "courses"} — ${new Date().toLocaleDateString(locale)}`;
  doc.text(meta, pageWidth / 2, y, { align: "center" });

  // ── Table of Contents ──
  doc.addPage();
  y = margin;
  doc.setFontSize(18);
  doc.setFont(ff, "bold");
  doc.setTextColor(30, 41, 59);
  doc.text(locale === "el" ? "Περιεχόμενα" : "Table of Contents", margin, y);
  y += 12;

  doc.setFontSize(11);
  doc.setFont(ff, "normal");
  doc.setTextColor(30, 41, 59);
  for (let ci = 0; ci < courses.length; ci++) {
    const course = courses[ci];
    const dirName = getDirectionName(course.trainingDirection, locale);
    const tocLine = `${ci + 1}. ${course.title} (${dirName})`;
    const lines = doc.splitTextToSize(tocLine, contentWidth);
    checkPageBreak(lines.length * 5 + 4);
    doc.text(lines, margin, y);
    y += lines.length * 5 + 4;
  }

  // ── Each Course ──
  for (let ci = 0; ci < courses.length; ci++) {
    const course = courses[ci];
    const dirName = getDirectionName(course.trainingDirection, locale);

    doc.addPage();
    y = margin;

    // Course title
    doc.setFontSize(18);
    doc.setFont(ff, "bold");
    doc.setTextColor(37, 99, 235);
    const cTitle = `${ci + 1}. ${course.title}`;
    const cTitleLines = doc.splitTextToSize(cTitle, contentWidth);
    doc.text(cTitleLines, margin, y);
    y += cTitleLines.length * 7 + 4;

    // Direction & hours
    doc.setFontSize(10);
    doc.setFont(ff, "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(
      `${locale === "el" ? "Κατεύθυνση" : "Direction"}: ${dirName}  |  ${course.totalHours} ${locale === "el" ? "ώρες" : "hours"}`,
      margin,
      y
    );
    y += 8;

    // Overview
    doc.setFontSize(13);
    doc.setFont(ff, "bold");
    doc.setTextColor(30, 41, 59);
    doc.text(locale === "el" ? "Επισκόπηση" : "Overview", margin, y);
    y += 6;

    y = renderRichContentPdf(doc, course.overview, margin, y, contentWidth, 10, ff, checkPageBreak);
    y += 2;

    // Supervisors
    const sups = supervisors[course.trainingDirection];
    if (sups?.length) {
      checkPageBreak(20);
      doc.setFontSize(13);
      doc.setFont(ff, "bold");
      doc.setTextColor(30, 41, 59);
      doc.text(
        locale === "el" ? "Προτεινόμενοι Επιβλέποντες" : "Recommended Supervisors",
        margin,
        y
      );
      y += 6;

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [
          [
            locale === "el" ? "Όνομα" : "Name",
            locale === "el" ? "Ρόλος" : "Role",
            locale === "el" ? "Πεδίο" : "Field",
          ],
        ],
        body: sups.map((s) => [s.name, s.role, s.field]),
        styles: { font: ff, fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      });
      y =
        (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    }

    // Modules
    for (const mod of course.modules) {
      checkPageBreak(30);
      doc.setFontSize(13);
      doc.setFont(ff, "bold");
      doc.setTextColor(37, 99, 235);
      const modTitle = `${locale === "el" ? "Ενότητα" : "Module"} ${mod.moduleNumber}: ${mod.title}`;
      const modTitleLines = doc.splitTextToSize(modTitle, contentWidth);
      doc.text(modTitleLines, margin, y);
      y += modTitleLines.length * 5.5 + 3;

      // Module description
      doc.setFontSize(10);
      doc.setFont(ff, "italic");
      doc.setTextColor(100, 116, 139);
      const descLines = doc.splitTextToSize(mod.description, contentWidth);
      checkPageBreak(descLines.length * 4.5 + 4);
      doc.text(descLines, margin, y);
      y += descLines.length * 4.5 + 4;

      // Module objectives
      if (mod.learningObjectives.length > 0) {
        doc.setFont(ff, "bold");
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(10);
        checkPageBreak(8);
        doc.text(
          locale === "el" ? "Μαθησιακοί Στόχοι:" : "Learning Objectives:",
          margin,
          y
        );
        y += 5;
        doc.setFont(ff, "normal");
        for (const obj of mod.learningObjectives) {
          const objLines = doc.splitTextToSize(`•  ${obj}`, contentWidth - 4);
          checkPageBreak(objLines.length * 4.5 + 2);
          doc.text(objLines, margin + 4, y);
          y += objLines.length * 4.5 + 2;
        }
        y += 2;
      }

      // Units
      for (const unit of mod.units) {
        checkPageBreak(25);
        doc.setFontSize(11);
        doc.setFont(ff, "bold");
        doc.setTextColor(30, 41, 59);
        const unitTitle = `${locale === "el" ? "Μονάδα" : "Unit"} ${mod.moduleNumber}.${unit.unitNumber}: ${unit.title}`;
        const unitTitleLines = doc.splitTextToSize(unitTitle, contentWidth);
        doc.text(unitTitleLines, margin, y);
        y += unitTitleLines.length * 5 + 2;

        // Duration
        doc.setFontSize(9);
        doc.setFont(ff, "normal");
        doc.setTextColor(100, 116, 139);
        doc.text(
          `${unit.estimatedMinutes} ${locale === "el" ? "λεπτά" : "min"}`,
          margin,
          y
        );
        y += 5;

        // Content — rich text with bold and numbered lists
        doc.setTextColor(30, 41, 59);
        y = renderRichContentPdf(
          doc, unit.content, margin, y, contentWidth, 10, ff, checkPageBreak
        );

        // Unit objectives
        if (unit.learningObjectives.length > 0) {
          doc.setFont(ff, "bold");
          doc.setFontSize(9);
          doc.setTextColor(30, 41, 59);
          checkPageBreak(8);
          doc.text(
            locale === "el" ? "Μαθησιακοί Στόχοι:" : "Learning Objectives:",
            margin,
            y
          );
          y += 4;
          doc.setFont(ff, "normal");
          for (const obj of unit.learningObjectives) {
            const objLines = doc.splitTextToSize(`•  ${obj}`, contentWidth - 4);
            checkPageBreak(objLines.length * 4 + 2);
            doc.text(objLines, margin + 4, y);
            y += objLines.length * 4 + 2;
          }
          y += 2;
        }

        // Skill tags
        if (unit.skillTags.length > 0) {
          doc.setFontSize(9);
          doc.setFont(ff, "bold");
          doc.setTextColor(100, 116, 139);
          checkPageBreak(8);
          const skillLabel = `${locale === "el" ? "Δεξιότητες" : "Skills"}: `;
          doc.text(skillLabel, margin, y);
          doc.setFont(ff, "normal");
          const tagsText = unit.skillTags.join(", ");
          const tagsX = margin + doc.getTextWidth(skillLabel);
          const tagsLines = doc.splitTextToSize(tagsText, contentWidth - (tagsX - margin));
          doc.text(tagsLines, tagsX, y);
          y += tagsLines.length * 4 + 3;
        }

        // References
        if (unit.paperReferences.length > 0) {
          doc.setFontSize(9);
          doc.setFont(ff, "bold");
          doc.setTextColor(100, 116, 139);
          checkPageBreak(8);
          doc.text(locale === "el" ? "Βιβλιογραφία:" : "References:", margin, y);
          y += 4;
          doc.setFont(ff, "normal");
          for (const ref of unit.paperReferences) {
            const refLines = doc.splitTextToSize(`•  ${ref}`, contentWidth - 4);
            checkPageBreak(refLines.length * 4 + 2);
            doc.text(refLines, margin + 4, y);
            y += refLines.length * 4 + 2;
          }
          y += 2;
        }

        y += 4;
      }

      y += 4;
    }
  }

  const fileName = sanitizeFileName(programTitle || "Course_Outlines") + ".pdf";
  doc.save(fileName);
}
