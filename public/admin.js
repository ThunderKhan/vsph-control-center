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
  if (name === "permissions") loadWorkforceRoles();
  if (name === "audit") selectAuditView(auditView);
}
tabButtons.forEach(b => b.addEventListener("click", () => showTab(b.dataset.tab)));
const flash=(value)=>{say(value);VSPHUI.toast(value);};

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
        esc(o.id), `<a href="/admin/customers?organization=${esc(o.id)}">${esc(o.name)}</a>`, `<code>${esc(o.slug)}</code>`, esc(o.member_count), esc(o.status),
        `<button class="small" data-org-id="${esc(o.id)}" data-org-version="${o.version}" data-org-status="${o.status === "active" ? "suspended" : "active"}">${o.status === "active" ? "Suspend" : "Activate"}</button>`
      ]))
    );
    document.querySelectorAll("[data-org-id]").forEach(b => b.addEventListener("click", async () => {
      try {
        if(!await VSPHUI.confirm("Suspension revokes product sessions, codes and pending invitations; reactivation does not restore them.",{title:"Change organization status?",confirmLabel:"Confirm change",danger:b.dataset.orgStatus!=="active"}))return;
        await api(`/api/admin-management/organizations/${b.dataset.orgId}/status`, {
          method: "PATCH", body: JSON.stringify({ status: b.dataset.orgStatus,version:Number(b.dataset.orgVersion),confirmed:true })
        });
        await loadLookups();flash("Organization status updated."); loadOrganizations();
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
        `<a href="/admin/products?product=${esc(a.id)}">Edit in product registry</a>`
      ]))
    );

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
        if(!await VSPHUI.confirm("This changes a user account's ability to sign in and access the platform.",{title:"Change user status?",danger:b.dataset.userStatus!=="active",confirmLabel:"Confirm status change"}))return;
        await api(`/api/admin-management/users/${b.dataset.userId}/status`, {
          method: "PATCH", body: JSON.stringify({ status: b.dataset.userStatus })
        });
        flash("User status updated."); loadUsers();
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
  const ids=["subOrg","subApp","accessOrg","accessApp","roleOrg","roleApp"],selected=new Map(ids.map(id=>[id,document.getElementById(id).value]));
  try {
    lookups = await api("/api/admin-management/lookups");
    const orgOpts = selectOptions(lookups.organizations);
    const appOpts = selectOptions(lookups.applications, "id", "name");
    ["subOrg", "accessOrg", "roleOrg"].forEach(id => document.getElementById(id).innerHTML = orgOpts);
    ["subApp", "accessApp", "roleApp"].forEach(id => document.getElementById(id).innerHTML = appOpts);
    for(const id of ids){const previous=selected.get(id);if(previous)document.getElementById(id).value=previous;}
    syncMusicRoleOptions();
  } catch (e) { say(e.message, true);throw e; }
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
let auditView='all',removalCache=[];
const auditViews=[...document.querySelectorAll('[data-audit-view]')];
function selectAuditView(view){
 auditView=view==='removals'?'removals':'all';
 auditViews.forEach(button=>{
  const active=button.dataset.auditView===auditView;
  button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
 });
 document.getElementById('auditAllView').hidden=auditView!=='all';
 document.getElementById('auditRemovalsView').hidden=auditView!=='removals';
 if(auditView==='removals')loadRemovals();else loadAudit();
}
auditViews.forEach(button=>button.addEventListener('click',()=>selectAuditView(button.dataset.auditView)));
const make=(tag,label='',className='')=>{
 const node=document.createElement(tag);node.textContent=label;node.className=className;return node;
};
function drawRemovals(){
 const target=document.getElementById('auditRemovalGrid');target.replaceChildren();
 const search=document.getElementById('auditEmployeeSearch').value.trim().toLowerCase();
 const entries=removalCache.filter(entry=>[entry.full_name,entry.email,entry.removed_by_name,entry.removed_by_email,entry.removal_reason].some(value=>String(value||'').toLowerCase().includes(search)));
 document.getElementById('auditRemovalSummary').textContent=entries.length+' matching removals · showing latest 100 recorded removals';
 if(!entries.length){target.append(make('p',search?'No matching removal records.':'No removal events have been recorded.','hint'));return;}
 for(const entry of entries){
  const tile=make('button','','audit-removal-card');tile.type='button';
  tile.setAttribute('aria-label','View removal details for '+entry.full_name);
  tile.append(make('strong',entry.full_name),make('span',entry.email),make('small','Removed by '+(entry.removed_by_name||entry.removed_by_email||'Authorized administrator')),make('span',entry.removed_at?new Date(entry.removed_at).toLocaleString():'Date unavailable'),make('span','View full record','audit-card-meta'));
  tile.addEventListener('click',()=>VSPHUI.details('Employee removal record',[
   {label:'Employee',value:entry.full_name},
   {label:'Email',value:entry.email},
   {label:'Department',value:entry.department||'—'},
   {label:'Job title',value:entry.job_title||'—'},
   {label:'Removed by',value:entry.removed_by_name||entry.removed_by_email||'Authorized administrator'},
   {label:'Actor email',value:entry.removed_by_email||'—'},
   {label:'Date and time',value:entry.removed_at?new Date(entry.removed_at).toLocaleString():'—'},
   {label:'Reason',value:entry.removal_reason},
   {label:'Employee record ID',value:entry.id}
  ]));
  target.append(tile);
 }
}
async function loadRemovals(){
 try{
  document.getElementById('auditRemovalSummary').textContent='Loading removal history…';
  const d=await api('/api/employees/removals');removalCache=d.employees||[];drawRemovals();
 }catch(e){document.getElementById('auditRemovalSummary').textContent='Removal history unavailable.';say(e.message,true);}
}
document.getElementById('auditEmployeeSearch').addEventListener('input',drawRemovals);
document.getElementById('refreshAuditRemovals').addEventListener('click',loadRemovals);
async function loadWorkforceRoles(){
 const list=document.getElementById('workforceRoles'),notice=document.getElementById('workforceRoleMessage');
 list.replaceChildren();notice.textContent='Loading current workforce roles…';
 try{
  const params=new URLSearchParams(),term=document.getElementById('employeePermissionSearch').value.trim();
  if(term)params.set('search',term);
  const result=await api('/api/employees'+(params.size?'?'+params.toString():''));
  if(result.role!=='owner'||result.canManageHr!==true)throw Error('Owner permission required.');
  const rows=result.employees||[],managers=result.hrManagers||[];
  notice.textContent=managers.length+' HR manager'+(managers.length===1?'':'s')+' assigned · review employee permissions below';
  const activeIds=new Set();
  const candidates=[...managers.map(manager=>({id:manager.employee_id,full_name:manager.full_name,email:manager.email,status:manager.status,version:manager.version,is_hr:true})),...rows];
  for(const e of candidates){
   if(activeIds.has(e.id))continue;activeIds.add(e.id);
   if(term&&!(e.full_name+' '+e.email).toLowerCase().includes(term.toLowerCase()))continue;
   const item=make('article','','workforce-role-item'),details=make('div'),actions=make('div','','workforce-role-actions');
   details.append(make('strong',e.full_name),make('small',e.email+' · '+(e.is_hr?'HR manager':'Employee')+' · '+e.status));
   const link=make('a','Manage access','admin-return');link.href='/employees/'+encodeURIComponent(e.id)+'/account-link';
   actions.append(link);
   if(e.is_hr&&e.status!=='inactive'){
    const revoke=make('button','Revoke HR','small');revoke.type='button';
    revoke.addEventListener('click',async()=>{
     if(!await VSPHUI.confirm('Revoke HR authority for '+e.email+'? The employee account remains intact.',{title:'Revoke HR permissions?',danger:true,confirmLabel:'Revoke HR'}))return;
     revoke.disabled=true;
     try{
      await api('/api/employees/'+e.id+'/revoke_hr',{method:'POST',body:JSON.stringify({version:e.version,confirmed:true})});
      flash('HR access revoked.');await loadWorkforceRoles();
     }catch(error){say(error.message,true);revoke.disabled=false;}
    });
    actions.append(revoke);
   }
   item.append(details,actions);list.append(item);
  }
  if(!list.childElementCount)list.append(make('p','No matching employees in this directory page.','hint'));
 }catch(e){notice.textContent='Unable to load workforce permissions.';say(e.message,true);}
}
let roleSearchTimer;
document.getElementById('employeePermissionSearch').addEventListener('input',()=>{
 clearTimeout(roleSearchTimer);roleSearchTimer=setTimeout(loadWorkforceRoles,280);
});
document.getElementById('refreshWorkforceRoles').addEventListener('click',loadWorkforceRoles);

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
    e.target.reset(); flash("Application added."); loadApplications(); loadLookups(); loadOverview();
  } catch (err) { say(err.message, true); }
});
document.getElementById("subscriptionForm").addEventListener("submit", async e => {
  e.preventDefault();
  const endValue = document.getElementById("subEnd").value;
  if(!await VSPHUI.confirm("This changes subscription terms and may revoke affected product sessions. No payment is processed.",{title:"Save subscription?",confirmLabel:"Save subscription"}))return;
  try {
    say("Saving subscription…");
    await api("/api/admin-management/subscriptions", {
      method: "PUT", body: JSON.stringify({
        organizationId: document.getElementById("subOrg").value,
        applicationId: document.getElementById("subApp").value,
        version:lookups.organizations.find(o=>o.id===document.getElementById("subOrg").value)?.version,confirmed:true,
        planCode: document.getElementById("subPlan").value,
        status: document.getElementById("subStatus").value,
        endsAt: endValue ? new Date(endValue).toISOString() : null
      })
    });
    await loadLookups();flash("Subscription saved."); loadSubscriptions(); loadOverview();
  } catch (err) { say(err.message, true); }
});
document.getElementById("accessForm").addEventListener("submit", async e => {
  e.preventDefault();
  if(!await VSPHUI.confirm("This changes an organization product entitlement and revokes affected sessions.",{title:"Update application access?",confirmLabel:"Save access"}))return;
  try {
    say("Saving application access…");
    await api("/api/admin-management/access", {
      method: "PUT", body: JSON.stringify({
        organizationId: document.getElementById("accessOrg").value,
        applicationId: document.getElementById("accessApp").value,
        version:lookups.organizations.find(o=>o.id===document.getElementById("accessOrg").value)?.version,confirmed:true,
        status: document.getElementById("accessStatus").value
      })
    });
    await loadLookups();flash("Application access saved."); loadAccess(); loadOverview();
  } catch (err) { say(err.message, true); }
});
(async function init() {
  try {
    const response = await fetch("/api/auth/me");
    if (!response.ok) { window.location.href = "/login"; return; }
    const { user } = await response.json();
    if (user.platformRole !== "super_admin") { window.location.href = "/dashboard"; return; }
    await loadLookups();
    const params=new URLSearchParams(window.location.search);
    const tab=params.get('tab'),subview=params.get('view');
    if(tab==='permissions'||tab==='audit'||tab==='roles'){if(subview==='removals')auditView='removals';showTab(tab);}
    else await loadOverview();
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
  flash('Application role assigned.');loadRoles();
 }catch(err){say(err.message,true)}
});

