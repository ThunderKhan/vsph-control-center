const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = file => fs.readFileSync(path.join(__dirname,"..",file),"utf8");

test("Projects portfolio retains a single server-authorized list with scoped metrics and cursor pagination",()=>{
  const html=read("views/projects.html"),js=read("public/projects.js"),css=read("public/projects.css");
  for(const id of ["portfolioCount","portfolioActive","portfolioDue","portfolioUrgent","projectResultsCount",
    "projectFilters","projectList","moreProjects","projectPageStatus","projectClearFilters"]){
    assert.match(html,new RegExp('id="'+id+'"'),id);
  }
  assert.doesNotMatch(html,/Internal work and customer delivery, with explicit project access/);
  assert.match(html,/<p id="projectSubtitle" hidden><\/p>/);
  assert.match(js,/api\("\/api\/projects\?" \+ qs\)/);
  assert.match(js,/page\.length < 50/);
  assert.match(js,/items = append \? items\.concat\(page\) : page/);
  assert.match(js,/function updatePortfolioMetrics/);
  assert.match(html,/Summary cards reflect only loaded, authorized projects/);
  assert.match(css,/\.project-portfolio-table/);
  assert.match(css,/@media\(max-width:620px\)/);
});
test("Projects portfolio preserves audit-controlled lifecycle actions and backend enumeration values",()=>{
  const js=read("public/projects.js"),routes=read("routes/projects.js");
  assert.match(js,/projectActions\(p\)/);
  assert.match(js,/if \(canAdministerProjects\)/);
  assert.match(js,/archiveProject\(p\)/);
  assert.match(js,/prepareProjectDeletion\(p\)/);
  assert.match(js,/p\.priority === "urgent"/);
  assert.match(js,/o\.value = typeof v === "string" \? v : v\.value/);
  assert.match(routes,/project_lifecycle_command/);
  assert.match(routes,/confirmed/);
});
test("Project creation copy is compact without removing the validated wizard and review",()=>{
  const html=read("views/projects.html"),js=read("public/projects.js");
  assert.doesNotMatch(html,/>NEW PROJECT<|Set up a client or internal engagement/);
  assert.doesNotMatch(js,/The owner retains governance|Linked catalog products describe delivery/);
  assert.match(js,/function setupProjectWizard/);
  assert.match(js,/function validateStep/);
  assert.match(js,/function updateReview/);
  assert.match(js,/projectCreateError/);
  assert.match(js,/managerUserId/);
  assert.match(html,/id="projectCreateSuccess"/);
});
test("shared portal navigation uses Title Case while retaining authorized menu routes",()=>{
  const nav=read("views/partials/portal-navigation.html");
  for(const label of ["Employee Directory","Customer Directory","My Organizations",
    "Platform Administration","Finance Journal","Project Managers","My Tasks"]){
    assert.ok(nav.includes(label),label);
  }
  assert.doesNotMatch(nav,/href="\/employees\/onboarding"/);
  assert.match(nav,/href="\/employees"/);
  assert.match(read("public/projects.js"),/displayEnum/);
});
