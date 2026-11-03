const {test,expect}=require('@playwright/test');
test('public login renders and protected navigation returns to login',async({page,request},testInfo)=>{
 await page.goto('/login');
 await expect(page.locator('input[type="email"]')).toBeVisible();
 await expect(page.locator('input[type="password"]')).toBeVisible();
 await expect(page.locator('.auth-intro h1')).toHaveText("Building What's Next.");
 const screenshot=testInfo.outputPath('login.jpg');
 await page.screenshot({path:screenshot,fullPage:true,type:'jpeg',quality:80});
 await testInfo.attach('Public login',{path:screenshot,contentType:'image/jpeg'});
 for(const route of ['/dashboard','/applications','/admin','/admin/onboarding','/projects','/search','/apps/music/home']){
  await page.goto(route); await expect(page).toHaveURL(/\/login$/);
 }
 const denied=await request.get('/api/auth/me');expect(denied.status()).toBe(401);
 expect(denied.headers()['cache-control']).toContain('no-store');
});
test('invite landing contains no authenticated workspace',async({page})=>{
 await page.goto('/accept-invite');
 await expect(page.locator('body')).toContainText(/invitation|password/i);
 await expect(page.locator('body')).not.toContainText('Platform administration');
});
