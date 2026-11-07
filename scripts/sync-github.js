require("dotenv").config();
const { configuration } = require("../services/github/provider");
const { tick } = require("../services/github/sync");
const { command } = require("../routes/delivery");
async function main() {
  if (!configuration())
    throw Error("GitHub App integration is disabled or incomplete.");
  // A scheduler may invoke this finite batch. No implicit production background process.
  for (let n = 0; n < 14; n++) {
    const result = await tick({ command });
    if (!result.processed) break;
    if (result.error) throw Error("GitHub synchronization needs retry.");
    console.log(JSON.stringify(result));
  }
}
if (require.main === module)
  main().catch(() => {
    console.error("GitHub synchronization failed; inspect connection health.");
    process.exitCode = 1;
  });
