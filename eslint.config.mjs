import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

// eslint-config-next 16 ships flat configs directly; no FlatCompat / @eslint/eslintrc needed
// (that transitive dependency disappeared with eslint 10 and broke `npm run lint` on a clean install).
const eslintConfig = [
  {
    ignores: [".next/**", "node_modules/**", "next-env.d.ts", "release/**", "electron/dist/**", "mcp-server/dist/**", ".claude/**", ".clone/**"],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    // Electron build hooks are CommonJS by design.
    files: ["scripts/**/*.js", "electron-builder.json"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
];

export default eslintConfig;
