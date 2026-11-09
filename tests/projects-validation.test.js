const test = require("node:test"),
  assert = require("node:assert/strict");
const { validate,validateWorkspace } = require("../routes/projects");
test("project input rejects ownership confusion and injected permissions", () => {
  assert.throws(() =>
    validate("create", {
      key: "OK",
      name: "One",
      kind: "internal",
      customerOrganizationId: "11111111-1111-4111-8111-111111111111",
    }),
  );
  assert.throws(() =>
    validate("create", {
      key: "OK",
      name: "One",
      kind: "internal",
      platformRole: "super_admin",
    }),
  );
  assert.doesNotThrow(() =>
    validate("create", { key: "OK", name: "One", kind: "internal" }),
  );
});
test("project mutations require versions and safe link schemes", () => {
  assert.throws(() => validate("task.update", { title: "X" }));
  for (const url of ["javascript:alert(1)", "https://user:pass@example.test/a"])
    assert.throws(() =>
      validate("deliverable.create", { version: 1, title: "X", url }),
    );
  assert.doesNotThrow(() =>
    validate("deliverable.create", {
      version: 1,
      title: "X",
      url: "https://example.test/release",
    }),
  );
});

test("Feedback 05 workspace requests enforce exact DTOs, scope and HTTPS resources", () => {
  const version=7;
  const milestoneId="33333333-3333-4333-8333-333333333333";
  const assigneeId="44444444-4444-4444-8444-444444444444";
  assert.deepEqual(validateWorkspace("checklist-add",{
    version,milestoneId,title:"Review frontend",assigneeId
  }),{version,milestoneId,title:"Review frontend",assigneeId});
  assert.doesNotThrow(()=>validateWorkspace("checklist-add",{
    version,milestoneId,title:"Check deployment",assigneeId:null
  }));
  assert.throws(()=>validateWorkspace("checklist-add",{
    version,milestoneId,title:"Bad",assigneeId:null,platformRole:"super_admin"
  }));
  assert.throws(()=>validateWorkspace("checklist-toggle",{
    version,itemId:milestoneId,completed:"true"
  }));
  assert.throws(()=>validateWorkspace("risk-add",{version,title:"Short",severity:"critical"}));
  assert.throws(()=>validateWorkspace("update-publish",{version,summary:"Brief",health:"on_track",nextSteps:"",shared:false}));
  assert.doesNotThrow(()=>validateWorkspace("update-publish",{
    version,summary:"Planning phase is finished",health:"on_track",nextSteps:"Kick off implementation",shared:false
  }));
  for(const url of ["javascript:alert(1)","http://example.test","https://user:pass@example.test/a"])
    assert.throws(()=>validateWorkspace("resource-add",{
      version,label:"Bad link",url,category:"document",shared:false
    }));
  assert.doesNotThrow(()=>validateWorkspace("resource-add",{
    version,label:"Project plan",url:"https://example.test/project",category:"document",shared:true
  }));
});
