// Explicitly isolated interactive acceptance. Never imports seed.js or reads a
// supplied DB URL, Supabase secret, hosted Auth, SMTP or production seed path.
import EmbeddedPostgres from 'embedded-postgres';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer,createConnection} from 'node:net';
import {createRequire} from 'node:module';
if(process.getuid?.()===0)throw Error('Run as an ordinary OS user. No OS users are created.');
for(const key of Object.keys(process.env))if(/^(PG[A-Z_]|SUPABASE_|MUSIC_|GITHUB_|VERCEL_|INVITATION_|SMTP_|STAGING_|DATABASE_URL$|TEST_DATABASE_URL$|DEMO_PASSWORD$|TRUST_PROXY$)/.test(key))delete process.env[key];
for(const key of ['SUPABASE_URL','SUPABASE_SECRET_KEY','SUPABASE_PUBLISHABLE_KEY'])process.env[key]='';
process.env.PORT='3001';process.env.PUBLIC_ORIGIN='http://127.0.0.1:3001';process.env.NODE_ENV='test';
const directory=await mkdtemp(join(tmpdir(),'vsph-interactive-'));
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
// We own deletion of the disposable directory. On Windows, the library's
// persistent:false stop hook may race a still-running PostgreSQL forkchild.
const database=new EmbeddedPostgres({databaseDir:join(directory,'data'),port,user:'postgres',password:'isolated-test-only',persistent:true,onLog:()=>{}});
let pool,server;try{
 await database.initialise();await database.start();await database.createDatabase('vsph_test');
 const require=createRequire(import.meta.url);
 // Prevent server.js from loading a real .env into this test-only process.
 require('dotenv').config=()=>({parsed:{}});
 const {Pool}=require('pg');pool=new Pool({host:'127.0.0.1',port,database:'vsph_test',user:'postgres',password:'isolated-test-only'});
 ({server}=await require('../tests/e2e/fixture-server').start(pool,{interactive:true}));
 await new Promise((resolve,reject)=>{if(server.listening)resolve();else{server.once('listening',resolve);server.once('error',reject);}});
 console.log('\nISOLATED TEST WORKSPACE — simulated Auth, real disposable PostgreSQL.');
 console.log('Open http://127.0.0.1:3001/login (not your normal localhost:3000 server).');
 console.log('Owner: admin@fixture.test | HR: hr-desktop@fixture.test | Employee: staff-desktop@fixture.test | Music customer: music@fixture.test');
 console.log('Password for these isolated fixtures only: fixture-password-only');
 console.log('HR cannot grant HR; employee sees own assigned work; customer has Music only.');
 console.log('No hosted data, real emails or live Music SSO. Stop with Ctrl+C; fixtures are removed.');
 await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);server.once('close',resolve);process.on('message',m=>{if(m?.type==='vsph-demo-stop')resolve();});});
}finally{
 // Close the HTTP listener and active SQL clients before stopping PostgreSQL.
 // Never force-kill unrelated processes on Windows: a stale listener could
 // belong to a different owner after port reuse.
 const issues=[];
 if(server?.listening)try{await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
 catch(error){issues.push(error);}
 try{await pool?.end();}catch(error){issues.push(error);}
 try{await database.stop();}catch(error){issues.push(error);}
 const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 async function portReleased(){
  return await new Promise(resolve=>{
   const socket=createConnection({host:'127.0.0.1',port});
   socket.setTimeout(400);
   let settled=false;
   const finish=value=>{if(settled)return;settled=true;socket.destroy();resolve(value);};
   socket.once('connect',()=>finish(false));
   socket.once('error',error=>finish(error.code==='ECONNREFUSED'));
   socket.once('timeout',()=>finish(false));
  });
 }
 let stopped=false;
 for(let attempt=0;attempt<25;attempt++){
  if(await portReleased()){stopped=true;break;}
  await sleep(160);
 }
 if(!stopped){
  // The cluster or another process is still listening; do not delete a live
  // PostgreSQL data directory. This is a shutdown failure, not an auth error.
  console.error('Demo shutdown incomplete: PostgreSQL port remains in use. Temporary fixture retained at '+directory);
  process.exitCode=1;
 }else{
  // Node fs.rm retries transient Windows EPERM/EBUSY/ENOTEMPTY errors.
  // On persistent OS locks, report the fixture path rather than hiding the
  // leak or crashing with an unhandled exception.
  try{await rm(directory,{recursive:true,force:true,maxRetries:12,retryDelay:250});}
  catch(error){
   console.error('Demo stopped, but the temporary PostgreSQL directory could not be removed ('+
     String(error.code||'unknown')+'). Check for remaining postgres.exe processes before deleting: '+directory);
   process.exitCode=1;
  }
 }
 if(issues.length){
  console.error('Demo shutdown reported '+issues.length+' cleanup error(s). Inspect PostgreSQL child processes before restarting.');
  process.exitCode=1;
 }
 if(process.connected)process.disconnect();
}
