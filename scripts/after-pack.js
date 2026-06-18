// electron-builder special-cases `node_modules` out of its file matcher, so the
// `extraResources` copy of the Next standalone bundle silently drops its nested
// `node_modules` (electron-builder #3185 / #7733). Without it the packaged
// server.js crashes with `Cannot find module 'next'` and the desktop app can't
// reach its local server. Copy the standalone node_modules into the packed app
// here, after packing, where the file matcher no longer applies.
const path = require("path");
const fs = require("fs");

exports.default = async function afterPack(context) {
  const { appOutDir, electronPlatformName, packager } = context;
  const productFilename = packager.appInfo.productFilename; // e.g. "Teamsly"

  const resourcesDir =
    electronPlatformName === "darwin"
      ? path.join(appOutDir, `${productFilename}.app`, "Contents", "Resources")
      : path.join(appOutDir, "resources");

  const src = path.join(process.cwd(), ".next", "standalone", "node_modules");
  const dest = path.join(resourcesDir, "standalone", "node_modules");

  if (!fs.existsSync(src)) {
    throw new Error(`[after-pack] standalone node_modules not found at ${src} — run \`next build\` + prepare-standalone first`);
  }
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(src, dest, { recursive: true });
  console.log(`[after-pack] copied standalone node_modules -> ${dest}`);
};
