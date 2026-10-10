import { defineConfig } from "vitest/config";

// Each test file boots an in-memory Postgres (WASM). Booting several at once
// starves the CPU and trips timeouts; one file at a time is faster overall.
export default defineConfig({ test: { fileParallelism: false } });
