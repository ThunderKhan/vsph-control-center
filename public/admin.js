const message = document.getElementById("globalMessage");
const tabButtons = [...document.querySelectorAll(".tab")];
const sections = [...document.querySelectorAll(".section")];
let lookups = { organizations: [], applications: [] };

function say(text, isError = false) {
  message.textContent = text;
  message.className = isError ? "message error" : "message";
}
async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) { window.location.href = "/login"; throw new Error("Please log in again."); }
  if (response.status === 403) { window.location.href = "/dashboard"; throw new Error("Super Admin access is required."); }
  if (!response.ok) throw new Error(data.message || "Request failed.");
  return data;
}
function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}
function table(headers, rows) {
  if (!rows.length) return "<p>No records found.</p>";
  return `<table><thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table>`;
}
function row(cells) { return `<tr>${cells.map(c => `<td>${c}</td>`).join("")}</tr>`; }
function selectOptions(items, valueKey = "id", labelKey = "name") {
  return items.map(item => `<option value="${esc(item[valueKey])}">${esc(item[labelKey])}</option>`).join("");
}
function showTab(name) {
  tabButtons.forEach(b => b.classList.toggle("active", b.dataset.tab === name));
  sections.forEach(s => s.hidden = s.id !== `section-${name}`);
  if (name === "overview") loadOverview();
  if (name === "organizations") loadOrganizations();
  if (name === "applications") loadApplications();
  if (name === "users") loadUsers();
  if (name === "subscriptions") loadSubscriptions();
  if (name === "access") loadAccess();
  if (name === "roles") loadRoles();
  if (name === "audit") loadAudit();
}
tabButtons.forEach(b => b.addEventListener("click", () => showTab(b.dataset.tab)));

