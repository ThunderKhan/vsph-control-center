require("dotenv").config({ quiet: true });
const { Pool } = require("pg");
const crypto = require("node:crypto");
const {
  verifyManifest,
  inspectDatabase,
  assess,
} = require("../services/readiness/database");
async function main() {
  const checked = verifyManifest();
  if (checked.errors.length) {
    console.log(
      JSON.stringify({ releaseReady: false, blockers: checked.errors }),
    );
    process.exitCode = 1;
    return;
  }
  if (process.argv.includes("--manifest-only")) {
    console.log(
      JSON.stringify({
        checksumsVerified: true,
        migrations: checked.manifest.migrations.length,
        releaseReady: false,
        note: checked.manifest.note,
      }),
    );
    return;
  }
  // No fallback to SUPABASE_URL, production DSNs or generic DATABASE_URL.
  const value = process.env.STAGING_DATABASE_URL,
    host = process.env.STAGING_DATABASE_HOST,
    name = process.env.STAGING_DATABASE_NAME;
  if (
    process.env.STAGING_INSPECTION_APPROVED !== "true" ||
    !value ||
    !host ||
    !name
  )
    throw Error("Approved isolated staging target is required.");
  const url = new URL(value);
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    url.hostname !== host ||
    decodeURIComponent(url.pathname.slice(1)) !== name
  )
    throw Error("Staging target mismatch.");
  if (
    !["localhost", "127.0.0.1", "[::1]"].includes(host) &&
    url.searchParams.get("sslmode") !== "verify-full"
  )
    throw Error("Remote TLS hostname verification is required.");
  if ([...url.searchParams.keys()].some((key) => key !== "sslmode"))
    throw Error("Unapproved connection override.");
  const pool = new Pool({
    connectionString: value,
    max: 1,
    connectionTimeoutMillis: 10000,
    application_name: "vsph-readonly-readiness",
  });
  let client;
  try {
    client = await pool.connect();
    const snapshot = await inspectDatabase(client);
    const result = assess(snapshot, checked.manifest);
    console.log(
      JSON.stringify(
        {
          targetFingerprint: crypto
            .createHash("sha256")
            .update(host + "/" + name)
            .digest("hex"),
          ...result,
          snapshot,
        },
        null,
        2,
      ),
    );
    if (result.blockers.length) process.exitCode = 1;
  } finally {
    client?.release();
    await pool.end();
  }
}
if (require.main === module)
  main().catch(() => {
    console.error(
      JSON.stringify({
        releaseReady: false,
        message:
          "Readiness inspection failed. Verify the explicit staging target and read-only catalog permissions; credentials are not logged.",
      }),
    );
    process.exitCode = 1;
  });
module.exports = { main };
