// TypeScript 6 (TS2882) requires a module declaration for side-effect imports
// of non-code assets like `import "./globals.css"`. Next.js resolves CSS via its
// build pipeline, not the type system, so a bare ambient declaration is enough.
// (No CSS Modules in this project, so a global `*.css` shape is safe.)
declare module "*.css";
