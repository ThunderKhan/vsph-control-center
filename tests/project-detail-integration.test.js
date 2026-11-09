const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");

test("project creation modal and focused detail views coexist without resurrecting old utility panels",()=>{
 const html=read("views/projects.html");
 assert.match(html,/id="projectCreateOverlay"/);
 assert.match(html,/id="projectCreateSuccess"/);
 assert.match(html,/id="projectDeleteDialog"/);
 assert.match(html,/id="projectViewNav"/);
 assert.match(html,/data-project-view="overview"/);
 assert.match(html,/data-project-view="applications"/);
 assert.match(html,/id="milestoneChecklistPanel"/);
 assert.match(html,/id="projectWeeklyUpdates"/);
 assert.match(html,/src="\/project-detail-v2.js"/);
 assert.match(html,/href="\/project-detail-v2.css"/);
 assert.doesNotMatch(html,/id="projectOperations"|id="accountSessions"/);
});

test("readable project URLs still use authorized detail and UUID-based internal writes",()=>{
 const api=read("routes/projects.js");
 const client=read("public/projects.js");
 const views=read("public/project-detail-v2.js");
 assert.match(api,/router\.get\("\/by-key\/:key"/);
 assert.match(api,/return call\(req, "detail", found\.id\)/);
 assert.match(api,/project_lifecycle_command/);
 assert.match(api,/project_workspace_command/);
 assert.match(client,/\/api\/projects\/by-key\//);
 assert.match(client,/let projectId = location\.pathname/);
 assert.match(views,/const key=current\.project\.project\.key/);
 assert.doesNotMatch(views,/const key=current\.project\.key/);
 assert.match(views,/workspace-mutated/);
 assert.match(client,/viewCreatedProject/);
});

test("canonical additive migration ledger contains both ordered feedback domains",()=>{
 const manifest=JSON.parse(read("supabase/migration-manifest.json"));
 const names=manifest.migrations.map(m=>m.name);
 assert.equal(names.at(-2),"feedback01_04_lifecycle");
 assert.equal(names.at(-1),"project_workspace_v2");
 const end=manifest.migrations.at(-1);
 assert.ok(end.requires.includes(manifest.migrations.at(-2).path));
 assert.match(read("services/readiness/database.js"),/project_workspace_command/);
 assert.match(read("tests/database/http-fixture.js"),/project_workspace_command/);
});
