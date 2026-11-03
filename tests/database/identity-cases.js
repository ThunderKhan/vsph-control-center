const assert=require('node:assert/strict'),crypto=require('node:crypto'),{once}=require('node:events');
module.exports=async pool=>{
 const id=crypto.randomUUID(),email=id+'@fixture.test';await pool.query('insert into auth.users values($1)',[id]);await pool.query("insert into profiles(id,full_name,email) values($1,'MFA fixture',$2)",[id,email]);
 const lookup=async value=>(await pool.query('select id,email from profiles where email=$1',[value])).rows[0];
 const factory=require('../fixtures/identity-provider')(lookup,{mfaEmails:[email]});
 const server=require('./http-fixture')(pool,undefined,factory).listen(0,'127.0.0.1');await once(server,'listening');
 try{
  const base='http://127.0.0.1:'+server.address().port,send=body=>fetch(base+'/api/auth/login',{method:'POST',headers:{Origin:'http://localhost:3000','Content-Type':'application/json'},body:JSON.stringify(body)}),credentials={email,password:'fixture-password-only'};
  const missing=await send(credentials);assert.equal(missing.status,401);assert.equal(missing.headers.get('set-cookie'),null);assert.equal((await missing.json()).code,'MFA_REQUIRED');
  const bad=await send({...credentials,totpCode:'000000'});assert.equal(bad.status,401);assert.equal(bad.headers.get('set-cookie'),null);
  assert.equal((await pool.query('select count(*) from portal_sessions where user_id=$1',[id])).rows[0].count,'0');
  const good=await send({...credentials,totpCode:'123456'});assert.equal(good.status,200);assert.match(good.headers.get('set-cookie'),/HttpOnly/);assert.doesNotMatch(JSON.stringify(await good.json()),/access_token|refresh_token|isolated-provider/);
  assert.equal((await pool.query('select count(*) from portal_sessions where user_id=$1',[id])).rows[0].count,'1');
  await pool.query("update profiles set status='disabled' where id=$1",[id]);const disabled=await send({...credentials,totpCode:'123456'});assert.equal(disabled.status,403);assert.equal(disabled.headers.get('set-cookie'),null);
 }finally{await new Promise(r=>server.close(r));}
};
