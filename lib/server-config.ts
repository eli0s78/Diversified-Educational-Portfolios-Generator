/**
 * Server-side configuration (NEVER exposed to client)
 *
 * This file provides secure access to server-side environment variables.
 * These values are only accessible in API routes and server components.
 */

/**
 * Get the server-side Gemini API key
 * This key is used for all AI generation and is never exposed to users
 *
 * @throws Error if GEMINI_API_KEY is not set in environment
 * @returns The Gemini API key from environment variables
 */
export function getServerGeminiApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set in environment variables. " +
      "Please add it to .env.local for local development or to Railway environment variables for production."
    );
  }

  return apiKey;
}

/**
 * Get the default Gemini model ID from environment or use default
 * @returns The Gemini model ID to use
 */
export function getServerGeminiModelId(): string {
  return process.env.GEMINI_MODEL_ID || "gemini-3.1-pro-preview";
}

/**
 * Check if server-side Gemini API key is configured
 * @returns true if the key is set, false otherwise
 */
export function hasServerGeminiApiKey(): boolean {
  return !!process.env.GEMINI_API_KEY;
}
