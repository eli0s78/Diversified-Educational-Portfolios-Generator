"use client";

import { useEffect } from "react";

/**
 * Suppress harmless HMR WebSocket errors in development
 * These errors occur when the page loads before the HMR connection is established
 * and are normal in Next.js Turbopack development mode
 */
export function ErrorSuppressor() {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      // Suppress HMR WebSocket errors
      const originalError = console.error;
      console.error = (...args) => {
        const errorMessage = args[0]?.toString() || "";

        // Suppress known harmless errors
        if (
          errorMessage.includes("webpack-hmr") ||
          errorMessage.includes("_next/webpack-hmr") ||
          errorMessage.includes("WebSocket connection")
        ) {
          return;
        }

        originalError(...args);
      };

      return () => {
        console.error = originalError;
      };
    }
  }, []);

  return null;
}
