// Runs only on the operator's machine with its existing server configuration.
require('dotenv').config({quiet:true});
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process'),{createInterface}=require('node:readline'),{Writable}=require('node:stream');
const {randomBytes}=require('node:crypto'),{db,check,configured}=require('../db');
const {setupRoleAccounts,randomUUID}=require('../services/role-test-accounts'),{verifyIdentity,IdentityError}=require('../services/verify-identity');
const {newToken,hashToken}=require('../tokens');
const {SetupError,options,boundedFetch,failureMessage}=require('../services/role-setup-runtime');
let stage='configuration';
async function secret(prompt){process.stdout.write(prompt);const silent=new Writable({write(_chunk,_encoding,callback){callback();}}),rl=createInterface({input:process.stdin,output:silent,terminal:true});try{return await new Promise((resolve,reject)=>{rl.once('SIGINT',()=>reject(new SetupError('Credential entry cancelled.')));rl.once('close',()=>reject(new SetupError('Credential input closed.')));rl.question('',answer=>{process.stdout.write('\n');resolve(answer);});});}finally{rl.close();}}
async function main(){
 const args=options(process.argv.slice(2));if(args.help){console.log('npm run accounts:setup -- --project-ref PROJECT_REF [--owner-email EMAIL] [--factor-id UUID]\nCreates real operator-owned HR, employee and basic customer accounts; preserves the selected owner. Passwords stay in a protected private file.');return;}
 if(!configured())throw new SetupError('Existing server Supabase configuration is required; no credentials should be pasted into chat.');
 const url=new URL(process.env.SUPABASE_URL);if(url.protocol!=='https:'||url.hostname!==args.projectRef+'.supabase.co')throw new SetupError('The configured database does not match the explicitly selected project.');
 if(!process.stdin.isTTY)throw new SetupError('Run from an interactive private terminal.');
 globalThis.fetch=boundedFetch(globalThis.fetch.bind(globalThis));
 stage='owner lookup';const database=db();let query=database.from('profiles').select('id,email').eq('platform_role','super_admin').eq('status','active');if(args.ownerEmail)query=query.eq('email',args.ownerEmail);const owners=check(await query.limit(2));
 if(owners.length!==1)throw new SetupError('No unique active owner matched. Use --owner-email EMAIL to select an existing active platform owner. No account was created.');
 stage='owner verification';const owner=owners[0];console.log('Verify the existing portal owner: '+owner.email);const password=await secret('Existing platform owner password (hidden): ');let verified;
 try{verified=await verifyIdentity({email:owner.email,password},{expectedUserId:owner.id});}
 catch(e){if(!(e instanceof IdentityError)||e.code!=='MFA_REQUIRED'||!e.factors?.length)throw e;const factor=args.factorId?e.factors.find(f=>f.id===args.factorId):e.factors.length===1?e.factors[0]:null;if(!factor){console.log('Available owner authenticators: '+e.factors.map(f=>f.id+' ('+String(f.name).replace(/[\u0000-\u001f\u007f]/g,' ')+')').join(', '));throw new SetupError('Choose an enrolled authenticator using --factor-id UUID.');}const code=await secret('Owner authenticator code (hidden): ');verified=await verifyIdentity({email:owner.email,password,totpCode:code,totpFactorId:factor.id},{expectedUserId:owner.id});}
 if(verified.user.id!==owner.id)throw new SetupError('Owner verification failed.');
 stage='private state';const directory=path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),'.local','share'),'VSPH','private-role-accounts',args.projectRef);await fs.mkdir(directory,{recursive:true,mode:0o700});
 if(process.platform==='win32'){const sid=execFileSync('whoami',['/user','/fo','csv','/nh'],{encoding:'utf8'}).match(/S-1-5-\d+(?:-\d+)+/)[0];execFileSync('icacls',[directory,'/inheritance:r','/grant:r','*'+sid+':(OI)(CI)F','*S-1-5-18:(OI)(CI)F'],{stdio:'ignore'});}else await fs.chmod(directory,0o700);
 const lock=await fs.open(path.join(directory,'setup.lock'),'wx',0o600);let hash,output;
 try{
  const statePath=path.join(directory,'accounts.json');let state;
  try{state=JSON.parse(await fs.readFile(statePath,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;state={ownerId:owner.id,runId:randomUUID(),projectRef:args.projectRef,startDate:new Date().toISOString().slice(0,10),passwords:Object.fromEntries(['hr','employee','customer'].map(role=>[role,randomBytes(32).toString('base64url')]))};await fs.writeFile(statePath,JSON.stringify(state,null,2),{flag:'wx',mode:0o600});}
  if(state.ownerId&&state.ownerId!==owner.id)throw new SetupError('The private setup belongs to a different owner. Use its original owner; do not delete the private file.');
  if(state.projectRef!==args.projectRef)throw new SetupError('Private state target mismatch.');
  stage='temporary owner session';hash=hashToken(newToken());check(await database.from('portal_sessions').insert({token_hash:hash,user_id:owner.id,expires_at:new Date(Date.now()+1800000).toISOString()}));
  stage='account provisioning';const accounts=await setupRoleAccounts({database,ownerId:owner.id,ownerSessionHash:hash,state,verify:verifyIdentity});
  state.ownerId=owner.id;await fs.writeFile(statePath,JSON.stringify(state,null,2),{mode:0o600});
  stage='private login output';output=path.join(directory,'LOGIN_DETAILS.json');await fs.writeFile(output,JSON.stringify({url:'http://localhost:3000/login',runId:state.runId,accounts},null,2),{mode:0o600});
  stage='session cleanup';

 }finally{try{if(hash)check(await database.from('portal_sessions').delete().eq('token_hash',hash));}finally{await lock.close();await fs.unlink(path.join(directory,'setup.lock'));}}
 console.log('Real role accounts are ready for http://localhost:3000/login. Private login details: '+output);
}
if(require.main===module)main().catch(error=>{console.error(failureMessage(error,stage));process.exitCode=1;});
module.exports={main,secret};
