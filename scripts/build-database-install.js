// Generates reviewable SQL only. No network, environment secrets, or database connection.
const fs = require("node:fs"),
  path = require("node:path");
const { buildInstall } = require("../services/readiness/install");
function main(args = process.argv.slice(2)) {
  if (args.length !== 6)
    throw Error(
      "Usage: npm run db:package -- --mode legacy|fresh --project-ref PUBLIC_REF --output NEW_DIRECTORY",
    );
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    if (
      !["--mode", "--project-ref", "--output"].includes(args[i]) ||
      options[args[i]]
    )
      throw Error("Invalid package arguments");
    options[args[i]] = args[i + 1];
  }
  const pack = buildInstall({
    mode: options["--mode"],
    projectRef: options["--project-ref"],
  });
  const directory = path.resolve(options["--output"]);
  fs.mkdirSync(directory); // refuses overwrite
  fs.writeFileSync(path.join(directory, "install.sql"), pack.sql, {
    flag: "wx",
  });
  fs.writeFileSync(
    path.join(directory, "plan.json"),
    JSON.stringify(
      {
        ...pack,
        sql: undefined,
        applied: false,
        backupVerified: false,
        releaseReady: false,
      },
      null,
      2,
    ) + "\n",
    { flag: "wx" },
  );
  const canonical = path.join(directory, "supabase", "migrations");
  fs.mkdirSync(canonical, { recursive: true });
  for (const e of pack.entries)
    fs.copyFileSync(
      path.resolve(__dirname, "..", e.path),
      path.join(canonical, e.version + "_" + e.name + ".sql"),
      fs.constants.COPYFILE_EXCL,
    );
  console.log(
    JSON.stringify({
      directory,
      projectRef: pack.projectRef,
      mode: pack.mode,
      migrations: pack.entries.length,
      applied: false,
      releaseReady: false,
    }),
  );
}
if (require.main === module) {
  try {
    main();
  } catch {
    console.error(
      "Database package generation failed. Use explicit arguments and a new output directory; no database was contacted.",
    );
    process.exitCode = 1;
  }
}
module.exports = { main };
