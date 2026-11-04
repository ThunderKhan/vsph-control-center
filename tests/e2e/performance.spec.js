const {test,expect}=require('@playwright/test');
const cookie={name:'vsph.portal.sid',value:'fixture-admin-session',url:'http://127.0.0.1:3100',httpOnly:true,sameSite:'Lax'};
test('login and authenticated workspaces load fonts without any third-party network dependency',async({page,context})=>{
 test.skip(!process.env.PROJECT_E2E_DATABASE,'Requires isolated database');const external=[];await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!=='http://127.0.0.1:3100'){external.push(u.origin);return route.abort();}return route.continue();});
 await page.goto('/login');await expect(page.locator('#authForm')).toBeVisible();await context.addCookies([cookie]);
 for(const path of ['/projects','/account/profile','/admin']){await page.goto(path);await page.evaluate(()=>document.fonts.ready);expect(await page.evaluate(()=>[...document.fonts].some(f=>f.family==='Inter'&&f.status==='loaded'))).toBe(true);}
 expect(external).toEqual([]);
});
test('slow HR navigation permissions do not delay owner content',async({page,context})=>{
 test.skip(!process.env.PROJECT_E2E_DATABASE,'Requires isolated database');await context.addCookies([cookie]);let release,started,done,failed,didStart=false;const held=new Promise(r=>{release=r;}),requested=new Promise(r=>{started=r;}),finished=new Promise((r,j)=>{done=r;failed=j;});const handler=async route=>{didStart=true;started();await held;try{await route.continue();done();}catch(e){failed(e);}};await page.route('**/api/hrms/access',handler);
 try{await page.goto('/dashboard');await requested;await expect(page.locator('#ownerOverviewFacts')).toBeVisible();await expect(page.locator('#ownerOperationsStatus')).toHaveText(/Operating records loaded|Some operating sections/);}finally{release();if(didStart)await finished;await page.unroute('**/api/hrms/access',handler);}
});
