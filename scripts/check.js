const fs = require("node:fs"),
  path = require("node:path"),
  { spawnSync } = require("node:child_process");
const ignore = new Set([
  "node_modules",
  ".git",
  "test-results",
  "playwright-report",
  "coverage",
]);
function visit(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignore.has(entry.name)) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) visit(p);
    else if (/\.(?:js|mjs|cjs)$/.test(entry.name)) {
      const r = spawnSync(process.execPath, ["--check", p], {
        stdio: "inherit",
      });
      if (r.status !== 0) process.exit(r.status || 1);
    }
  }
}
visit(process.cwd());
console.log("All JavaScript source syntax checks passed.");
