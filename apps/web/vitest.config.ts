import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  // Test files that boot an in-memory Postgres run one at a time (see packages/db).
  test: { fileParallelism: false },
});
