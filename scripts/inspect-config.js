// Local-only configuration inspection. Never contacts Supabase or prints credentials.
const { configured } = require("../db");
function inspectConfig(env = process.env, expected = null) {
  const result = {
    configurationPresent: {
      url: Boolean(env.SUPABASE_URL),
      serverKey: Boolean(env.SUPABASE_SECRET_KEY),
      publishableKey: Boolean(env.SUPABASE_PUBLISHABLE_KEY),
    },
    urlValid: false,
    projectRef: null,
    host: null,
    expectedProject: expected,
    matchesExpectedProject: false,
    connectionVerified: false,
  };
  try {
    const u = new URL(env.SUPABASE_URL);
    if (
      u.username ||
      u.password ||
      u.search ||
      u.hash ||
      u.pathname !== "/" ||
      !(
        u.protocol === "https:" ||
        (u.protocol === "http:" &&
          ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname))
      )
    )
      return result;
    result.urlValid = true;
    result.host = u.hostname;
    result.projectRef =
      u.hostname.match(/^([a-z0-9]{20})\.supabase\.co$/)?.[1] || null;
    result.matchesExpectedProject = Boolean(
      expected && result.projectRef === expected,
    );
  } catch {
    /* Deliberately omit exception: URL errors may embed a credential-bearing input. */
  }
  return result;
}
if (require.main === module) {
  require("dotenv").config({ quiet: true });
  const args = process.argv.slice(2),
    expected = args[0];
  if (args.length > 1 || (expected && !/^[a-z0-9]{20}$/.test(expected))) {
    console.error(
      "Usage: npm run config:inspect -- <expected-public-project-ref>",
    );
    process.exitCode = 2;
  } else {
    const result = inspectConfig(process.env, expected);
    console.log(
      JSON.stringify(
        {
          ...result,
          applicationConfigured: configured(),
          source:
            "Effective process environment; .env fills only unset values.",
        },
        null,
        2,
      ),
    );
    if (
      !result.urlValid ||
      !configured() ||
      (expected && !result.matchesExpectedProject)
    )
      process.exitCode = 1;
  }
}
module.exports = { inspectConfig };
