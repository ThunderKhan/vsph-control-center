(()=>{
"use strict";
const $=id=>document.getElementById(id),target=$("managerOverviewTable");
const node=(tag,value)=>{const n=document.createElement(tag);n.textContent=String(value);return n;};
async function reload(){
 const button=$("refreshManagerOverview");button.disabled=true;target.setAttribute("aria-busy","true");
 $("managerOverviewMessage").textContent="";
 try{
  const r=await fetch("/api/projects/manager-overview",{credentials:"same-origin",cache:"no-store"});
  if(r.status===401){location.replace("/login");return;}
  const body=await r.json().catch(()=>({}));
  if(!r.ok)throw Error(body.message||"Manager records unavailable.");
  const records=Array.isArray(body.managers)?body.managers:[];
  $("managerAssignments").textContent=String(records.length);
  $("managerProjects").textContent=String(new Set(records.map(x=>x.project_id)).size);
  $("managerUnlinked").textContent=String(records.filter(x=>!x.linked_employee).length);
  target.replaceChildren();
  if(!records.length){target.append(node("p","No active manager appointments found."));return;}
  const table=document.createElement("table");const head=document.createElement("thead"),hr=document.createElement("tr");
  for(const name of ["Project","Manager","Department","Account","Authority"]){const th=node("th",name);th.scope="col";hr.append(th);}
  head.append(hr);table.append(head);
  const bodyNode=document.createElement("tbody");
  for(const item of records){
    const row=document.createElement("tr"),cells=[];
    const first=document.createElement("td"),link=node("a",item.project_name);
    link.href="/projects/"+encodeURIComponent(item.project_id)+"#team";
    first.append(link,node("small",item.project_status));cells.push(first);
    cells.push(node("td",item.manager_name));
    cells.push(node("td",item.department||"Platform owner / existing assignment"));
    cells.push(node("td",item.account_status));
    cells.push(node("td",item.accountable_owner?"Accountable project owner":"Project manager"));
    row.append(...cells);bodyNode.append(row);
  }
  table.append(bodyNode);target.append(table);
 }catch(error){$("managerOverviewMessage").textContent=error.message;}
 finally{target.setAttribute("aria-busy","false");button.disabled=false;}
}
$("refreshManagerOverview").addEventListener("click",()=>void reload());void reload();
})();
