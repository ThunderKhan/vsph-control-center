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


test("workspace SQL has a complete single checklist action block and guarded customer visibility",()=>{
 const sql=read("supabase/migrations/20261109203000_project_workspace_v2.sql");
 const start=sql.indexOf("create function public.project_workspace_command(");
 assert.ok(start>=0,"Expected workspace function");
 const functionSql=sql.slice(start);
 assert.equal(functionSql.split("end$;").length-1,1,"Only one complete workspace function");
 assert.ok(functionSql.trimEnd().endsWith(
   "grant execute on function public.project_workspace_command(uuid,text,uuid,jsonb) to service_role;"
 ),"No SQL may appear after the final grant");
 const insertAt=functionSql.indexOf("insert into public.project_checklist_items(");
 const toggleAt=functionSql.indexOf("elsif p_action='checklist.toggle'");
 assert.ok(insertAt>0&&insertAt<toggleAt,"Assignee validation must end with a checklist insert before toggle");
 assert.equal((functionSql.match(/elsif p_action='checklist.toggle'/g)||[]).length,1);
 assert.match(functionSql,/p_data->'assigneeId' is distinct from 'null'::jsonb/);
 assert.match(functionSql,/access:=public\.project_permission\(p_actor,p_project\)/);
 assert.match(functionSql,/case when access='client' then\s*jsonb_build_object/);
 assert.doesNotMatch(functionSql,/Until checklist assignment is implemented/);
});
