import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

// eslint-config-next 16 ships flat configs directly; no FlatCompat / @eslint/eslintrc needed
// (that transitive dependency disappeared with eslint 10 and broke `npm run lint` on a clean install).
const eslintConfig = [
  {
    ignores: [".next/**", "node_modules/**", "next-env.d.ts", "release/**", "electron/dist/**", "mcp-server/dist/**", ".claude/**", ".clone/**"],
  },
  // eslint-plugin-react-hooks 7 (React Compiler era) ships new opinionated rules. The
  // codebase predates them; surface them as warnings until each pattern is migrated
  // instead of failing every clean install. Applied inside the config object that
  // registers the plugin, as flat config requires.
  ...nextCoreWebVitals.map((c) =>
    c.plugins && c.plugins["react-hooks"]
      ? {
          ...c,
          rules: {
            ...c.rules,
            "react-hooks/set-state-in-effect": "warn",
            "react-hooks/purity": "warn",
            "react-hooks/static-components": "warn",
            "react-hooks/refs": "warn",
          },
        }
      : c,
  ),
  ...nextTypescript,
  {
    // Electron build hooks are CommonJS by design.
    files: ["scripts/**/*.js", "electron-builder.json"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
];

export default eslintConfig;
