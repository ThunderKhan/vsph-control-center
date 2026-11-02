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
module.exports = { installationEntries, sourceMarker };
