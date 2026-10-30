// Disposable PostgreSQL only. Never reads SUPABASE_* or a production URL.
import EmbeddedPostgres from 'embedded-postgres';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
if(process.getuid?.()===0)throw new Error('Run as an ordinary OS user; this helper never creates OS users.');
const directory=await mkdtemp(join(tmpdir(),'vsph-postgres-'));
const probe=createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));
const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
const postgres=new EmbeddedPostgres({databaseDir:join(directory,'data'),port,user:'postgres',password:'isolated-test-only',persistent:false,onLog:()=>{}});
try{
 await postgres.initialise();await postgres.start();await postgres.createDatabase('vsph_test');
 const e2e=process.argv.includes('--e2e');
 const child=spawn(process.execPath,e2e?['node_modules/@playwright/test/cli.js','test']:['--test','tests/database/schema.test.mjs'],{stdio:'inherit',env:{...process.env,
  TEST_DATABASE_URL:`postgresql://postgres:isolated-test-only@127.0.0.1:${port}/vsph_test`,...(e2e?{PROJECT_E2E_DATABASE:'true'}:{})}});
 const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',resolve)});
 process.exitCode=code??1;
}finally{await postgres.stop();await rm(directory,{recursive:true,force:true});}
