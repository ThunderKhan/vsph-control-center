const {defineConfig,devices}=require('@playwright/test');
module.exports=defineConfig({
 testDir:'./tests/e2e', fullyParallel:true, forbidOnly:Boolean(process.env.CI), retries:process.env.CI?1:0,
 reporter:[['list'],['html',{open:'never'}]],
 use:{baseURL:'http://127.0.0.1:3100',trace:'retain-on-failure',screenshot:'only-on-failure'},
 projects:[{name:'desktop',use:{...devices['Desktop Chrome']}},{name:'mobile',use:{...devices['iPhone 13'],defaultBrowserType:'chromium'}}],
 webServer:{command:process.env.PROJECT_E2E_DATABASE?'node tests/e2e/fixture-server.js':'node server.js',url:'http://127.0.0.1:3100/login',reuseExistingServer:false,
  env:{PORT:'3100',PUBLIC_ORIGIN:'http://127.0.0.1:3100',NODE_ENV:'test',SUPABASE_URL:'',SUPABASE_SECRET_KEY:'',SUPABASE_PUBLISHABLE_KEY:''}},
});
