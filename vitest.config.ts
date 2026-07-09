import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    // jsdom so the zustand persist layer (localStorage) and other browser
    // globals behave; IndexedDB is absent, which the message cache treats as
    // best-effort and swallows.
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
