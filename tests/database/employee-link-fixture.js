// Synthetic native-fixture consent setup. Never imported by production code.
const {randomUUID}=require('node:crypto'),{hashToken}=require('../../tokens');
module.exports=async(pool,owner,candidate,employeeId)=>{
 const ownerHash=hashToken(randomUUID()),candidateHash=hashToken(randomUUID());
 for(const [hash,user] of [[ownerHash,owner],[candidateHash,candidate]])await pool.query("insert into portal_sessions(token_hash,user_id,expires_at) values($1,$2,now()+interval '1 hour')",[hash,user]);
 const version=(await pool.query('select version from internal_employees where id=$1',[employeeId])).rows[0].version;
 const cmd=async(actor,action,id,data)=>(await pool.query('select internal_employee_identity($1,$2,$3,$4) data',[actor,action,id,data])).rows[0].data;
 try{
  const request=await cmd(owner,'request',employeeId,{key:randomUUID(),rosterVersion:version,confirmed:true,currentHash:ownerHash});
  await cmd(candidate,'accept',request.id,{rosterVersion:version,requestVersion:1,confirmed:true,currentHash:candidateHash,verifiedAt:new Date().toISOString(),assurance:'aal1'});
 }finally{await pool.query('delete from portal_sessions where token_hash=any($1::text[])',[[ownerHash,candidateHash]]);}
};
