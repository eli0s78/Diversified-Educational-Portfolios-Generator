import { NextResponse } from "next/server";
import { resolveGeminiModel } from "@/lib/ai/model-resolver";
import { getServerGeminiApiKey } from "@/lib/server-config";

export async function GET() {
    try {
        const apiKey = getServerGeminiApiKey();
        if (!apiKey) {
            return NextResponse.json(
                { valid: false, error: "Server API key not configured" },
                { status: 500 }
            );
        }

        // This will throw if no 3.1+ model is found based on our updated resolver
        const activeModel = await resolveGeminiModel(apiKey, { strict: true });

        return NextResponse.json({
            valid: true,
            model: activeModel,
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to resolve Gemini model";
        return NextResponse.json(
            { valid: false, error: message },
            { status: 400 }
        );
    }
}
