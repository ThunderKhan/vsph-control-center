const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const read=file=>fs.readFileSync(path.join(__dirname,"..",file),"utf8");

test("GitHub-hosted jobs are opt-in and cannot run on ordinary PR commits or pushes",()=>{
 const workflow=read(".github/workflows/node-checks.yml");
 assert.match(workflow,/^on:\s*\n  workflow_dispatch:/m);
 assert.doesNotMatch(workflow,/^  (?:pull_request|push|schedule|workflow_run):/m);
 for(const suite of ["quality","database","browser","dependencies","container"]){
  assert.match(workflow,new RegExp("inputs\\.suite == '"+suite+"'"));
 }
 assert.match(workflow,/cancel-in-progress:\s*true/);
});

test("local verification covers isolated database, browser, demo and package audits",()=>{
 const packageJson=JSON.parse(read("package.json"));
 assert.equal(packageJson.scripts["verify:fast"],"node scripts/verify-local.mjs fast");
 assert.equal(packageJson.scripts["verify:release"],"node scripts/verify-local.mjs release");
 assert.ok(packageJson.scripts["format:fix"].includes("prettier --write"));
 assert.ok(packageJson.scripts["format:check"].includes("prettier --check"));
 const verifier=read("scripts/verify-local.mjs");
 for(const command of ["test:db:local","test:e2e:db","test:demo","migrations:eol","test:coverage"])
  assert.ok(verifier.includes('"'+command+'"'),"Missing release check "+command);
 assert.ok(verifier.includes("spawnSync(process.execPath,[npmCli,...args]"),
   "Local verification must use the Node npm-cli entrypoint");
 assert.ok(!verifier.includes("shell:process.platform") && !verifier.includes("shell:true"),
   "Local verification must never shell out with interpolated arguments");
 assert.match(verifier,/npm_execpath/);
 assert.match(verifier,/lockfileSha256/);
 assert.match(verifier,/workingTreeDirty/);
 assert.match(verifier,/receipt\.result=failed\?"failed":"passed"/);
 assert.match(read(".gitignore"),/^\.local-verification\/$/m);
});
