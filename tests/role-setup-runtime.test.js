const test=require('node:test'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const {SetupError,options,boundedFetch,failureMessage}=require('../services/role-setup-runtime');
const {IdentityError}=require('../services/verify-identity');
test('operator options select an existing owner/factor and reject ambiguity, malformed and prototype options',()=>{
 const ref='zbmerhexucqxazuxjmmw';assert.deepEqual(options(['--help']),{help:true});assert.deepEqual(options(['--project-ref',ref,'--owner-email','OWNER@EXAMPLE.TEST']),{projectRef:ref,ownerEmail:'owner@example.test'});
 for(const args of [[],['--project-ref','bad'],['--project-ref',ref,'--owner-email'],['--project-ref',ref,'--owner-email','bad'],['--project-ref',ref,'--factor-id','bad'],['--project-ref',ref,'--project-ref',ref],['--project-ref',ref,'__proto__','x'],['--project-ref',ref,'--unknown','value']])assert.throws(()=>options(args),SetupError);
 assert.equal(options(['--project-ref',ref,'--factor-id','11111111-1111-4111-a111-111111111111']).factorId,'11111111-1111-4111-a111-111111111111');
});
test('setup errors expose controlled recovery instructions but never raw dependency secrets',()=>{
 assert.match(failureMessage(new SetupError('Choose an owner.'),'owner lookup'),/owner lookup: Choose an owner/);
 assert.match(failureMessage(new IdentityError(401,'INVALID_CREDENTIALS','Invalid credentials.'),'owner verification'),/Invalid credentials/);
 const raw=Object.assign(Error('SECRET bearer/password SQL detail'),{code:'42501'});assert.doesNotMatch(failureMessage(raw,'account provisioning'),/SECRET|bearer|password SQL/);assert.match(failureMessage(raw,'account provisioning'),/consent/);
 assert.match(failureMessage({code:'EEXIST'},'private state'),/setup.lock/);assert.match(failureMessage(Error('SECRET'),'account provisioning'),/dependency failed/);
});
test('provider fetch is bounded, preserves cancellation/headers and refuses redirects',async()=>{
 const controller=new AbortController(),seen=[];const fetcher=async(_url,init)=>{seen.push(init);return new Response('ok');};
 await boundedFetch(fetcher,50)('https://example.test',{headers:{apikey:'private'},signal:controller.signal});assert.equal(seen[0].redirect,'error');assert.equal(seen[0].headers.apikey,'private');controller.abort();assert.equal(seen[0].signal.aborted,true);
 const requestAbort=new AbortController();await boundedFetch(fetcher,50)(new Request('https://example.test',{signal:requestAbort.signal}));requestAbort.abort();assert.equal(seen[1].signal.aborted,true);
 const hanging=(_url,init)=>new Promise((_resolve,reject)=>init.signal.addEventListener('abort',()=>reject(init.signal.reason),{once:true}));
 const keepAlive=setTimeout(()=>{},500);try{await assert.rejects(boundedFetch(hanging,10)('https://example.test'),{name:'TimeoutError'});}finally{clearTimeout(keepAlive);}
});
test('help works without credentials or TTY and invalid invocation prints a safe actionable failure',()=>{
 const env={...process.env,SUPABASE_URL:'',SUPABASE_SECRET_KEY:'',SUPABASE_PUBLISHABLE_KEY:''};
 const help=spawnSync(process.execPath,['scripts/setup-role-accounts.js','--help'],{encoding:'utf8',env});assert.equal(help.status,0);assert.match(help.stdout,/--owner-email/);
 const invalid=spawnSync(process.execPath,['scripts/setup-role-accounts.js','--bad'],{encoding:'utf8',env});assert.equal(invalid.status,1);assert.match(invalid.stderr,/stopped at configuration/);assert.match(invalid.stderr,/--project-ref/);
});
