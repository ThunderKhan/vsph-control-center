const {test,expect}=require('@playwright/test');
test('MFA-enrolled fixture identity requires TOTP before an opaque portal session is created',async({page,context},info)=>{
 test.skip(!process.env.PROJECT_E2E_DATABASE,'Requires isolated database and explicit fake identity provider');
 await page.goto('/login');await page.getByLabel('Work email',{exact:true}).fill('mfa@fixture.test');await page.getByLabel('Password',{exact:true}).fill('fixture-password-only');await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.getByLabel('Authenticator code',{exact:true})).toBeVisible();await expect(page.locator('#authError')).toContainText('enrolled authenticator');expect((await context.cookies()).some(c=>c.name==='vsph.portal.sid')).toBe(false);
 await page.getByLabel('Authenticator code',{exact:true}).fill('000000');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.locator('#authError')).toContainText('verification failed');expect((await context.cookies()).some(c=>c.name==='vsph.portal.sid')).toBe(false);
 await page.getByLabel('Authenticator code',{exact:true}).fill('123456');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page).toHaveURL(/\/dashboard$/);expect((await context.request.get('/api/auth/me')).status()).toBe(200);
 expect(await page.evaluate(()=>Object.keys(localStorage).filter(k=>/token|password|totp/i.test(k)))).toEqual([]);
});

test.describe('native sign-in form fallback',()=>{
 test.use({javaScriptEnabled:false});
 test('credentials are posted in the body even when JavaScript is unavailable',async({page})=>{
  await page.goto('/login');await page.getByLabel('Work email',{exact:true}).fill('native-fallback@fixture.test');await page.getByLabel('Password',{exact:true}).fill('must-not-enter-the-url');
  const pending=page.waitForRequest(r=>new URL(r.url()).pathname==='/api/auth/login');await page.getByRole('button',{name:'Sign in',exact:true}).click();const request=await pending;
  expect(request.method()).toBe('POST');expect(new URL(request.url()).search).toBe('');expect(request.url()).not.toContain('must-not-enter-the-url');expect(request.postData()).toContain('password=must-not-enter-the-url');
 });
});
