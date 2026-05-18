import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/__tests__/**/*.test.ts"],
    exclude: [
      "**/node_modules/**",
      "e2e/**",
      "src/lib/terminology/__tests__/**",
    ],
    environment: "node",
  },
});
