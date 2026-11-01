const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('Music public preview is a separate labeled destination, never an SSO redirect',()=>{
 const dashboard=read('public/dashboard.js');
 assert.match(dashboard,/https:\/\/vsph-music-system\.vercel\.app\//);
 assert.match(dashboard,/View deployed Music demo/);
 assert.match(dashboard,/preview\.target = '_blank'/);
 assert.match(dashboard,/preview\.rel = 'noopener noreferrer'/);
 assert.match(dashboard,/link\.href = '\/apps\/' \+ code\.toLowerCase\(\) \+ '\/launch'/);
 assert.doesNotMatch(dashboard,/link\.href = 'https:\/\/vsph-music-system/);
});
test('Music role codes are available only for the Music product',()=>{
 const admin=read('public/admin.html');
 const js=read('public/admin.js');
 const migration=read('supabase/migrations/20261030_music_staff_musician_roles.sql');
 assert.match(admin,/value="staff" data-music-only disabled hidden/);
 assert.match(admin,/value="musician" data-music-only disabled hidden/);
 assert.match(js,/function syncMusicRoleOptions/);
 assert.match(js,/app\.code==='MUSIC'/);
 assert.match(migration,/where public\.applications\.code='MUSIC'/);
 assert.match(migration,/add constraint app_roles_code_check/);
});
test('SSO remains disabled without a verified receiver and separate confidential configuration',()=>{
 const server=read('server.js');
 const cfg=read('integration/sso-config.js');
 assert.match(server,/if\(application\.code!=='MUSIC' \|\| !musicConfig\(\)\)/);
 assert.match(cfg,/if \(!\[MUSIC_SSO_START_URL,MUSIC_SSO_CALLBACK_URL,MUSIC_SSO_CLIENT_SECRET\]\.some\(Boolean\)\) return null/);
 assert.doesNotThrow(()=>new Function(read('public/dashboard.js')));
 assert.doesNotThrow(()=>new Function(read('public/admin.js')));
});
