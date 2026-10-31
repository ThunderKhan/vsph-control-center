require("dotenv").config({ quiet: true });
const {
  client,
  configuration,
  ProviderError,
} = require("../services/github/provider");
const {
  approvedTarget,
  verifyGithub,
  applicationReader,
} = require("../services/readiness/github");
async function main() {
  const target = approvedTarget(process.env);
  if (!configuration()) throw Error("GitHub App is not configured.");
  const report = await verifyGithub({
    provider: client(),
    target,
    ...(target.origin ? { readApplication: applicationReader(target) } : {}),
  });
  console.log(JSON.stringify(report, null, 2));
}
if (require.main === module)
  main().catch((e) => {
    console.error(
      JSON.stringify({
        providerReadsVerified: false,
        fullApplicationAcceptanceVerified: false,
        code: e instanceof ProviderError ? e.code : "acceptance_blocked",
        message:
          "Verify approved target, App configuration, staged permissions and synchronization. No credentials or private provider payloads are logged.",
      }),
    );
    process.exitCode = 1;
  });
module.exports = { main };
