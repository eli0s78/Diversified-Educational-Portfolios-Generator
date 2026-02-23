import { NextResponse } from "next/server";
import { getSettings } from "@/lib/project-manager";

export const runtime = "nodejs";

export async function GET() {
  const settings = getSettings();

  return NextResponse.json({
    bertopic_service_url: settings.bertopic_service_url || null,
    configured: !!settings.bertopic_service_url,
  });
}
