import { NextResponse } from "next/server";
import {
  getSupervisorsForDirections,
  matchSupervisorsToCoursesContentBased,
} from "@/lib/db/queries";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Content-based matching when courses are provided
    if (body.courses && Array.isArray(body.courses)) {
      const { courses, limit = 3 } = body as {
        courses: Array<{
          trainingDirection: string;
          title: string;
          overview: string;
          modules: Array<{ title: string; description: string }>;
        }>;
        limit?: number;
      };

      const supervisors = matchSupervisorsToCoursesContentBased(
        courses,
        Math.min(limit, 10)
      );

      return NextResponse.json({ supervisors });
    }

    // Legacy direction-based matching
    const { directionKeys, limit = 3 } = body as {
      directionKeys: string[];
      limit?: number;
    };

    if (!directionKeys || !Array.isArray(directionKeys) || directionKeys.length === 0) {
      return NextResponse.json(
        { error: "directionKeys array or courses array is required" },
        { status: 400 }
      );
    }

    const supervisors = getSupervisorsForDirections(
      directionKeys,
      Math.min(limit, 10)
    );

    return NextResponse.json({ supervisors });
  } catch (error) {
    console.error("Supervisors query error:", error);
    const message = error instanceof Error ? error.message : "Failed to query supervisors";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