async function loadOverview() {
  try {
    const d = await api("/api/admin-management/overview");
    document.getElementById("statOrganizations").textContent = d.organizations;
    document.getElementById("statUsers").textContent = d.users;
    document.getElementById("statApplications").textContent = d.applications;
    document.getElementById("statSubscriptions").textContent = d.activeSubscriptions;
    document.getElementById("statAccess").textContent = d.enabledAppAccess;
  } catch (e) { say(e.message, true); }
}
async function loadOrganizations() {
  try {
    const d = await api("/api/admin-management/organizations");
    document.getElementById("organizationsTable").innerHTML = table(
      ["ID", "Name", "Slug", "Members", "Status", "Action"],
      d.organizations.map(o => row([
        esc(o.id), esc(o.name), `<code>${esc(o.slug)}</code>`, esc(o.member_count), esc(o.status),
        `<button class="small" data-org-id="${esc(o.id)}" data-org-status="${o.status === "active" ? "suspended" : "active"}">${o.status === "active" ? "Suspend" : "Activate"}</button>`
      ]))
    );
    document.querySelectorAll("[data-org-id]").forEach(b => b.addEventListener("click", async () => {
      try {
        await api(`/api/admin-management/organizations/${b.dataset.orgId}/status`, {
          method: "PATCH", body: JSON.stringify({ status: b.dataset.orgStatus })
        });
        say("Organization status updated."); loadOrganizations();
      } catch (e) { say(e.message, true); }
    }));
  } catch (e) { say(e.message, true); }
}
async function loadApplications() {
  try {
    const d = await api("/api/admin-management/applications");
    document.getElementById("applicationsTable").innerHTML = table(
      ["Code", "Name", "Login path", "Status", "Action"],
      d.applications.map(a => row([
        `<code>${esc(a.code)}</code>`, esc(a.name), `<code>${esc(a.login_path)}</code>`, esc(a.status),
        `<button class="small" data-app-id="${esc(a.id)}">Edit</button>`
      ]))
    );
    document.querySelectorAll("[data-app-id]").forEach(button => button.addEventListener("click", async () => {
      const app = d.applications.find(item => String(item.id) === button.dataset.appId);
      if (!app) return;
      const name = window.prompt("Application display name", app.name);
      if (name === null) return;
      const loginPath = window.prompt("Application login path", app.login_path);
      if (loginPath === null) return;
      const status = window.prompt("Status: active, maintenance, or retired", app.status);
      if (status === null) return;
      try {
        await api(`/api/admin-management/applications/${app.id}`, {
          method: "PATCH", body: JSON.stringify({ name, loginPath, status })
        });
        say("Application updated."); loadApplications(); loadLookups();
      } catch (e) { say(e.message, true); }
    }));
  } catch (e) { say(e.message, true); }
}
async function loadUsers() {
  try {
    const d = await api("/api/admin-management/users");
    document.getElementById("usersTable").innerHTML = table(
      ["ID", "Name", "Email", "Role", "Organizations", "Status", "Action"],
      d.users.map(u => row([
        esc(u.id), esc(u.full_name), esc(u.email), esc(u.platform_role), esc(u.organizations || "—"), esc(u.status),
        `<button class="small" data-user-id="${esc(u.id)}" data-user-status="${u.status === "active" ? "disabled" : "active"}">${u.status === "active" ? "Disable" : "Activate"}</button>`
      ]))
    );
    document.querySelectorAll("[data-user-id]").forEach(b => b.addEventListener("click", async () => {
      try {
        await api(`/api/admin-management/users/${b.dataset.userId}/status`, {
          method: "PATCH", body: JSON.stringify({ status: b.dataset.userStatus })
        });
        say("User status updated."); loadUsers();
      } catch (e) { say(e.message, true); }
    }));
  } catch (e) { say(e.message, true); }
}
function syncMusicRoleOptions() {
  const appId=document.getElementById('roleApp').value;
  const isMusic=lookups.applications.some(app=>app.id===appId&&app.code==='MUSIC');
  const role=document.getElementById('roleValue');
  for(const option of role.querySelectorAll('option[data-music-only]')) {
    option.hidden=!isMusic;
    option.disabled=!isMusic;
  }
  if(!isMusic&&['staff','musician'].includes(role.value))role.value='user';
}
document.getElementById('roleApp').addEventListener('change',syncMusicRoleOptions);
async function loadLookups() {
  try {
    lookups = await api("/api/admin-management/lookups");
    const orgOpts = selectOptions(lookups.organizations);
    const appOpts = selectOptions(lookups.applications, "id", "name");
    ["subOrg", "accessOrg", "roleOrg"].forEach(id => document.getElementById(id).innerHTML = orgOpts);
    ["subApp", "accessApp", "roleApp"].forEach(id => document.getElementById(id).innerHTML = appOpts);
    syncMusicRoleOptions();
    document.getElementById("clientApplications").innerHTML = lookups.applications.map(app =>
      `<label><input type="checkbox" name="clientApplication" value="${esc(app.id)}"> ${esc(app.name)} (${esc(app.code)})</label>`
    ).join("");
  } catch (e) { say(e.message, true); }
}
async function loadSubscriptions() {
  try {
    const d = await api("/api/admin-management/subscriptions");
    document.getElementById("subscriptionsTable").innerHTML = table(
      ["Organization", "Application", "Plan", "Status", "Starts", "Ends"],
      d.subscriptions.map(s => row([
        esc(s.organization_name), esc(s.application_name), esc(s.plan_code), esc(s.status),
        esc(s.starts_at), esc(s.ends_at || "No end date")
      ]))
    );
  } catch (e) { say(e.message, true); }
}
async function loadAccess() {
  try {
    const d = await api("/api/admin-management/access");
    document.getElementById("accessTable").innerHTML = table(
      ["Organization", "Application", "Code", "Status", "Granted"],
      d.access.map(a => row([
        esc(a.organization_name), esc(a.application_name), esc(a.application_code), esc(a.status), esc(a.granted_at)
      ]))
    );
  } catch (e) { say(e.message, true); }
}
async function loadAudit() {
  try {
    const d = await api("/api/admin-management/audit-logs");
    document.getElementById("auditTable").innerHTML = table(
      ["When", "Actor", "Organization", "Action", "Target", "Details"],
      d.logs.map(l => row([
        esc(l.created_at), esc(l.actor_name || "System"), esc(l.organization_name || "—"),
        esc(l.action), `${esc(l.target_type || "—")} ${esc(l.target_id || "")}`,
        `<code>${esc(typeof l.details === "string" ? l.details : JSON.stringify(l.details || {}))}</code>`
      ]))
    );
  } catch (e) { say(e.message, true); }
}

