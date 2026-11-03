// Explicit export columns only: never serialize raw provider/credential objects.
const columns=[
 ['Project ID','id'],['Project key','key'],['Project name','name'],['Status','status'],
 ['Owner','owner_name'],['Customer organization','organization_name'],['Due date','due_on'],
 ['Completed tasks','completed_tasks'],['Total tasks','total_tasks'],['Assigned to me','assigned_to_me'],
 ['Overdue tasks','overdue_tasks'],['Completed milestones','completed_milestones'],['Pending milestones','pending_milestones'],
 ['Open pull requests','open_prs'],['PRs requesting review','prs_awaiting_requested_review'],['Failed build observations','failed_build_records'],
 ['Last repository sync','last_sync_at'],['Last project activity','last_activity_at'],
];
function cell(value){
 let text=value===null||value===undefined?'':String(value).replaceAll('\u0000','');
 // Quoting alone does not stop Excel/LibreOffice formulas. Also cover leading
 // whitespace/control characters, which some spreadsheet readers ignore.
 if(typeof value!=='number'&&(/^[\s\uFEFF]*[=+\-@]/u.test(text)||/^[\t\r\n]/.test(text)))text="'"+text;
 return '"'+text.replaceAll('"','""')+'"';
}
function projectCsv(report){
 if(!Array.isArray(report?.projects)||report.projects.length>100)throw Error('Project report exceeds the reviewed export bound.');
 const rows=[['Export scope','Generated at','Deployment status',...columns.map(c=>c[0])]];
 for(const project of report.projects)rows.push(['First 100 authorized matching projects',report.generatedAt,report.deploymentStatus,...columns.map(c=>project[c[1]])]);
 return '\uFEFF'+rows.map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n';
}
module.exports={cell,projectCsv};
