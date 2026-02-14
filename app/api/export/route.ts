import { NextResponse } from "next/server";
import type { CourseOutline } from "@/lib/engine/portfolio-types";

function coursesToMarkdown(courses: CourseOutline[], language = "en"): string {
  let md =
    language === "el"
      ? "# Πρόγραμμα E-Learning\n\n---\n\n"
      : "# E-Learning Program\n\n---\n\n";

  for (const course of courses) {
    md += `## ${course.title}\n\n`;
    md += `**Direction:** ${course.trainingDirection}  \n`;
    md += `**Total Hours:** ${course.totalHours}\n\n`;
    md += `${course.overview}\n\n`;

    for (const mod of course.modules) {
      md += `### Module ${mod.moduleNumber}: ${mod.title}\n\n`;
      md += `${mod.description}\n\n`;

      if (mod.learningObjectives.length > 0) {
        md += `**Learning Objectives:**\n`;
        for (const obj of mod.learningObjectives) {
          md += `- ${obj}\n`;
        }
        md += "\n";
      }

      for (const unit of mod.units) {
        md += `#### Unit ${unit.unitNumber}: ${unit.title}\n\n`;
        md += `*${unit.estimatedMinutes} minutes*\n\n`;
        md += `${unit.content}\n\n`;

        if (unit.skillTags.length > 0) {
          md += `**Skills:** ${unit.skillTags.join(", ")}\n\n`;
        }
        if (unit.paperReferences.length > 0) {
          md += `**References:**\n`;
          for (const ref of unit.paperReferences) {
            md += `- ${ref}\n`;
          }
          md += "\n";
        }
      }
    }
    md += "---\n\n";
  }

  return md;
}

export async function POST(request: Request) {
  try {
    const { courses, format = "markdown", language = "en" } = await request.json();

    if (!courses || !Array.isArray(courses)) {
      return NextResponse.json(
        { error: "No courses provided" },
        { status: 400 }
      );
    }

    if (format === "json") {
      return NextResponse.json(courses);
    }

    const markdown = coursesToMarkdown(courses, language);
    return new NextResponse(markdown, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": 'attachment; filename="elearning-program.md"',
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json(
      { error: "Export failed" },
      { status: 500 }
    );
  }
}
