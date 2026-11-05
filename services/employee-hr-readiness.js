const {check}=require('../db');

// Readiness is guidance only. The mutation RPC repeats all permission, consent,
// session and version checks under locks; this read cannot authorize a grant.
async function reviewHrAccess(database,req,review=null){
 const access=check(await database.rpc('internal_employee_command',{p_actor:req.user.id,p_action:'access',p_id:null,p_data:{}}));
 if(access.role!=='owner'){const error=Error('Owner permission required.');error.code='42501';throw error;}
 const current=review||check(await database.rpc('internal_employee_identity',{p_actor:req.user.id,p_action:'manage',p_id:req.params.id,p_data:{currentHash:req.portalSession.token_hash}}));
 const employee=current.employee;
 const profiles=check(await database.from('profiles').select('id').eq('email',employee.email).eq('status','active').eq('platform_role','user').limit(1));
 const grants=check(await database.from('internal_hr_managers').select('employee_id').eq('employee_id',req.params.id).limit(1));
 const pending=current.requests.some(r=>r.state==='pending');
 const state=grants.length?'already_hr':employee.status!=='active'?'inactive_employee':!profiles.length?'account_required':current.link?.status!=='linked'?(pending?'consent_pending':'consent_required'):'ready';
 const message={
  already_hr:'HR authority is already assigned. Review or revoke it from HR access governance.',
  inactive_employee:'Activate this employee record before granting HR authority.',
  account_required:'No matching active ordinary portal account exists. A roster record is not a login. Complete approved portal account enrollment with this exact work email, then refresh this page. No account, password or email has been created here.',
  consent_pending:'An account-link request is pending. The employee must sign in to their own account, open My employment and accept it using their password (and MFA when enrolled). Refresh after acceptance.',
  consent_required:'Request an account link below. The employee must sign in to their own account and accept it in My employment before the owner can grant HR.',
  ready:'The employee is active and an account link has been accepted. The platform owner can now grant HR; the database rechecks eligibility when saving.'
 }[state];
 return {state,message,canGrant:state==='ready',canRequest:profiles.length>0&&['active','onboarding'].includes(employee.status)&&current.link?.status!=='linked'&&!pending};
}
module.exports={reviewHrAccess};
