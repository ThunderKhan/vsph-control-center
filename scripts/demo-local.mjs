// Explicitly isolated interactive acceptance. Never imports seed.js or reads a
// supplied DB URL, Supabase secret, hosted Auth, SMTP or production seed path.
import EmbeddedPostgres from 'embedded-postgres';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:net';
import {createRequire} from 'node:module';
if(process.getuid?.()===0)throw Error('Run as an ordinary OS user. No OS users are created.');
for(const key of Object.keys(process.env))if(/^(PG[A-Z_]|SUPABASE_|MUSIC_|GITHUB_|VERCEL_|INVITATION_|SMTP_|STAGING_|DATABASE_URL$|TEST_DATABASE_URL$|DEMO_PASSWORD$|TRUST_PROXY$)/.test(key))delete process.env[key];
for(const key of ['SUPABASE_URL','SUPABASE_SECRET_KEY','SUPABASE_PUBLISHABLE_KEY'])process.env[key]='';
process.env.PORT='3001';process.env.PUBLIC_ORIGIN='http://127.0.0.1:3001';process.env.NODE_ENV='test';
const directory=await mkdtemp(join(tmpdir(),'vsph-interactive-'));
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const database=new EmbeddedPostgres({databaseDir:join(directory,'data'),port,user:'postgres',password:'isolated-test-only',persistent:false,onLog:()=>{}});
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
 if(server?.listening)await new Promise(r=>server.close(r));await pool?.end();await database.stop();await rm(directory,{recursive:true,force:true});if(process.connected)process.disconnect();
}
