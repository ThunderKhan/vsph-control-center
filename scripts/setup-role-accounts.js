// Runs only on the operator's machine with its existing server configuration.
require('dotenv').config({quiet:true});
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process'),{createInterface}=require('node:readline'),{Writable}=require('node:stream');
const {randomBytes}=require('node:crypto'),{db,check,configured}=require('../db');
const {setupRoleAccounts,randomUUID}=require('../services/role-test-accounts'),{verifyIdentity,IdentityError}=require('../services/verify-identity');
const {newToken,hashToken}=require('../tokens');
async function secret(prompt){process.stdout.write(prompt);const silent=new Writable({write(_chunk,_encoding,callback){callback();}}),rl=createInterface({input:process.stdin,output:silent,terminal:true});try{return await new Promise(resolve=>rl.question('',answer=>{process.stdout.write('\n');resolve(answer);}));}finally{rl.close();}}
async function main(){
 const args=process.argv.slice(2);if(args.length!==2||args[0]!=='--project-ref'||!/^[a-z]{20}$/.test(args[1]))throw Error('Usage: npm run accounts:setup -- --project-ref YOUR_PROJECT_REF');
 if(!configured())throw Error('Existing server Supabase configuration is required; no credentials should be pasted into chat.');
 const url=new URL(process.env.SUPABASE_URL);if(url.protocol!=='https:'||url.hostname!==args[1]+'.supabase.co')throw Error('The configured database does not match the explicitly selected project.');
 if(!process.stdin.isTTY)throw Error('Run from an interactive private terminal.');
 const database=db(),owners=check(await database.from('profiles').select('id,email').eq('platform_role','super_admin').eq('status','active').limit(2));
 if(owners.length!==1)throw Error('Exactly one active owner is required for automatic selection. Use governed administration for multiple owners.');
 const owner=owners[0],password=await secret('Existing platform owner password (hidden): ');let verified;
 try{verified=await verifyIdentity({email:owner.email,password},{expectedUserId:owner.id});}
 catch(e){if(!(e instanceof IdentityError)||e.code!=='MFA_REQUIRED'||e.factors?.length!==1)throw Error('Owner verification failed or requires separate factor selection.');const code=await secret('Owner authenticator code (hidden): ');verified=await verifyIdentity({email:owner.email,password,totpCode:code,totpFactorId:e.factors[0].id},{expectedUserId:owner.id});}
 if(verified.user.id!==owner.id)throw Error('Owner verification failed.');
 const directory=path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),'.local','share'),'VSPH','private-role-accounts',args[1]);await fs.mkdir(directory,{recursive:true,mode:0o700});
 if(process.platform==='win32'){const sid=execFileSync('whoami',['/user','/fo','csv','/nh'],{encoding:'utf8'}).match(/S-1-5-\d+(?:-\d+)+/)[0];execFileSync('icacls',[directory,'/inheritance:r','/grant:r','*'+sid+':(OI)(CI)F','*S-1-5-18:(OI)(CI)F'],{stdio:'ignore'});}else await fs.chmod(directory,0o700);
 const lock=await fs.open(path.join(directory,'setup.lock'),'wx',0o600);let hash;
 try{
  const statePath=path.join(directory,'accounts.json');let state;
  try{state=JSON.parse(await fs.readFile(statePath,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;state={runId:randomUUID(),projectRef:args[1],startDate:new Date().toISOString().slice(0,10),passwords:Object.fromEntries(['hr','employee','customer'].map(role=>[role,randomBytes(32).toString('base64url')]))};await fs.writeFile(statePath,JSON.stringify(state,null,2),{flag:'wx',mode:0o600});}
  if(state.projectRef!==args[1])throw Error('Private state target mismatch.');
  hash=hashToken(newToken());check(await database.from('portal_sessions').insert({token_hash:hash,user_id:owner.id,expires_at:new Date(Date.now()+1800000).toISOString()}));
  const accounts=await setupRoleAccounts({database,ownerId:owner.id,ownerSessionHash:hash,state,verify:verifyIdentity});
  const output=path.join(directory,'LOGIN_DETAILS.json');await fs.writeFile(output,JSON.stringify({url:'http://localhost:3000/login',runId:state.runId,accounts},null,2),{mode:0o600});
  console.log('Real role accounts are ready for http://localhost:3000/login. Private login details: '+output);
 }finally{try{if(hash)check(await database.from('portal_sessions').delete().eq('token_hash',hash));}finally{await lock.close();await fs.unlink(path.join(directory,'setup.lock'));}}
}
main().catch(()=>{console.error('Account setup stopped. No existing password was reset. Keep the private accounts.json for safe retry; review configuration, owner verification and provider access.');process.exitCode=1;});
