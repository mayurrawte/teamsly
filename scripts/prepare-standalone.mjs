import { cp, access } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const standalone = join(root, ".next", "standalone");

async function exists(p) {
  try { await access(p); return true; } catch { return false; }
}

if (!(await exists(join(standalone, "server.js")))) {
  console.error("[prepare-standalone] .next/standalone/server.js missing — run `next build` with output:'standalone' first.");
  process.exit(1);
}

await cp(join(root, ".next", "static"), join(standalone, ".next", "static"), { recursive: true });
if (await exists(join(root, "public"))) {
  await cp(join(root, "public"), join(standalone, "public"), { recursive: true });
}
console.log("[prepare-standalone] copied static + public into .next/standalone");
