const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = (name) => fs.readFileSync(path.join(__dirname, "..", name), "utf8");

test("owner overview ends after real cards without the removed footer controls", () => {
  const html = read("public/dashboard.html");
  for (const removed of ["owner-data-footer", "owner-data-notes", "owner-workflows"])
    assert.doesNotMatch(html, new RegExp('class="' + removed + '"'));
  for (const retained of ["ownerOperationsStatus", "ownerOverviewStatus", "ownerCustomerTotal"])
    assert.match(html, new RegExp('id="' + retained + '"'));
  assert.match(html, /class="owner-data-bindings" hidden/);
});
test("grouped navigation keeps advanced search and access gates without duplicate employee onboarding", () => {
  const nav = read("views/partials/portal-navigation.html");
  for (const group of ["Work", "Organizations", "Applications", "People", "Administration"])
    assert.match(nav, new RegExp("<summary>" + group));
  assert.doesNotMatch(nav, /href="\/search" aria-label="Search work"/);
  assert.match(nav, /id="topbarOnboard"[^>]*href="\/admin\/onboarding"[^>]*hidden/);
  assert.doesNotMatch(nav, /href="\/employees\/onboarding"/);
  assert.match(read("views/employees.html"), /href="\/employees\/onboarding"/);
  assert.match(read("services/workspace-header.js"), /Advanced work search/);
  assert.match(read("public/portal-navigation.js"), /orgAdminNav/);
});
test("guided project creation and manager actions preserve server-authorized task flow", () => {
  const js = read("public/projects.js"), html = read("views/projects.html");
  assert.match(js, /function setupProjectWizard/);
  assert.match(js, /customerOrganizationId/);
  assert.match(js, /detail\.role === "manager"/);
  for (const id of ["newProjectTask", "addProjectMember", "teamEditor", "taskEditor"])
    assert.match(html, new RegExp('id="' + id + '"'));
  assert.match(html, /Project managers can grant access/i);
});
test("product catalog form retains all governed registry fields", () => {
  const html = read("views/products.html");
  for (const name of ["code", "name", "status", "visibility", "integrationMode", "ownerId", "supportEmail", "docsUrl", "description"])
    assert.match(html, new RegExp('name="' + name + '"'));
  assert.match(html, /class="registry-safety-note"/);
  assert.match(html, /id="form"/);
});
