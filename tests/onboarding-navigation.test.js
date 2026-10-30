const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');

test('main workspace exposes platform-only customer onboarding navigation',()=>{
 const dashboard=read('public/dashboard.html'),script=read('public/dashboard.js');
 const server=read('server.js'),admin=read('public/admin.html');
 assert.match(dashboard,/id="topbarOnboard"[^>]+href="\/admin\/onboarding" hidden/);
 assert.match(dashboard,/id="adminNavContainer" hidden>[\s\S]*?href="\/admin\/onboarding"/);
 assert.match(script,/byId\('topbarOnboard'\)\.hidden = !isPlatformAdmin/);
 assert.match(script,/const isPlatformAdmin = user\.platformRole === 'super_admin'/);
 assert.match(server,/app\.get\(\['\/admin\/onboarding','\/admin\/onboarding\/'\],portalSession,requireAdmin/);
 assert.match(admin,/class="admin-return onboarding-cta" href="\/admin\/onboarding"/);
});

test('central portal login links to invitation help without enabling unsolicited account creation',()=>{
 const login=read('views/auth.html'),script=read('public/auth-page.js');
 assert.match(login,/id="inviteEntry"[^>]+hidden/);
 assert.match(login,/href="\/accept-invite"/);
 assert.match(script,/byId\('inviteEntry'\)\.hidden = false/);
 assert.doesNotMatch(login,/href="\/signup"/);
});

function renderInvitation(hash=''){
 const nodes={};
 for(const id of ['inviteForm','acceptButton','inviteError','inviteSuccess','inviteInstructions','inviteInstructionsText']){
  nodes[id]={hidden:id==='inviteInstructions',disabled:id==='acceptButton',
    textContent:'',listeners:{},addEventListener(type,callback){this.listeners[type]=callback;}};
 }
 const location={pathname:'/accept-invite',hash};
 const history={cleaned:false,replaceState(_state,_title,url){this.cleaned=url==='/accept-invite';}};
 const context={document:{getElementById:id=>nodes[id]},location,history,URLSearchParams,fetch:()=>{throw Error('No network needed for direct landing')},console};
 vm.runInNewContext(read('public/invite.js'),context);
 return {nodes,history};
}
test('invitation help landing without token shows instructions, not a password form',()=>{
 const {nodes,history}=renderInvitation('');
 assert.equal(history.cleaned,true);
 assert.equal(nodes.inviteInstructions.hidden,false);
 assert.equal(nodes.inviteForm.hidden,true);
 assert.equal(nodes.acceptButton.disabled,true);
});
test('expired invitation opens recovery instructions; tokenized link opens activation form',()=>{
 const expired=renderInvitation('#error=access_denied&error_description=Expired');
 assert.equal(expired.nodes.inviteInstructions.hidden,false);
 assert.equal(expired.nodes.inviteForm.hidden,true);
 assert.match(expired.nodes.inviteInstructionsText.textContent,/invalid or expired/);
 const valid=renderInvitation('#access_token=example-token');
 assert.equal(valid.nodes.inviteInstructions.hidden,true);
 assert.equal(valid.nodes.inviteForm.hidden,undefined);
 assert.equal(valid.nodes.acceptButton.disabled,false);
 assert.equal(valid.history.cleaned,true);
});
