const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const {employeeFields,roleFields}=require('../routes/employees');
const sample=()=>({fullName:'Avery Patel',email:'Avery@Example.test',department:'Engineering',
 jobTitle:'Developer',employmentType:'intern',startDate:'2026-11-03'});
test('employee onboarding validates and normalizes only supported fields',()=>{
 const result=employeeFields(sample());
 assert.equal(result.email,'avery@example.test');
 assert.equal(result.fullName,'Avery Patel');
 for(const invalid of [
  {...sample(),role:'super_admin'},
  {...sample(),email:'invalid'},
  {...sample(),fullName:'\u0000malicious'},
  {...sample(),employmentType:'platform_admin'},
  {...sample(),startDate:'2026-02-30'},
  {...sample(),department:''},
  {...sample(),email:'a@b.test',password:'not-permitted'}
 ])assert.throws(()=>employeeFields(invalid));
 const edit={fullName:'Updated',department:'Design',jobTitle:'Designer',employmentType:'part_time',
  startDate:'2026-11-04',status:'on_leave',version:3,confirmed:true};
 assert.equal(employeeFields(edit,{update:true}).status,'on_leave');
 assert.throws(()=>employeeFields({...edit,email:'changed@example.test'},{update:true}));
 assert.throws(()=>employeeFields({...edit,version:1.2},{update:true}));
 assert.throws(()=>employeeFields({...edit,version:2147483648},{update:true}));
 assert.throws(()=>roleFields({version:2147483648,confirmed:true}));
 assert.throws(()=>employeeFields({...edit,confirmed:false},{update:true}));
 assert.deepEqual(roleFields({version:7,confirmed:true}),{version:7,confirmed:true});
 assert.throws(()=>roleFields({version:7,confirmed:true,role:'super_admin'}));
});
test('employee and HR routes are session-backed; HTML and APIs are not static access shortcuts',()=>{
 const server=read('server.js');
 assert.match(server,/app\.use\('\/api\/employees',require\('\.\/routes\/employees'\)\.router\)/);
 assert.match(server,/portalSession,require\('\.\/routes\/employees'\)\.employeePage/);
 assert.match(server,/url\.startsWith\('\/api\/employees'\)/);
 const route=read('routes/employees.js');
 assert.match(route,/check\(await db\(\)\.rpc\('internal_employee_command'/);
 assert.match(route,/Idempotency-Key/);
 assert.match(route,/router\.use\(portalSession\)/);
 const dashboard=read('views/partials/portal-sidebar.html');
 assert.match(dashboard,/id="employeeNavContainer" hidden/);
 const script=read('public/portal-navigation.js');
 assert.match(script,/\/api\/hrms\/access/);
 const overview=read('views/employees.html'),onboarding=read('views/employee-onboarding.html');
 assert.match(overview,/id="employeeRows"/);
 assert.match(overview,/id="hrGovernance"/);
 assert.match(overview,/counts below come from persisted records/);
 assert.match(onboarding,/Nothing is saved until you confirm/);
 assert.match(onboarding,/does not create a portal identity/);
 assert.match(read('public/employees.css'),/#00255A/);
 assert.match(read('public/employees.css'),/#0069C8/);
});
