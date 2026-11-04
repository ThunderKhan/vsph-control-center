// Explicit aliases for the two historical files; source SQL/checksums are immutable.
function installationEntries(manifest) {
  const aliases = {
    "supabase/migrations/20261030_music_sso_launch_codes.sql": "20261030000100",
    "supabase/migrations/20261030_music_staff_musician_roles.sql":
      "20261030000200",
  };
  return [
    {
      ...manifest.bootstrap,
      version: "20261030000000",
      name: "vsph_verified_baseline",
      baseline: true,
    },
    ...manifest.migrations.map((m) => ({
      ...m,
      sourceVersion: m.version,
      version: aliases[m.path] || m.version,
    })),
  ];
}
function sourceMarker(entry) {
  return "-- vsph-source-sha256: " + entry.sha256;
}
// Supabase records the transport package in addition to the canonical entries
// the reviewed package owns. Preserve that receipt; recognize only its exact
// reviewed identity, full SQL digest and installed source dependencies.
function separateReceipts(history, manifest, registry = require('./installation-receipts.json')) {
  const crypto=require('node:crypto'),entries=installationEntries(manifest),receipts=[];
  const canonical=history.filter(row=>{
    const known=registry.find(r=>r.version===row.version&&r.name===row.name);
    if(!known||typeof row.source_marker!=='string'||
      crypto.createHash('sha256').update(row.source_marker).digest('hex')!==known.sqlSha256||
      !known.requires.every(version=>{
        const entry=entries.find(e=>e.version===version);
        return entry&&history.some(h=>h.version===entry.version&&h.name===entry.name&&h.source_marker===sourceMarker(entry));
      }))return true;
    receipts.push({version:known.version,name:known.name,sqlSha256:known.sqlSha256});return false;
  });
  return {history:canonical,receipts};
}
module.exports = { installationEntries, sourceMarker, separateReceipts };
