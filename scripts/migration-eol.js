// Repository source normalization only. No database connections or history edits.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const digest=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');
function normalize({root=path.resolve(__dirname,'..'),write=false}={}){
 const taskRoot=fs.realpathSync(root),manifest=JSON.parse(fs.readFileSync(path.join(taskRoot,'supabase/migration-manifest.json'),'utf8'));
 if(!manifest.bootstrap||!Array.isArray(manifest.migrations))throw Error('Invalid migration manifest. No files changed.');
 const seen=new Set(),plans=[],contentDrift=[];
 for(const entry of [manifest.bootstrap,...manifest.migrations]){
  if(!entry||typeof entry.path!=='string'||!/^supabase\/(schema\.sql|migrations\/[a-zA-Z0-9_]+\.sql)$/.test(entry.path)||seen.has(entry.path.toLowerCase())||typeof entry.sha256!=='string'||!/^[0-9a-f]{64}$/.test(entry.sha256))throw Error('Invalid migration entry. No files changed.');
  seen.add(entry.path.toLowerCase());
  const target=path.resolve(taskRoot,entry.path);
  if(!fs.lstatSync(target).isFile()||!fs.realpathSync(target).startsWith(taskRoot+path.sep))throw Error('Unsafe migration path. No files changed.');
  const before=fs.readFileSync(target),canonical=Buffer.from(before.toString('utf8').replace(/\r\n/g,'\n'),'utf8');
  if(digest(canonical)!==entry.sha256)contentDrift.push(entry.path);
  else if(!before.equals(canonical))plans.push({target,path:entry.path,before,canonical});
 }
 // Inspect every entry before any write: a real content change prevents all normalization.
 if(contentDrift.length)throw Error('Migration content differs from the reviewed manifest. No files changed: '+contentDrift.join(', '));
 if(write)for(const plan of plans){
  if(!fs.lstatSync(plan.target).isFile()||!fs.realpathSync(plan.target).startsWith(taskRoot+path.sep)||!fs.readFileSync(plan.target).equals(plan.before))throw Error('Migration changed during normalization. Stop and review the working tree.');
  fs.writeFileSync(plan.target,plan.canonical);
 }
 return {scope:'repository-source-only',filesChecked:seen.size,lineEndingDrift:plans.map(p=>p.path),written:write?plans.length:0,databaseModified:false};
}
if(require.main===module){
 try{
  if(process.argv.slice(2).some(arg=>arg!=='--write')||process.argv.slice(2).length>1)throw Error('Usage: npm run migrations:eol -- [--write]');
  const write=process.argv.includes('--write'),result=normalize({write});process.stdout.write(JSON.stringify(result)+'\n');
  if(!write&&result.lineEndingDrift.length)process.exitCode=1;
 }catch(error){process.stderr.write(error.message+'\n');process.exitCode=1;}
}
module.exports={normalize};
