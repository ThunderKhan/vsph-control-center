(() => {
  "use strict";
  if (!location.pathname.startsWith("/projects/")) return;

  const $ = id => document.getElementById(id);
  const views = Object.freeze({
    overview: "overview", tasks: "work", milestones: "milestones",
    team: "team", applications: "projectApplications", delivery: "delivery",
    engineering: "engineering", activity: "activity", settings: "settings"
  });
  const E = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = String(text);
    if (className) node.className = className;
    return node;
  };
  const append = (parent, ...nodes) => { parent.append(...nodes); return parent; };
  const date = raw => raw ? new Date(raw).toLocaleDateString(undefined, {year:"numeric",month:"short",day:"numeric"}) : "Not scheduled";
  const statusText = state => String(state || "").replaceAll("_", " ");
  const link = (label, view) => {
    const a = E("a",label); a.href="?view="+view; a.dataset.projectOpen=view; return a;
  };
  const empty = (text) => E("p",text,"project-v2-empty");
  const badge = (text, kind = "neutral") => E("span", text, "project-v2-badge project-v2-badge--" + kind);
  const shortAction = (label, onClick) => {
    const b=E("button",label,"project-v2-action");
    b.type="button";b.addEventListener("click",async()=>{
      b.disabled=true;
      try {await onClick();}catch(err){message(err.message);}finally{b.disabled=false;}
    });
    return b;
  };
  const message = text => {
    const m=$("projectMessage"); if(m){m.textContent=text;m.setAttribute("role","status");}
  };

  let current=null, workspace=null, requestSerial=0;
  document.body.classList.add("project-detail-route");

  function selectView(view, push=false) {
    const role=current?.project?.role;
    const allowed=Object.hasOwn(views,view)
      && (view!=="settings" || role==="manager")
      && (view!=="engineering" || role!=="client");
    const selected=allowed?view:"overview";
    for(const [name,id] of Object.entries(views)) {
      const pane=$(id); if (!pane) continue;
      if (name==="settings" && current?.project?.role!=="manager") {pane.hidden=true;continue;}
      pane.hidden=name!==selected;
      pane.classList.toggle("project-v2-animate",name===selected);
    }
    for(const tab of $("projectViewNav").querySelectorAll("[data-project-view]")) {
      const active=tab.dataset.projectView===selected;
      if(active) tab.setAttribute("aria-current","page");
      else tab.removeAttribute("aria-current");
      tab.classList.toggle("is-active",active);
    }
    const names={overview:"Overview",tasks:"Tasks",milestones:"Milestones",team:"Team",applications:"Applications",delivery:"Delivery",engineering:"Engineering",activity:"Activity",settings:"Settings"};
    $("projectCrumb").textContent=names[selected];
    if(push) {
      const target=new URL(location.href);
      if(selected==="overview")target.searchParams.delete("view");
      else target.searchParams.set("view",selected);
      target.hash="";
      history.pushState({view:selected},"",target.pathname+target.search);
    }
  }
  function requestedView() {
    const query=new URLSearchParams(location.search).get("view");
    if(query && Object.hasOwn(views,query))return query;
    const legacy={work:"tasks",projectApplications:"applications"};
    const hash=location.hash.slice(1);
    return legacy[hash] || (Object.hasOwn(views,hash)?hash:"overview");
  }
  function updateLinks() {
    const key=current.project.project.key, path="/projects/"+encodeURIComponent(key);
    $("projectViewNav").querySelectorAll("[data-project-view]").forEach(a=>{
      const view=a.dataset.projectView;
      a.href=path+(view==="overview"?"":"?view="+view);
      if(view==="settings")a.hidden=current.project.role!=="manager";
      if(view==="engineering")a.hidden=current.project.role==="client";
    });
    document.querySelectorAll("[data-project-open]").forEach(a=>{
      a.href=path+"?view="+a.dataset.projectOpen;
    });
  }
  function meta() {
    const p=current.project.project,box=$("projectMeta");
    box.replaceChildren();
    const activeManagers=current.project.members.filter(member=>member.role==="manager"&&member.status==="active");
    // The project owner may appoint a different manager. Never label the
    // owner as the sole manager when an active appointment exists.
    const appointed=activeManagers.filter(member=>member.user_id!==p.owner_id);
    const displayed=appointed.length?appointed:activeManagers;
    const manager=displayed.length
      ? displayed.slice(0,2).map(member=>member.full_name).join(", ")+(displayed.length>2?" +"+(displayed.length-2):"")
      : current.project.role==="client"?"VSPH project team":"Manager not appointed";
    append(box,badge(statusText(p.status),p.status==="active"?"success":"neutral"),
      E("span",p.key+" · "+(p.kind==="customer"?"Client engagement":"Internal project")),
      E("span","Manager · "+manager),
      E("span","Due "+date(p.due_on)));
    if(p.description)append(box,E("p",p.description,"project-v2-description"));
  }
  const isManager=()=>current?.project?.role==="manager";
  function scopedTask(t) {return current.project.role==="manager" || t.assignee_id===current.user.id || current.project.role==="client" && t.shared;}
  function overviewActions() {
    const box=$("projectNextActions"); box.replaceChildren();
    const open=current.project.tasks.filter(t=>!["done","cancelled"].includes(t.status)&&scopedTask(t));
    const blocked=open.filter(t=>t.status==="blocked");
    const today=new Date().toISOString().slice(0,10);
    const overdue=open.filter(t=>t.due_on&&t.due_on<today);
    const unassigned=isManager()?open.filter(t=>!t.assignee_id):[];
    const urgent=[...blocked,...overdue.filter(t=>!blocked.includes(t)),...unassigned.filter(t=>!blocked.includes(t)&&!overdue.includes(t))].slice(0,4);
    if(!urgent.length) {
      const text=open.length ? "No blocked or overdue tasks requiring attention." :
        isManager() ? "No open work yet. Create a milestone and assign the first task." : "Nothing needs your attention right now.";
      box.append(empty(text));
    } else {
      for(const t of urgent) {
        const row=E("div",undefined,"project-v2-action-row");
        const content=E("div");
        const name=E("strong",t.title);
        const hint=E("small",t.status==="blocked"?"Blocked":t.due_on&&t.due_on<today?"Overdue · "+date(t.due_on):"Unassigned");
        append(content,name,hint);append(row,E("span","!","project-v2-action-marker"),content);
        box.append(row);
      }
    }
    box.append(link("Open tasks","tasks"));
  }
  function createForm(fields,submitLabel,handler) {
    const form=E("form",undefined,"project-v2-mini-form");
    const els={};
    for(const f of fields) {
      const wrapper=E("label",f.label);
      let control;
      if(f.type==="select") {
        control=E("select");for(const option of f.options) {
          const o=E("option",option.label);o.value=option.value;control.append(o);
        }
      } else if(f.type==="textarea") control=E("textarea");
      else {control=E("input");control.type=f.type||"text";}
      control.name=f.name;control.required=!!f.required;
      if(f.maxLength)control.maxLength=f.maxLength;
      if(f.placeholder)control.placeholder=f.placeholder;
      if(f.type==="checkbox")wrapper.classList.add("project-v2-check-label");
      wrapper.append(control); form.append(wrapper); els[f.name]=control;
    }
    const submit=E("button",submitLabel,"project-v2-primary");submit.type="submit";
    form.append(submit);
    form.addEventListener("submit",async event=>{
      event.preventDefault();if(!form.reportValidity())return;
      const data={};for(const [name,control] of Object.entries(els))
        data[name]=control.type==="checkbox"?control.checked:control.value;
      submit.disabled=true;
      try {await handler(data);form.reset();}catch(e){message(e.message);}finally{submit.disabled=false;}
    });
    return form;
  }
  function disclosure(label,form) {
    const details=E("details",undefined,"project-v2-editor");
    details.append(E("summary",label),form);
    return details;
  }
  async function action(kind,data) {
    if(!current || !workspace)throw Error("Project workspace is not ready.");
    const r=await fetch("/api/projects/"+current.project.project.id+"/workspace/"+kind,{
      method:"POST",credentials:"same-origin",cache:"no-store",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({version:current.project.project.version,...data})
    });
    const body=await r.json().catch(()=>({}));
    if(!r.ok) {
      if(r.status===409)throw Error("The project changed. Refresh this page and retry.");
      throw Error(body.message || "Could not save. Try again.");
    }
    message("Saved to the project.");
    document.dispatchEvent(new Event("vsph:workspace-mutated"));
  }
  function checklistView(box,compact) {
    box.replaceChildren();
    const milestones=current.project.milestones.filter(m=>m.status!=="cancelled");
    if(!milestones.length){box.append(empty("No milestones yet. Define the first delivery stage to start tracking progress."));return;}
    if(!workspace){box.append(empty("Milestone checklists are unavailable until the new database migration is installed."));return;}
    const all=workspace.checklist||[];
    if(compact) {
      const completed=all.filter(item=>item.completed).length;
      const pct=all.length?Math.round(completed/all.length*100):0;
      const summary=E("div",undefined,"project-v2-overall");
      append(summary,E("strong",all.length?pct+"% checklist complete":"Ready for planning"),
        E("small",all.length?completed+" of "+all.length+" steps done":"Add checklist steps to track milestones"));
      const totalbar=E("div",undefined,"project-v2-progress project-v2-overall-bar");
      totalbar.setAttribute("role","progressbar");
      totalbar.setAttribute("aria-label","Overall milestone checklist completion");
      totalbar.setAttribute("aria-valuemin","0");
      totalbar.setAttribute("aria-valuemax","100");
      totalbar.setAttribute("aria-valuenow",String(pct));
      const fill=E("span");fill.style.width=pct+"%";totalbar.append(fill);
      box.append(summary,totalbar);
    }
    for(const m of milestones.slice(0,compact?4:milestones.length)) {
      const items=all.filter(x=>x.milestone_id===m.id);
      const checked=items.filter(x=>x.completed).length;
      const pct=items.length?Math.round(checked/items.length*100):0;
      const wrap=E("details",undefined,"project-v2-milestone");
      if(!compact && milestones.length<=3)wrap.open=true;
      const summary=E("summary",undefined,"project-v2-milestone-summary");
      const leading=E("span", m.status==="done"?"✓":"", "project-v2-milestone-circle"+(m.status==="done"?" is-done":""));
      const info=E("div",undefined,"project-v2-milestone-info");
      append(info,E("strong",m.title),E("small",(items.length?checked+"/"+items.length+" items · ":"No checklist yet · ")+date(m.due_on)));
      const progress=E("span",items.length?pct+"%":"—","project-v2-progress-number");
      append(summary,leading,info,progress); wrap.append(summary);
      const progressbar=E("div",undefined,"project-v2-progress");
      progressbar.setAttribute("role","progressbar"); progressbar.setAttribute("aria-label",m.title+" checklist progress");
      progressbar.setAttribute("aria-valuemin","0");progressbar.setAttribute("aria-valuemax","100");progressbar.setAttribute("aria-valuenow",String(pct));
      const fill=E("span");fill.style.width=pct+"%";progressbar.append(fill);wrap.append(progressbar);
      const itemsBox=E("div",undefined,"project-v2-milestone-items");
      if(!items.length)itemsBox.append(empty("No checklist items. Add a step to track implementation."));
      for(const item of items) {
        const row=E("div",undefined,"project-v2-check-row");
        const allowed=isManager() || (current.project.role==="contributor" && item.assignee_id===current.user.id);
        const tick=E("button",item.completed?"✓":"","project-v2-circle-tick"+(item.completed?" is-checked":""));
        tick.type="button";tick.disabled=!allowed;tick.setAttribute("aria-pressed",String(item.completed));
        tick.setAttribute("aria-label",(item.completed?"Mark incomplete: ":"Mark complete: ")+item.title);
        if(allowed)tick.addEventListener("click",async()=>{
          tick.disabled=true;
          try {await action("checklist-toggle",{itemId:item.id,completed:!item.completed});}
          catch(e){message(e.message);tick.disabled=false;}
        });
        const content=E("div",undefined,"project-v2-check-text");
        content.append(E("span",item.title,item.completed?"is-complete":""));
        if(item.assignee_id){
          const assignee=current.project.members.find(x=>x.user_id===item.assignee_id);
          content.append(E("small",assignee?.full_name || "Assigned team member"));
        }
        append(row,tick,content);itemsBox.append(row);
      }
      if(isManager() && !["completed","archived"].includes(current.project.project.status)){
        const options=[{label:"Unassigned",value:""}];
        for(const member of current.project.members.filter(x=>x.status==="active"&&["manager","contributor"].includes(x.role)))
          options.push({label:member.full_name,value:member.user_id});
        const form=createForm([{name:"title",label:"Checklist item",required:true,maxLength:180,placeholder:"What should be delivered?"},{name:"assigneeId",label:"Assign to",type:"select",options}],
          "Add item",d=>action("checklist-add",{milestoneId:m.id,title:d.title,assigneeId:d.assigneeId||null}));
        itemsBox.append(disclosure("+ Add checklist item",form));
      }
      wrap.append(itemsBox);box.append(wrap);
    }
    if(compact&&milestones.length>4)box.append(link("View all "+milestones.length+" milestones","milestones"));
  }
  function renderRisks() {
    const box=$("projectRisks");box.replaceChildren();
    if(!workspace){box.append(empty("Risk tracking is unavailable until the workspace database migration is installed."));return;}
    const risks=(workspace.risks||[]).filter(r=>r.status==="open");
    const blocked=current.project.tasks.filter(t=>t.status==="blocked"&&scopedTask(t));
    if(!risks.length&&!blocked.length)box.append(empty(current.project.role==="client"?"No blockers in your shared project view.":"No open risks or blocked tasks recorded."));
    for(const t of blocked.slice(0,3)) {
      const row=E("div",undefined,"project-v2-risk-row");append(row,badge("Task blocked","danger"),E("strong",t.title));box.append(row);
    }
    for(const risk of risks.slice(0,5)){
      const row=E("div",undefined,"project-v2-risk-row");
      append(row,badge(risk.severity,risk.severity==="high"?"danger":"neutral"),E("strong",risk.title));
      if(isManager())row.append(shortAction("Resolve",()=>action("risk-resolve",{id:risk.id,resolved:true})));
      box.append(row);
    }
    if(isManager() && current.project.project.status!=="archived"){
      const form=createForm([{name:"title",label:"Risk or blocker",required:true,maxLength:180},{name:"severity",label:"Severity",type:"select",options:[{value:"low",label:"Low"},{value:"medium",label:"Medium"},{value:"high",label:"High"}]}],
        "Add risk",d=>action("risk-add",d));
      box.append(disclosure("+ Add risk",form));
    }
  }
  function renderResources() {
    const box=$("projectResources");box.replaceChildren();
    if(!workspace){box.append(empty("Project resources need the workspace database migration."));return;}
    const resources=workspace.resources||[];
    if(!resources.length)box.append(empty("No resource links yet. Keep important design, documentation and deployment references here."));
    for(const entry of resources.slice(0,8)){
      const row=E("div",undefined,"project-v2-resource-row");
      const text=E("div",undefined,"project-v2-resource-content");
      const a=E("a",entry.label);a.href=entry.url;a.target="_blank";a.rel="noopener noreferrer";
      append(text,a,E("small",statusText(entry.category)));row.append(text);
      if(isManager())row.append(shortAction("Remove",()=>action("resource-archive",{id:entry.id})));
      box.append(row);
    }
    if(isManager() && current.project.project.status!=="archived"){
      const form=createForm([
        {name:"label",label:"Resource label",required:true,maxLength:120},
        {name:"url",label:"HTTPS resource link",required:true,type:"url",maxLength:1000,placeholder:"https://"},
        {name:"category",label:"Type",type:"select",options:["document","design","repository","deployment","other"].map(v=>({label:statusText(v),value:v}))},
        {name:"shared",label:"Visible to authorized customer viewers",type:"checkbox"}
      ],"Save resource",d=>action("resource-add",d));
      box.append(disclosure("+ Add resource",form));
    }
  }
  function renderUpdates() {
    const box=$("projectWeeklyUpdates");box.replaceChildren();
    if(!workspace){box.append(empty("Weekly updates need the workspace database migration."));return;}
    const updates=workspace.updates||[];
    if(!updates.length)box.append(empty("No updates yet. Post a short weekly summary so stakeholders can follow progress."));
    for(const update of updates.slice(0,3)){
      const card=E("div",undefined,"project-v2-update");
      const header=E("div",undefined,"project-v2-update-head");
      const user=current.project.members.find(m=>m.user_id===update.created_by)?.full_name || "Project manager";
      append(header,badge(statusText(update.health),update.health==="on_track"?"success":update.health==="off_track"?"danger":"neutral"),
        E("small",user+" · "+date(update.created_at)));
      card.append(header,E("p",update.summary));
      if(update.next_steps)card.append(E("small","Next: "+update.next_steps));
      box.append(card);
    }
    if(isManager() && current.project.project.status!=="archived"){
      const form=createForm([
        {name:"health",label:"Current outlook",type:"select",options:[{value:"on_track",label:"On track"},{value:"at_risk",label:"At risk"},{value:"off_track",label:"Off track"}]},
        {name:"summary",label:"What changed this week?",type:"textarea",required:true,maxLength:2500,placeholder:"Completed work, progress and context"},
        {name:"nextSteps",label:"What's next?",type:"textarea",maxLength:1500},
        {name:"shared",label:"Visible to authorized customer viewers",type:"checkbox"}
      ],"Publish weekly update",d=>action("update-publish",d));
      box.append(disclosure("+ Write an update",form));
    }
  }
  function render() {
    if(!current)return;
    meta();overviewActions();checklistView($("projectRoadmap"),true);checklistView($("milestoneChecklistPanel"),false);
    renderRisks();renderResources();renderUpdates();
  }
  async function readWorkspace() {
    const serial=++requestSerial;
    let result=null,fail=null;
    try {
      const response=await fetch("/api/projects/"+current.project.project.id+"/workspace",{
        credentials:"same-origin",cache:"no-store"
      });
      if(!response.ok)throw Error("Workspace data unavailable (database upgrade or permissions may be required).");
      result=await response.json();
    }catch(error){fail=error;}
    if(serial!==requestSerial)return;
    workspace=result;
    render();
    if(fail) {
      const text=E("p","Project extras are unavailable: "+fail.message,"project-v2-inline-warning");
      $("projectNextActions").prepend(text);
    }
  }
  document.addEventListener("vsph:project-loaded",event=>{
    current=event.detail;
    updateLinks();
    // Old UUID bookmarks and key bookmarks resolve to a stable human-readable URL.
    const preferred="/projects/"+encodeURIComponent(current.project.project.key);
    const existingView=requestedView();
    if(location.pathname!==preferred){
      const url=new URL(location.href);
      history.replaceState({view:existingView},"",preferred+url.search+url.hash);
    }
    selectView(existingView);
    render();
    readWorkspace();
  });
  document.addEventListener("click",event=>{
    const a=event.target.closest("a[data-project-view],a[data-project-open]");
    if(!a || !current || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)return;
    event.preventDefault();selectView(a.dataset.projectView||a.dataset.projectOpen,true);
  });
  window.addEventListener("popstate",()=>current&&selectView(requestedView()));
})();
