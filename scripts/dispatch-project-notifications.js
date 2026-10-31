require("dotenv").config();
const { db, check } = require("../db");
async function main() {
  for (const action of ["scan", "dispatch"]) {
    const result = await db()
      .rpc("notification_command", {
        p_actor: null,
        p_action: action,
        p_id: null,
        p_data: {},
      })
      .then(check);
    console.log(JSON.stringify(result));
  }
}
if (require.main === module)
  main().catch(() => {
    console.error(
      "Project notification batch failed. Inspect durable outbox state.",
    );
    process.exitCode = 1;
  });
