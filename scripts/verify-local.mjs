#!/usr/bin/env node
// Local-only, explicit release verification: no cloud runners and no production writes.
import {spawnSync,execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
import {mkdirSync,readFileSync,writeFileSync} from "node:fs";
import {join} from "node:path";

const mode=process.argv[2]||"fast";
if(!["fast","release"].includes(mode)||process.argv.length>3){
  console.error("Usage: node scripts/verify-local.mjs [fast|release]");
  process.exit(2);
}
const steps=mode==="fast"
  ? [["test"],["check"],["check:migrations"],["lint"],["format:check"],["migrations:eol"]]
  : [["ci"],["test"],["check"],["check:migrations"],["lint"],["format:check"],
     ["migrations:eol"],["test:coverage"],["test:db:local"],["test:e2e:db"],["test:demo"],
     ["audit","--omit=dev","--audit-level=high"],["audit","--audit-level=high"]];
const git=arg=>{
  try{return execFileSync("git",arg,{encoding:"utf8",stdio:["ignore","pipe","ignore"]}).trim();}
  catch{return null;}
};
const sha=git(["rev-parse","HEAD"]);
const dirty=git(["status","--porcelain"]);
const lockHash=createHash("sha256").update(readFileSync("package-lock.json")).digest("hex");
const receiptDir=join(process.cwd(),".local-verification");
mkdirSync(receiptDir,{recursive:true});
const filename=join(receiptDir,(sha||"unknown").slice(0,12)+"-"+new Date().toISOString().replace(/[:.]/g,"-")+".json");
const receipt={
  purpose:"Local code verification only; not a hosted CI attestation or production deployment approval",
  mode,gitSha:sha,workingTreeDirty:dirty===null?null:dirty.length>0,
  lockfileSha256:lockHash,node:process.version,platform:process.platform,arch:process.arch,
  startedAt:new Date().toISOString(),finishedAt:null,result:"incomplete",checks:[]
};
const save=()=>writeFileSync(filename,JSON.stringify(receipt,null,2)+"\n",{mode:0o600});
save();
let failed=false;
for(const [task,...flags] of steps){
  const label=task==="audit"?"npm audit "+flags.join(" "):task==="ci"?"npm ci":"npm run "+task;
  process.stdout.write("\n▶ "+label+"\n");
  const start=Date.now();
  const command=process.platform==="win32"?"npm.cmd":"npm";
  const args=task==="ci"||task==="audit"?[task,...flags]:["run",task];
  const child=spawnSync(command,args,{
    cwd:process.cwd(),stdio:"inherit",shell:process.platform==="win32",windowsHide:true
  });
  const code=child.status===null?1:child.status;
  receipt.checks.push({name:label,passed:code===0,exitCode:code,durationMs:Date.now()-start});
  save();
  if(code!==0){
    failed=true;
    console.error("\n✗ "+label+" failed"+(child.error?" ("+child.error.message+")":"")+". Remaining checks were not executed.");
    break;
  }
}
receipt.finishedAt=new Date().toISOString();
receipt.result=failed?"failed":"passed";
save();
console.log("\n"+(failed?"LOCAL VERIFICATION FAILED":"LOCAL VERIFICATION PASSED"));
console.log("Receipt: "+filename);
if(!failed){
 console.log("Local checks passed. Hosted CI and production backup/restore requirements remain separate.");
 if(receipt.workingTreeDirty)console.warn("Working tree has changes. Commit and rerun for release evidence.");
}
process.exitCode=failed?1:0;