document.getElementById("clientOrgName").addEventListener("input", e => {
  const slug = document.getElementById("clientSlug");
  if (!slug.dataset.edited) {
    slug.value = e.target.value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }
});
document.getElementById("clientSlug").addEventListener("input", e => { e.target.dataset.edited = "true"; });
document.getElementById("clientForm").addEventListener("submit", async e => {
  e.preventDefault();
  try {
    const endValue = document.getElementById("clientEnd").value;
    const applicationIds = [...document.querySelectorAll("[name=clientApplication]:checked")].map(input => input.value);
    await api("/api/admin-management/clients", {
      method: "POST", body: JSON.stringify({
        organizationName: document.getElementById("clientOrgName").value,
        slug: document.getElementById("clientSlug").value,
        adminName: document.getElementById("clientAdminName").value,
        adminEmail: document.getElementById("clientAdminEmail").value,
        temporaryPassword: document.getElementById("clientPassword").value,
        applicationIds,
        planCode: document.getElementById("clientPlan").value,
        endsAt: endValue ? new Date(endValue).toISOString() : null
      })
    });
    e.target.reset(); document.getElementById("clientPlan").value = "prototype";
    document.getElementById("clientSlug").dataset.edited = "";
    say("Client created with application access."); await loadLookups(); loadOrganizations(); loadOverview();
  } catch (err) { say(err.message, true); }
});
document.getElementById("applicationForm").addEventListener("submit", async e => {
  e.preventDefault();
  try {
    await api("/api/admin-management/applications", {
      method: "POST", body: JSON.stringify({
        code: document.getElementById("appCode").value,
        name: document.getElementById("appName").value,
        loginPath: document.getElementById("appPath").value,
        status: document.getElementById("appStatus").value
      })
    });
    e.target.reset(); say("Application added."); loadApplications(); loadLookups(); loadOverview();
  } catch (err) { say(err.message, true); }
});
document.getElementById("userForm").addEventListener("submit", async e => {
  e.preventDefault();
  try {
    await api("/api/admin-management/users", {
      method: "POST", body: JSON.stringify({
        fullName: document.getElementById("userName").value,
        email: document.getElementById("userEmail").value,
        password: document.getElementById("userPassword").value,
        platformRole: document.getElementById("userRole").value
      })
    });
    e.target.reset(); say("User created."); loadUsers(); loadOverview();
  } catch (err) { say(err.message, true); }
});
document.getElementById("subscriptionForm").addEventListener("submit", async e => {
  e.preventDefault();
  const endValue = document.getElementById("subEnd").value;
  try {
    await api("/api/admin-management/subscriptions", {
      method: "PUT", body: JSON.stringify({
        organizationId: document.getElementById("subOrg").value,
        applicationId: document.getElementById("subApp").value,
        planCode: document.getElementById("subPlan").value,
        status: document.getElementById("subStatus").value,
        endsAt: endValue ? new Date(endValue).toISOString() : null
      })
    });
    say("Subscription saved."); loadSubscriptions(); loadOverview();
  } catch (err) { say(err.message, true); }
});
document.getElementById("accessForm").addEventListener("submit", async e => {
  e.preventDefault();
  try {
    await api("/api/admin-management/access", {
      method: "PUT", body: JSON.stringify({
        organizationId: document.getElementById("accessOrg").value,
        applicationId: document.getElementById("accessApp").value,
        status: document.getElementById("accessStatus").value
      })
    });
    say("Application access saved."); loadAccess(); loadOverview();
  } catch (err) { say(err.message, true); }
});
document.getElementById("logoutButton").addEventListener("click", async () => {
  try { await fetch("/api/auth/logout", { method: "POST" }); }
  finally { window.location.href = "/login"; }
});

(async function init() {
  try {
    const response = await fetch("/api/auth/me");
    if (!response.ok) { window.location.href = "/login"; return; }
    const { user } = await response.json();
    if (user.platformRole !== "super_admin") { window.location.href = "/dashboard"; return; }
    await loadLookups();
    await loadOverview();
  } catch (e) { say(e.message, true); }
})();

async function loadRoles(){
 try{const d=await api('/api/admin-management/roles');document.getElementById('rolesTable').innerHTML=table(
 ['User','Organization','Product','Assigned role'],d.roles.map(x=>row([esc(x.email),esc(x.organization_name),esc(x.application_code),esc(x.role_code)])));
 }catch(e){say(e.message,true)}
}
document.getElementById('roleForm').addEventListener('submit',async e=>{
 e.preventDefault();try{
  await api('/api/admin-management/roles',{method:'PUT',body:JSON.stringify({email:document.getElementById('roleEmail').value,
   organizationId:document.getElementById('roleOrg').value,applicationId:document.getElementById('roleApp').value,role:document.getElementById('roleValue').value})});
  say('Application role assigned.');loadRoles();
 }catch(err){say(err.message,true)}
});
