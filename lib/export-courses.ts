import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  PageBreak,
} from "docx";
import type { CourseOutline, SupervisorMatch } from "@/lib/engine/portfolio-types";
import { TRAINING_DIRECTIONS } from "@/lib/engine/portfolio-types";
import { nativeSaveFile } from "@/lib/native-save";
import type { ProjectPortfolioResult } from "@/lib/project-manager";
import { parseRichContent, type RichSegment } from "@/lib/rich-text";
import { getSettings } from "@/lib/project-manager";

// ─────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────

function getDirectionName(key: string, locale: string): string {
  const dir = TRAINING_DIRECTIONS.find((d) => d.key === key);
  if (!dir) return key;
  return locale === "el" ? dir.name_el : dir.name;
}

function sanitizeFileName(name: string): string {
  const safe = name.replace(/[<>:"/\\|?*\x00-\x1F]/g, "").trim().replace(/\s+/g, "_");
  return safe || "Course_Outlines";
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
    creator: getSettings().name || "Diversified Educational Portfolios Generator",
    title: programTitle || "Course Outlines",
    sections: [{ children }],
  });

  const blob = await Packer.toBlob(doc);
  const fileName = sanitizeFileName(programTitle || "Course_Outlines") + ".docx";
  await nativeSaveFile(blob, fileName, ['.docx'], 'Word Document');
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
  checkPageBreak: (currentY: number, needed: number) => number
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
      y = checkPageBreak(y, lineHeight + 2);
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
      y = checkPageBreak(y, lineHeight + 2);
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
  checkPageBreak: (currentY: number, needed: number) => number
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
        y = checkPageBreak(y, lineHeight);
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
// PDF Portfolio Charts
// ─────────────────────────────────────────────────

/** Parse CSS var(--direction-N) to RGB. Fallback colors if CSS vars unavailable. */
const DIRECTION_RGB: [number, number, number][] = [
  [59, 130, 246],   // blue
  [139, 92, 246],   // violet
  [245, 158, 11],   // amber
  [239, 68, 68],    // red
  [16, 185, 129],   // emerald
  [6, 182, 212],    // cyan
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderPortfolioCharts(
  doc: any,
  portfolio: ProjectPortfolioResult,
  locale: string,
  margin: number,
  contentWidth: number,
  ff: string
): number {
  let y = margin;
  const sel = portfolio.selectedPortfolio;
  const weights = sel.weights;

  // Section title
  doc.setFontSize(18);
  doc.setFont(ff, "bold");
  doc.setTextColor(37, 99, 235);
  doc.text(
    locale === "el" ? "Ανάλυση Χαρτοφυλακίου" : "Portfolio Analysis",
    margin,
    y
  );
  y += 12;

  // Stats row
  const stats = [
    {
      label: locale === "el" ? "Αναμενόμενη Αξία" : "Expected Return",
      value: `${(sel.expectedReturn * 100).toFixed(1)}%`,
      color: [37, 99, 235] as [number, number, number],
    },
    {
      label: locale === "el" ? "Κίνδυνος" : "Risk",
      value: `${(sel.risk * 100).toFixed(1)}%`,
      color: [139, 92, 246] as [number, number, number],
    },
    {
      label: locale === "el" ? "Αποδοτικότητα" : "Sharpe Ratio",
      value: sel.sharpeRatio.toFixed(2),
      color: [16, 185, 129] as [number, number, number],
    },
    {
      label: locale === "el" ? "Διαφοροποίηση" : "Diversification",
      value: `${(sel.diversificationScore * 100).toFixed(0)}%`,
      color: [245, 158, 11] as [number, number, number],
    },
  ];

  const boxWidth = (contentWidth - 12) / 4;
  const boxHeight = 22;

  for (let i = 0; i < stats.length; i++) {
    const bx = margin + i * (boxWidth + 4);
    // Background box
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(bx, y, boxWidth, boxHeight, 2, 2, "F");
    // Label
    doc.setFontSize(7);
    doc.setFont(ff, "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(stats[i].label.toUpperCase(), bx + 3, y + 6);
    // Value
    doc.setFontSize(14);
    doc.setFont(ff, "bold");
    doc.setTextColor(...stats[i].color);
    doc.text(stats[i].value, bx + 3, y + 16);
  }
  y += boxHeight + 10;

  // Weight allocation bars
  doc.setFontSize(13);
  doc.setFont(ff, "bold");
  doc.setTextColor(30, 41, 59);
  doc.text(
    locale === "el" ? "Κατανομή Βαρών" : "Weight Allocation",
    margin,
    y
  );
  y += 8;

  const barMaxWidth = contentWidth - 50;
  const barHeight = 7;
  const barSpacing = 12;

  for (let i = 0; i < TRAINING_DIRECTIONS.length; i++) {
    const dir = TRAINING_DIRECTIONS[i];
    const weight = weights[i] || 0;
    const label = locale === "el" ? dir.name_el : dir.name;

    // Direction label
    doc.setFontSize(8);
    doc.setFont(ff, "normal");
    doc.setTextColor(30, 41, 59);
    const truncLabel = label.length > 45 ? label.slice(0, 42) + "..." : label;
    doc.text(truncLabel, margin, y);
    y += 3;

    // Background bar
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(margin, y, barMaxWidth, barHeight, 1.5, 1.5, "F");

    // Filled bar
    const fillWidth = Math.max(1, weight * barMaxWidth);
    const [r, g, b] = DIRECTION_RGB[i] || [100, 100, 100];
    doc.setFillColor(r, g, b);
    doc.roundedRect(margin, y, fillWidth, barHeight, 1.5, 1.5, "F");

    // Percentage text
    doc.setFontSize(8);
    doc.setFont(ff, "bold");
    doc.setTextColor(30, 41, 59);
    doc.text(`${(weight * 100).toFixed(1)}%`, margin + barMaxWidth + 3, y + 5);

    y += barSpacing;
  }

  y += 4;

  // Risk tolerance
  doc.setFontSize(9);
  doc.setFont(ff, "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(
    `${locale === "el" ? "Ανοχή Κινδύνου" : "Risk Tolerance"}: ${(portfolio.riskTolerance * 100).toFixed(0)}%`,
    margin,
    y
  );
  y += 8;

  return y;
}

// ─────────────────────────────────────────────────
// PDF Export
// ─────────────────────────────────────────────────

export async function exportCoursesToPdf(
  courses: CourseOutline[],
  supervisors: Record<string, SupervisorMatch[]>,
  programTitle: string,
  locale: string,
  portfolioResult?: ProjectPortfolioResult | null
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

  const checkPageBreakWithY = (currentY: number, needed: number): number => {
    const pageHeight = doc.internal.pageSize.getHeight();
    if (currentY + needed > pageHeight - margin) {
      doc.addPage();
      return margin;
    }
    return currentY;
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

  // ── Portfolio Analysis Page ──
  if (portfolioResult) {
    doc.addPage();
    y = margin;
    y = renderPortfolioCharts(doc, portfolioResult, locale, margin, contentWidth, ff);
  }

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

    y = renderRichContentPdf(doc, course.overview, margin, y, contentWidth, 10, ff, checkPageBreakWithY);
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
          doc, unit.content, margin, y, contentWidth, 10, ff, checkPageBreakWithY
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
  const blob = doc.output("blob");
  await nativeSaveFile(blob, fileName, ['.pdf'], 'PDF Document');
}
