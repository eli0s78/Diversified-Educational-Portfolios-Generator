import { NextResponse } from "next/server";
import { getSupervisorsForDirections } from "@/lib/db/queries";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { directionKeys, limit = 3 } = body as {
      directionKeys: string[];
      limit?: number;
    };

    if (!directionKeys || !Array.isArray(directionKeys) || directionKeys.length === 0) {
      return NextResponse.json(
        { error: "directionKeys array is required" },
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
