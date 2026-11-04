const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process'),{normalize}=require('../scripts/migration-eol');
test('LF source policy survives CRLF Git checkout and normalization refuses genuine SQL drift',()=>{
 const taskRoot=fs.mkdtempSync(path.join(os.tmpdir(),'vsph-migration-eol-'));
 try{
  fs.mkdirSync(path.join(taskRoot,'supabase/migrations'),{recursive:true});
  const files=['supabase/schema.sql','supabase/migrations/20260101000000_fixture.sql'],texts=['-- schema\nselect 1;\n','-- Δ fixture\nselect 2;\n'];
  const entries=files.map((file,i)=>({path:file,sha256:crypto.createHash('sha256').update(texts[i]).digest('hex')}));
  const manifest={bootstrap:entries[0],migrations:[entries[1]]};
  fs.writeFileSync(path.join(taskRoot,'supabase/migration-manifest.json'),JSON.stringify(manifest));
  const put=(index,text)=>fs.writeFileSync(path.join(taskRoot,files[index]),text);
  for(let i=0;i<files.length;i++)put(i,texts[i].replace(/\n/g,'\r\n'));
  const before=fs.readFileSync(path.join(taskRoot,files[0]));
  assert.equal(normalize({root:taskRoot}).lineEndingDrift.length,2);assert.ok(fs.readFileSync(path.join(taskRoot,files[0])).equals(before),'Inspection cannot modify source');
  put(1,texts[1]+'-- developer SQL edit\n');
  assert.throws(()=>normalize({root:taskRoot,write:true}),/content differs/);assert.ok(fs.readFileSync(path.join(taskRoot,files[0])).equals(before),'A later semantic edit prevents even an earlier planned normalization');
  put(1,texts[1].replace(/\n/g,'\r\n'));assert.equal(normalize({root:taskRoot,write:true}).written,2);
  for(let i=0;i<files.length;i++)assert.equal(fs.readFileSync(path.join(taskRoot,files[i]),'utf8'),texts[i]);
  assert.equal(normalize({root:taskRoot,write:true}).written,0);
  fs.writeFileSync(path.join(taskRoot,'supabase/migration-manifest.json'),JSON.stringify({...manifest,migrations:[{...entries[1],path:'../outside.sql'}]}));
  assert.throws(()=>normalize({root:taskRoot,write:true}),/Invalid migration entry/);
  // Real Git smudge/checkout under Windows-style autocrlf, without changing the
  // user's Git configuration or repository. No commit identity/network needed.
  fs.copyFileSync(path.join(__dirname,'../.gitattributes'),path.join(taskRoot,'.gitattributes'));
  execFileSync('git',['init','--quiet',taskRoot],{stdio:'pipe'});
  const git=args=>execFileSync('git',['-C',taskRoot,'-c','core.autocrlf=true',...args],{stdio:'pipe'});
  git(['add','--','.gitattributes',...files]);for(let i=0;i<files.length;i++)put(i,texts[i].replace(/\n/g,'\r\n'));
  git(['checkout-index','--force','--',...files]);for(let i=0;i<files.length;i++)assert.equal(fs.readFileSync(path.join(taskRoot,files[i]),'utf8'),texts[i]);
 }finally{fs.rmSync(taskRoot,{recursive:true,force:true,maxRetries:5,retryDelay:50});}
});
