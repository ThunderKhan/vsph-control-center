(() => {
  "use strict";
  const $ = (id) => document.getElementById(id),
    node = (tag, text, cls) => {
      const e = document.createElement(tag);
      if (text !== undefined) e.textContent = String(text);
      if (cls) e.className = cls;
      return e;
    };
  let projectId = location.pathname.split("/")[2] || null;
  let user,
    detail,
    directory = {},
    workforce = {staff:[],canGovernManagers:false,canAssign:false},
    workforceError = "",
    items = [],
    cursor = null,
    taskFilter = "";
  const states = [
      "todo",
      "in_progress",
      "blocked",
      "in_review",
      "done",
      "cancelled",
    ],
    priorities = ["low", "normal", "high", "urgent"];
  const setMessage = (m) => {
    $("projectMessage").textContent = m || "";
  };
  async function api(path, options = {}) {
    const r = await fetch(path, {
      credentials: "same-origin",
      cache: "no-store",
      ...options,
      headers: { "Content-Type": "application/json", ...options.headers },
    });
    const d = await r.json().catch(() => ({}));
    if (r.status === 401) {
      location.assign("/login");
      throw Error("Sign in again.");
    }
    if (!r.ok)
      throw Error(
        r.status === 409
          ? "Another change was saved first. Refresh, review the latest data and try again."
          : d.message || "Request failed.",
      );
    return d;
  }
  const button = (text, fn) => {
    const b = node("button", text);
    b.type = "button";
    b.onclick = fn;
    return b;
  };
  function field(form, label, name, type = "text", values = [], value = "") {
    const l = node("label", label);
    let e;
    if (type === "select" || type === "multiple") {
      e = node("select");
      if (type === "multiple") e.multiple = true;
      for (const v of values) {
        const o = node("option", typeof v === "string" ? v : v.label);
        o.value = typeof v === "string" ? v : v.value;
        e.append(o);
      }
    } else e = node(type === "textarea" ? "textarea" : "input");
    e.name = name;
    e.setAttribute("aria-label", label);
    if (e.tagName === "INPUT") e.type = type;
    if (type === "checkbox") e.checked = Boolean(value);
    else if (type === "multiple") {
      for (const o of e.options) o.selected = (value || []).includes(o.value);
    } else e.value = value ?? "";
    if (["name", "title", "body", "key", "url", "email"].includes(name))
      e.required = true;
    const max = {
      name: 150,
      title: 200,
      body: 4000,
      description: 5000,
      key: 20,
      url: 2000,
      team: 100,
    };
    if (max[name]) e.maxLength = max[name];
    l.append(e);
    form.append(l);
    return e;
  }
  function values(form) {
    const d = {};
    for (const e of form.elements) {
      if (!e.name) continue;
      d[e.name] =
        e.type === "checkbox"
          ? e.checked
          : e.multiple
            ? [...e.selectedOptions].map((o) => o.value)
            : e.value;
    }
    return d;
  }
  function saveForm(form, label, handler) {
    const b = node("button", label);
    b.type = "submit";
    form.append(b);
    form.onsubmit = async (e) => {
      e.preventDefault();
      b.disabled = true;
      setMessage("");
      try {
        await handler(values(form));
      } catch (err) {
        setMessage(err.message);
      } finally {
        b.disabled = false;
      }
    };
  }
  const opts = (rows, key = "id", name = "name", empty = true) => [
    ...(empty ? [{ value: "", label: "Not set" }] : []),
    ...(rows || []).map((x) => ({ value: x[key], label: x[name] || x[key] })),
  ];
  function table(headers, rows) {
    const t = node("table"),
      head = node("thead"),
      tr = node("tr");
    for (const h of headers) tr.append(node("th", h));
    head.append(tr);
    const body = node("tbody");
    for (const cols of rows) {
      const row = node("tr");
      for (const col of cols) {
        const cell = node("td");
        cell.append(col instanceof Node ? col : node("span", col ?? "—"));
        row.append(cell);
      }
      body.append(row);
    }
    t.append(head, body);
    return t;
  }
  function titleLink(p) {
    const a = node("a", p.name);
    a.href = "/projects/" + encodeURIComponent(p.key);
    const box = node("div");
    box.append(a, node("small", p.key));
    return box;
  }
  async function loadList(append = false) {
    $("projectList").setAttribute("aria-busy", "true");
    const filter = values($("projectFilters"));
    const qs = new URLSearchParams({
      ...filter,
      ...(append && cursor ? { cursor } : {}),
    });
    try {
      const r = await api("/api/projects?" + qs);
      items = append ? items.concat(r.projects) : r.projects;
      cursor = r.projects.at(-1)?.id || null;
      $("newProject").hidden = !r.canCreate;
      $("moreProjects").hidden = r.projects.length < 50;
      const box = $("projectList");
      box.replaceChildren();
      if (!items.length)
        box.append(node("p", "No projects match these filters."));
      else
        box.append(
          table(
            ["Project", "Ownership", "State", "Priority", "Progress", "Due"],
            items.map((p) => [
              titleLink(p),
              p.kind,
              p.status,
              p.priority,
              p.completed_tasks + " / " + p.total_tasks + " tasks",
              p.due_on || "—",
            ]),
          ),
        );
    } finally {
      $("projectList").setAttribute("aria-busy", "false");
    }
  }
  async function getDirectory(email) {
    const q = new URLSearchParams({
      ...(projectId ? { projectId } : {}),
      ...(email ? { email } : {}),
    });
    directory = await api("/api/projects/directory?" + q);
    return directory;
  }
  function projectFields(form, p = {}) {
    field(form, "Project name", "name", "text", [], p.name);
    field(form, "Description", "description", "textarea", [], p.description);
    field(
      form,
      "Priority",
      "priority",
      "select",
      priorities,
      p.priority || "normal",
    );
    field(form, "Due date", "dueOn", "date", [], p.due_on);
    field(
      form,
      "Products linked to this work",
      "products",
      "multiple",
      opts(directory.products, "id", "name", false),
      detail?.products.map((x) => x.id) || [],
    );
    field(
      form,
      "Share project with explicitly assigned customer viewers",
      "clientVisible",
      "checkbox",
      [],
      p.client_visible,
    );
  }

  function setupProjectWizard(form) {
    const names = [
      ["key", "name", "description", "priority", "startsOn", "dueOn"],
      ["kind", "customerOrganizationId", "products", "clientVisible"],
      [],
    ];
    const titles = ["Project details", "Organization and applications", "Review and create"];
    const controls = Object.fromEntries(
      [...form.querySelectorAll("label")].map((label) => [
        label.querySelector("[name]")?.name,
        label,
      ]),
    );
    const submit = form.querySelector('button[type="submit"]');
    if (!submit || names.flat().some((name) => !controls[name]))
      return; // Keep the working form if a future schema introduces new fields.
    const stages = titles.map((title, index) => {
      const stage = node("fieldset");
      stage.className = "project-create-step";
      const legend = node("legend", title);
      legend.tabIndex = -1;
      stage.append(legend);
      if (index === 1) {
        stage.append(node("p", "Choose the customer organization for client work. Linked catalog products describe delivery; they do not grant subscriptions or product logins.", "project-step-hint"));
      }
      if (index === 2) {
        stage.append(node("p", "Creating a project assigns you as the initial accountable manager. Add employees, a second manager and tasks from the project workspace afterward.", "project-step-hint"));
      }
      for (const name of names[index]) stage.append(controls[name]);
      return stage;
    });
    const progress = node("p", "Step 1 of 3 · Project details", "project-create-progress");
    progress.setAttribute("role", "status");
    progress.setAttribute("aria-live", "polite");
    const review = node("dl");
    review.className = "project-create-review";
    stages[2].append(review);
    const actions = node("div");
    actions.className = "project-create-actions";
    const back = button("Previous", () => show(step - 1, true));
    const next = button("Continue", () => {
      if (validateStep()) show(step + 1, true);
    });
    const cancel = button("Cancel", () => {
      $("creation").hidden = true;
      form.reset();
      $("newProject").focus();
    });
    actions.append(cancel, back, next, submit);
    form.replaceChildren(progress, ...stages, actions);
    const kind = form.elements.kind;
    const customer = form.elements.customerOrganizationId;
    const customerLabel = controls.customerOrganizationId;
    const key = form.elements.key;
    key.pattern = "[A-Z][A-Z0-9-]{1,19}";
    key.title = "Use 2–20 uppercase letters, digits or hyphens; start with a letter.";
    key.addEventListener("input", () => {
      key.value = key.value.toUpperCase().replace(/[^A-Z0-9-]/g, "");
    });
    const updateKind = () => {
      const isCustomer = kind.value === "customer";
      customerLabel.hidden = !isCustomer;
      customer.required = isCustomer;
      if (!isCustomer) customer.value = "";
    };
    kind.addEventListener("change", updateKind);
    updateKind();
    let step = 0;
    function validateStep() {
      for (const field of stages[step].querySelectorAll("input,select,textarea")) {
        if (field.closest("[hidden]") || field.checkValidity()) continue;
        field.reportValidity();
        field.focus();
        return false;
      }
      return true;
    }
    function updateReview() {
      review.replaceChildren();
      const data = values(form);
      for (const [name, label] of [
        ["name", "Project"], ["key", "Key"], ["kind", "Ownership"],
        ["customerOrganizationId", "Customer organization"],
        ["priority", "Priority"], ["dueOn", "Due date"],
        ["products", "Linked products"],
      ]) {
        if (name === "customerOrganizationId" && data.kind !== "customer") continue;
        const dt = node("dt", label);
        let value = data[name];
        if (name === "customerOrganizationId") {
          value = customer.selectedOptions[0]?.textContent || "Not selected";
        } else if (name === "products") {
          value = [...form.elements.products.selectedOptions]
            .map((option) => option.textContent).join(", ") || "None";
        }
        review.append(dt, node("dd", value || "Not set"));
      }
    }
    function show(nextStep, focus = false) {
      step = Math.max(0, Math.min(2, nextStep));
      if (step === 2) updateReview();
      for (const [index, stage] of stages.entries()) stage.hidden = index !== step;
      progress.textContent = "Step " + (step + 1) + " of 3 · " + titles[step];
      back.hidden = step === 0;
      next.hidden = step === 2;
      submit.hidden = step !== 2;
      if (focus) stages[step].querySelector("legend").focus();
    }
    form.addEventListener("submit", (event) => {
      if (step === 2) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (validateStep()) show(step + 1, true);
    }, true);
    show(0);
  }
  async function createForm() {
    await getDirectory();
    const form = $("createProjectForm");
    form.replaceChildren();
    field(form, "Project key (uppercase)", "key");
    projectFields(form);
    field(
      form,
      "Project ownership",
      "kind",
      "select",
      ["internal", "customer"],
      "internal",
    );
    field(
      form,
      "Customer organization (customer projects only)",
      "customerOrganizationId",
      "select",
      opts(directory.organizations),
    );
    field(form, "Start date", "startsOn", "date");
    // Navigation may preselect only an authorized organization returned by the server.
    const requestedOrganization = new URLSearchParams(location.search).get("organizationId");
    const authorizedOrganization = (directory.organizations || []).find(
      (organization) => organization.id === requestedOrganization
    );
    if (authorizedOrganization) {
      form.elements.kind.value = "customer";
      form.elements.customerOrganizationId.value = authorizedOrganization.id;
    }
    saveForm(form, "Create project", async (d) => {
      const p = await api("/api/projects", {
        method: "POST",
        body: JSON.stringify(d),
      });
      location.assign("/projects/" + encodeURIComponent(p.key) + "?view=team");
    });
    setupProjectWizard(form);
    $("creation").hidden = false;
    form.elements.key.focus();
  }
  async function mutate(path, method, data) {
    const container = $("projectDetail"),
      controls = [
        ...container.querySelectorAll("input,select,textarea,button"),
      ].map((control) => [control, control.disabled]);
    container.setAttribute("aria-busy", "true");
    for (const [control] of controls) control.disabled = true;
    setMessage("");
    try {
      await api("/api/projects/" + projectId + path, {
        method,
        body: JSON.stringify({ ...data, version: detail.project.version }),
      });
      await loadDetail();
      setMessage("Saved.");
    } finally {
      for (const [control, disabled] of controls)
        if (control.isConnected) control.disabled = disabled;
      container.setAttribute("aria-busy", "false");
    }
  }
  const taskNames = () => opts(detail.tasks, "id", "title");
  function renderTaskForm(task) {
    const f = $("taskForm");
    f.replaceChildren();
    field(f, "Task title", "title", "text", [], task?.title);
    field(f, "Description", "description", "textarea", [], task?.description);
    field(
      f,
      "Assignee",
      "assigneeId",
      "select",
      opts(
        detail.members.filter(
          (m) =>
            m.status === "active" &&
            ["manager", "contributor"].includes(m.role),
        ),
        "user_id",
        "full_name",
      ),
      task?.assignee_id,
    );
    field(
      f,
      "Milestone",
      "milestoneId",
      "select",
      opts(detail.milestones, "id", "title"),
      task?.milestone_id,
    );
    field(
      f,
      "Priority",
      "priority",
      "select",
      priorities,
      task?.priority || "normal",
    );
    field(f, "Due date", "dueOn", "date", [], task?.due_on);
    field(
      f,
      "Shared with customer viewers",
      "shared",
      "checkbox",
      [],
      task?.shared,
    );
    saveForm(f, task ? "Save task" : "Create task", (d) =>
      mutate(task ? "/tasks/" + task.id : "/tasks", task ? "PATCH" : "POST", d),
    );
    if (task) {
      $("taskEditor").open = true;
      f.elements.title.focus();
    }
  }
  function renderTasks() {
    const box = $("taskList");
    box.replaceChildren();
    const manager = detail.role === "manager";
    const filter = $("taskFilters");
    filter.replaceChildren();
    const select = node("select");
    select.setAttribute("aria-label", "Filter tasks by status");
    for (const s of ["", ...states]) {
      const o = node("option", s || "All task states");
      o.value = s;
      select.append(o);
    }
    select.value = taskFilter;
    select.onchange = () => {
      taskFilter = select.value;
      renderTasks();
    };
    filter.append(select);
    const rows = detail.tasks
      .filter((t) => !taskFilter || t.status === taskFilter)
      .map((t) => {
        const controls = node("div");
        const editable =
          manager ||
          (detail.role === "contributor" && t.assignee_id === user.id);
        if (editable && detail.project.status !== "archived") {
          const next = {
            todo: ["in_progress", "cancelled"],
            in_progress: ["todo", "blocked", "in_review"],
            blocked: ["todo", "in_progress", "cancelled"],
            in_review: ["in_progress", "done"],
            done: manager ? ["todo"] : [],
            cancelled: manager ? ["todo"] : [],
          }[t.status];
          const state = node("select");
          state.setAttribute("aria-label", "Status for " + t.title);
          for (const v of [t.status, ...next]) {
            const o = node("option", v);
            o.value = v;
            state.append(o);
          }
          state.onchange = async () => {
            try {
              await mutate("/tasks/" + t.id, "PATCH", { status: state.value });
            } catch (e) {
              setMessage(e.message);
              state.value = t.status;
            }
          };
          controls.append(state);
          if (manager) controls.append(button("Edit", () => renderTaskForm(t)));
        } else controls.append(node("span", t.status));
        return [
          t.title,
          detail.members.find((m) => m.user_id === t.assignee_id)?.full_name ||
            "Unassigned",
          t.priority,
          t.due_on || "—",
          controls,
        ];
      });
    box.append(
      table(["Task", "Assignee", "Priority", "Due", "State / actions"], rows),
    );
    if (!rows.length) box.append(node("p", "No tasks in this view."));
    const canManage = manager && detail.project.status !== "archived";
    $("taskEditor").hidden = !canManage;
    $("newProjectTask").hidden = !canManage;
    if (canManage) {
      renderTaskForm();
      $("newProjectTask").onclick = () => {
        renderTaskForm();
        $("taskEditor").open = true;
        $("taskForm").elements.title.focus();
      };
    }
  }
  function renderMilestoneForm(m) {
    const f = $("milestoneForm");
    f.replaceChildren();
    field(f, "Milestone title", "title", "text", [], m?.title);
    field(f, "Due date", "dueOn", "date", [], m?.due_on);
    field(
      f,
      "Shared with customer viewers",
      "shared",
      "checkbox",
      [],
      m?.shared,
    );
    if (m) {
      field(
        f,
        "Milestone state",
        "status",
        "select",
        ["planned", "active", "done", "cancelled"],
        m.status,
      );
      field(
        f,
        "Depends on",
        "dependsOn",
        "select",
        opts(
          detail.milestones.filter((x) => x.id !== m.id),
          "id",
          "title",
        ),
        m.depends_on,
      );
    }
    saveForm(f, m ? "Save milestone" : "Create milestone", (d) =>
      mutate(
        m ? "/milestones/" + m.id : "/milestones",
        m ? "PATCH" : "POST",
        d,
      ),
    );
    if (m) {
      $("milestoneEditor").open = true;
      f.elements.title.focus();
    }
  }
  function renderMilestones() {
    const box = $("milestoneList");
    box.replaceChildren();
    for (const m of detail.milestones) {
      const a = node("article");
      const tasks = detail.tasks.filter(
        (t) => t.milestone_id === m.id && t.status !== "cancelled",
      );
      a.append(
        node("h3", m.title),
        node(
          "p",
          m.status +
            " · " +
            (m.due_on || "No target date") +
            " · " +
            tasks.filter((t) => t.status === "done").length +
            "/" +
            tasks.length +
            " tasks complete",
        ),
      );
      if (detail.role === "manager" && detail.project.status !== "archived")
        a.append(button("Edit milestone", () => renderMilestoneForm(m)));
      box.append(a);
    }
    if (!detail.milestones.length) box.textContent = "No milestones yet.";
    $("milestoneEditor").hidden =
      detail.role !== "manager" || detail.project.status === "archived";
    if (detail.role === "manager") renderMilestoneForm();
  }
  function renderTeam(){
    const members=detail.members||[],owner=user.platformRole==="super_admin";
    $("teamList").replaceChildren(table(["Person","Project role","Team","Access"],
      members.map(m=>[m.full_name,m.role,m.team||"—",m.status])));
    const manager=detail.role==="manager"&&!["completed","archived"].includes(detail.project.status);
    $("teamEditor").hidden=!manager;$("addProjectMember").hidden=!manager;
    if(!manager)return;
    const staff=workforce.staff||[],info=$("workforceSummary"),roster=$("workforceRoster");
    info.replaceChildren(node("p",workforceError || (staff.length
      ? staff.length+" active employees have accepted, linked portal identities."
      : "No eligible employee identities. Finish employee account setup before assignment.")));
    roster.replaceChildren();
    if(staff.length)roster.append(table(["Employee","Department","Project role","Open tasks","Actions"],staff.map(e=>{
      const controls=node("div",undefined,"workforce-actions"),assigned=e.membership_status==="active";
      const isProjectOwner=e.user_id===detail.project.owner_id;
      if(assigned){
        if(e.project_role==="manager"){
          if(owner&&!isProjectOwner)controls.append(button("Revoke manager",()=>changeWorkforce("manager-revoke",e)));
        }else{
          if(owner)controls.append(button("Appoint manager",()=>changeWorkforce("manager-grant",e)));
          if(!Number(e.open_tasks))controls.append(button("Remove",()=>changeWorkforce("remove",e)));
        }
      }
      const who=node("div",e.full_name);who.append(node("small",e.job_title));
      return [who,e.department,assigned?e.project_role:"Not assigned",e.open_tasks||0,controls];
    })));
    const f=$("memberForm");f.replaceChildren();
    if(!staff.length){$("addProjectMember").hidden=true;$("teamEditor").hidden=true;return;}
    const employee=field(f,"Employee","userId","select",
      staff.map(e=>({value:e.user_id,label:e.full_name+" · "+e.department+(e.membership_status==="active"?" · "+e.project_role:"")})));
    const roles=field(f,"Project role","role","select",
      owner?["contributor","viewer","manager"]:["contributor","viewer"],"contributor");
    field(f,"Team","team");
    f.append(node("p","Only active internal employees with accepted accounts can be assigned. Project roles do not grant HR or product permissions.","project-section-hint"));
    employee.onchange=()=>{
      const e=staff.find(v=>v.user_id===employee.value);if(!e)return;
      roles.value=owner&&e.project_role==="manager"?"manager":e.project_role==="viewer"?"viewer":"contributor";
      f.elements.team.value=e.team||"";
    };
    employee.onchange();
    saveForm(f,"Save project assignment",d=>changeWorkforce("assign",{user_id:d.userId,full_name:staff.find(e=>e.user_id===d.userId)?.full_name}, {role:d.role,team:d.team}));
    $("addProjectMember").onclick=()=>{$("teamEditor").open=true;employee.focus();};
  }
  async function changeWorkforce(action,employee,extra={}){
    const captions={"manager-grant":"Appoint as project manager","manager-revoke":"Revoke project manager authority","remove":"Remove from this project","assign":"Save employee assignment"};
    if(!window.confirm(captions[action]+" for "+(employee.full_name||"employee")+"?"))return;
    try{
      setMessage("");
      await api("/api/projects/"+projectId+"/workforce/"+action,{method:"POST",
        body:JSON.stringify({version:detail.project.version,userId:employee.user_id,...(action==="assign"?extra:{})})});
      await loadDetail();setMessage("Project role updated and audited.");
    }catch(error){setMessage(error.message);}
  }

  function renderDelivery() {
    const manager =
        detail.role === "manager" && detail.project.status !== "archived",
      writer =
        ["manager", "contributor"].includes(detail.role) &&
        detail.project.status !== "archived";
    const d = $("deliverableList");
    d.replaceChildren();
    for (const item of detail.deliverables) {
      const a = node("a", item.title);
      a.href = item.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      const p = node("p");
      p.append(a);
      d.append(p);
    }
    const f = $("deliverableForm");
    f.hidden = !manager;
    f.replaceChildren();
    if (manager) {
      field(f, "Deliverable title", "title");
      field(f, "HTTPS evidence link", "url", "url");
      field(f, "Related task", "taskId", "select", taskNames());
      field(f, "Shared with customer viewers", "shared", "checkbox");
      saveForm(f, "Add deliverable", (data) =>
        mutate("/deliverables", "POST", data),
      );
    }
    const c = $("commentList");
    c.replaceChildren();
    for (const item of detail.comments) {
      const a = node("article");
      a.append(
        node(
          "strong",
          detail.members.find((m) => m.user_id === item.actor_id)?.full_name ||
            "Project member",
        ),
        node("p", item.body),
        node("small", new Date(item.created_at).toLocaleString()),
      );
      c.append(a);
    }
    const cf = $("commentForm");
    cf.hidden = !writer;
    cf.replaceChildren();
    if (writer) {
      field(cf, "Comment", "body", "textarea");
      field(cf, "Related task", "taskId", "select", taskNames());
      if (manager)
        field(cf, "Shared with customer viewers", "shared", "checkbox");
      saveForm(cf, "Add comment", (data) => mutate("/comments", "POST", data));
    }
  }

  const appStatus = () => $("customApplicationStatus");
  const customApiPath = () => "/api/projects/" + projectId + "/applications";
  let customRows = [], customCanManage = false, editingAppId = null, savingApp = false;
  function customAppFields(entry) {
    const f = $("customApplicationForm");
    f.reset();
    f.elements.name.value = entry?.name || "";
    f.elements.description.value = entry?.description || "";
    f.elements.status.value = entry?.status || "planned";
    f.elements.repositoryUrl.value = entry?.repository_url || "";
    f.elements.deploymentUrl.value = entry?.deployment_url || "";
    f.elements.shared.checked = entry?.shared === true;
  }
  function closeCustomAppForm() {
    editingAppId = null;
    $("customApplicationEditor").hidden = true;
  }
  function openCustomAppForm(entry = null) {
    if (!customCanManage || savingApp) return;
    editingAppId = entry?.id || null;
    customAppFields(entry);
    $("customApplicationEditorTitle").textContent = entry ? "Edit custom application" : "Create custom application";
    $("customApplicationEditor").hidden = false;
    $("customApplicationForm").elements.name.focus();
  }
  function safeAppLink(raw, label) {
    try {
      const url = new URL(raw);
      if (url.protocol !== "https:" || url.username || url.password) return null;
      const a = node("a", label);
      a.href = url.href;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      return a;
    } catch {
      return null;
    }
  }
  function renderCustomApps() {
    const linked = $("linkedProductsList");
    linked.replaceChildren();
    const linkedProducts = detail?.products || [];
    for (const product of linkedProducts) {
      const card = node("article", undefined, "project-app-card");
      card.append(node("span", "Catalog product", "project-app-type"),
        node("h4", product.name));
      linked.append(card);
    }
    if (!linkedProducts.length) linked.append(node("p", "No reusable products are linked to this project.", "project-section-hint"));

    const list = $("customApplicationList");
    list.replaceChildren();
    for (const entry of customRows) {
      const card = node("article", undefined, "project-app-card");
      const heading = node("div", undefined, "project-app-card-title");
      heading.append(node("h4", entry.name),node("span", entry.status.replaceAll("_"," "), "project-app-state"));
      card.append(node("span", "Custom application", "project-app-type"),heading);
      if (entry.description) card.append(node("p", entry.description, "project-app-description"));
      const links = node("div", undefined, "project-app-links");
      for (const [url, label] of [[entry.repository_url,"Repository"],[entry.deployment_url,"Deployment"]]) {
        if (!url) continue;
        const link = safeAppLink(url,label);
        if (link) links.append(link);
      }
      if (links.childElementCount) card.append(links);
      card.append(node("span", entry.shared ? "Shared with authorized client viewers" : "Private to project team", "project-app-visibility"));
      if (customCanManage) card.append(button("Edit application", () => openCustomAppForm(entry)));
      list.append(card);
    }
    if (!customRows.length) list.append(node("p", "No custom applications have been registered for this project.", "project-section-hint"));
    $("newCustomApplication").hidden = !customCanManage;
    if (!customCanManage) closeCustomAppForm();
  }
  async function loadCustomApps() {
    appStatus().textContent = "Loading application records…";
    customRows = [];
    customCanManage = false;
    $("newCustomApplication").hidden = true;
    try {
      const data = await api(customApiPath());
      customRows = data.applications || [];
      customCanManage = data.canManage === true;
      appStatus().textContent = customRows.length + " custom application" + (customRows.length === 1 ? "" : "s") + " registered.";
    } catch (error) {
      appStatus().textContent = "Custom applications unavailable: " + error.message + " Database installation may be required.";
    }
    renderCustomApps();
  }
  async function submitCustomApp(event) {
    event.preventDefault();
    if (savingApp || !customCanManage || !$("customApplicationForm").reportValidity()) return;
    const form = $("customApplicationForm");
    const payload = {
      name: form.elements.name.value.trim(),
      description: form.elements.description.value,
      status: form.elements.status.value,
      repositoryUrl: form.elements.repositoryUrl.value.trim(),
      deploymentUrl: form.elements.deploymentUrl.value.trim(),
      shared: form.elements.shared.checked
    };
    const old = editingAppId ? customRows.find(a => a.id === editingAppId) : null;
    if (editingAppId && !old) {
      appStatus().textContent = "Application changed. Refresh and review.";
      return;
    }
    if (old) payload.version = old.version;
    savingApp = true;
    const save = $("saveCustomApplication");
    save.disabled = true;
    appStatus().textContent = "Saving application…";
    try {
      await api(old ? customApiPath() + "/" + old.id : customApiPath(), {
        method: old ? "PATCH" : "POST",
        body: JSON.stringify(payload)
      });
      closeCustomAppForm();
      await loadCustomApps();
      appStatus().textContent = "Application saved with its project-scoped audit history.";
    } catch (error) {
      appStatus().textContent = error.message;
    } finally {
      savingApp = false;
      save.disabled = false;
    }
  }
  async function loadDetail() {
    const container = $("projectDetail"),
      controls = [
        ...container.querySelectorAll("input,select,textarea,button"),
      ].map((control) => [control, control.disabled]);
    container.setAttribute("aria-busy", "true");
    for (const [control] of controls) control.disabled = true;
    try {
      detail = await api(/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(projectId)
        ? "/api/projects/" + projectId
        : "/api/projects/by-key/" + encodeURIComponent(projectId));
      const p = detail.project;
      projectId = p.id;
      $("portfolio").hidden = true;
      $("creation").hidden = true;
      $("newProject").hidden = true;
      $("projectDetail").hidden = false;
      $("projectTitle").textContent = p.name;
      $("projectSubtitle").textContent =
        p.key + " · " + p.kind + " · " + p.status + " · Owner: " +
        (detail.members.find((m) => m.user_id === p.owner_id)?.full_name || "Project owner");
      const tasks = detail.tasks.filter((t) => t.status !== "cancelled"),
        done = tasks.filter((t) => t.status === "done").length,
        today = new Date().toISOString().slice(0, 10),
        overdue =
          tasks.filter(
            (t) => t.due_on && t.due_on < today && t.status !== "done",
          ).length +
          detail.milestones.filter(
            (m) =>
              m.due_on &&
              m.due_on < today &&
              !["done", "cancelled"].includes(m.status),
          ).length;
      const box = $("projectSummary");
      box.replaceChildren();
      for (const [label, value] of [
        [
          "Task completion",
          tasks.length
            ? Math.round((done / tasks.length) * 100) + "%"
            : "No tasks",
        ],
        ["Completed / total", done + " / " + tasks.length],
        ["Overdue work", overdue],
        [
          "Health",
          overdue || tasks.some((t) => t.status === "blocked")
            ? "Needs attention"
            : !tasks.length && !detail.milestones.length ? "Not started" : "No blocked or overdue work",
        ],
      ]) {
        const c = node("div", label);
        c.append(node("strong", value));
        box.append(c);
      }
      if (detail.role === "manager") {
        await getDirectory();
        try {
          workforce=await api("/api/projects/"+projectId+"/workforce");
          workforceError="";
        } catch (error) {
          workforce={staff:[],canGovernManagers:false,canAssign:false};
          workforceError="Employee assignments unavailable: "+error.message+" Check the project workforce database migration.";
        }
        const f = $("projectSettings");
        f.replaceChildren();
        projectFields(f, p);
        field(
          f,
          "Lifecycle",
          "status",
          "select",
          ["planned", "active", "paused", "completed", "archived"],
          p.status,
        );
        if(user.platformRole==="super_admin")field(
          f,
          "Accountable owner",
          "ownerId",
          "select",
          opts(
            detail.members.filter(
              (m) => m.status === "active" && m.role === "manager",
            ),
            "user_id",
            "full_name",
            false,
          ),
          p.owner_id,
        );
        saveForm(f, "Save project settings", (d) => mutate("", "PATCH", d));
      }
      $("settings").hidden = detail.role !== "manager";
      renderTasks();
      renderMilestones();
      renderTeam();
      renderDelivery();
      await loadCustomApps();
      document.dispatchEvent(
        new CustomEvent("vsph:project-loaded", {
          detail: { project: detail, user },
        }),
      );
      const activity = $("activityList");
      activity.replaceChildren();
      const labels = {
        "project.created": "Project created",
        update: "Project updated",
        "member.save": "Project membership changed",
        "task.create": "Task created",
        "task.update": "Task updated",
        "milestone.create": "Milestone created",
        "milestone.update": "Milestone updated",
        "comment.create": "Comment added",
        "deliverable.create": "Deliverable added",
      };
      for (const event of detail.activity) {
        const actor =
          detail.members.find((m) => m.user_id === event.actor_id)?.full_name ||
          "Project member";
        const text =
          new Date(event.created_at).toLocaleString() +
          " · " +
          actor +
          " · " +
          (labels[event.action] || "Project activity") +
          (event.summary === event.action ? "" : " · " + event.summary);
        const li = node("li", text);
        li.dataset.action = event.action;
        activity.append(li);
      }
    } finally {
      for (const [control, disabled] of controls)
        if (control.isConnected) control.disabled = disabled;
      container.setAttribute("aria-busy", "false");
    }
  }
  document.addEventListener("vsph:workspace-mutated", () => {
    if (projectId) loadDetail().catch(e => setMessage(e.message));
  });
  $("newCustomApplication").onclick = () => openCustomAppForm();
  $("cancelCustomApplication").onclick = () => {
    closeCustomAppForm();
    $("newCustomApplication").focus();
  };
  $("customApplicationForm").addEventListener("submit", submitCustomApp);
  $("newProject").onclick = () =>
    createForm().catch((e) => setMessage(e.message));
  $("reloadProjects").onclick = () => {
    setMessage("");
    (projectId ? loadDetail() : loadList()).catch((e) => setMessage(e.message));
  };
  $("projectFilters").onsubmit = (e) => {
    e.preventDefault();
    loadList().catch((e) => setMessage(e.message));
  };
  $("moreProjects").onclick = () =>
    loadList(true).catch((e) => setMessage(e.message));
  (async () => {
    try {
      user = (await api("/api/auth/me")).user;
      for (const id of ["sideName", "topAccount"])
        $(id).textContent = user.name;
      $("sideRole").textContent =
        user.platformRole === "super_admin"
          ? "Platform administrator"
          : "Project member";
      $("avatar").textContent = user.name.slice(0, 1).toUpperCase();
      $("topbarOnboard").hidden = user.platformRole !== "super_admin";
      document.dispatchEvent(
        new CustomEvent("vsph:identity-loaded", { detail: user }),
      );
      if (projectId) await loadDetail();
      else await loadList();
    } catch (e) {
      setMessage(e.message);
    }
  })();
})();
