import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["index.ts"],
  format: ["esm"],
  target: "node18",
  platform: "node",
  clean: true,
});
