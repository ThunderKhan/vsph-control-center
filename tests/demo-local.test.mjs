import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
test('interactive role workspace boots in disposable PostgreSQL and enforces role boundaries',{timeout:60000,skip:process.getuid?.()===0},async()=>{
 const child=spawn(process.execPath,['scripts/demo-local.mjs'],{stdio:['ignore','pipe','pipe']});let output='';const ready=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Isolated workspace startup timed out')),30000);child.stdout.on('data',chunk=>{output+=chunk;if(output.includes('Password for these isolated fixtures only:')){clearTimeout(timer);resolve();}});child.once('error',e=>{clearTimeout(timer);reject(e);});child.once('exit',code=>{clearTimeout(timer);reject(Error('Fixture exited before startup: '+code));});});
 const origin='http://127.0.0.1:3001';
 try{await ready;
  for(const [email,hr,employee] of [['hr-desktop@fixture.test',true,true],['staff-desktop@fixture.test',false,true],['music@fixture.test',false,false]]){
   const login=await fetch(origin+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email,password:'fixture-password-only'})});assert.equal(login.status,200,email);const cookie=login.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ');assert.ok(cookie.includes('vsph.portal.sid='));
   const get=path=>fetch(origin+path,{headers:{Cookie:cookie}}),r=await get('/api/hrms/access'),flags=await r.json();assert.equal(flags.management,hr);assert.equal(flags.employee,employee);assert.equal(flags.governHr,false);assert.equal((await get('/hr/access')).status,403);assert.equal((await get('/admin')).status,403);
   const page=await get('/dashboard');assert.match(await page.text(),/Isolated test workspace/);
   if(!employee){const apps=await(await get('/api/apps')).json();assert.deepEqual(apps.applications.map(a=>a.code),['MUSIC']);assert.equal((await get('/hr')).status,403);assert.equal((await get('/my-work')).status,403);assert.equal((await get('/apps/crm/login')).status,403);}else{assert.equal((await get('/my-work')).status,200);if(!hr)assert.equal((await get('/api/employees')).status,403);}
  }
 }finally{if(child.exitCode===null&&child.signalCode===null){const closed=once(child,'exit');child.kill('SIGINT');await closed;}}
});
