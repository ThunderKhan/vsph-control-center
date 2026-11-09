const test=require("node:test");
const assert=require("node:assert/strict");
const {validateCustomApplication}=require("../routes/projects");
const valid=()=>({name:"Hotel guest application",description:"Guest-facing custom app",
  status:"planned",repositoryUrl:"https://github.com/example/guest-app",
  deploymentUrl:"",shared:false});
test("project application metadata is strictly validated independently from reusable products",()=>{
 const result=validateCustomApplication(valid());
 assert.equal(result.name,"Hotel guest application");
 assert.equal(validateCustomApplication({...valid(),name:"  Custom  "}).name,"Custom");
 for(const bad of [
  {...valid(),secret:"abc"},{...valid(),organizationId:"foreign"},
  {...valid(),status:"verified"},{...valid(),shared:"false"},
  {...valid(),name:""},{...valid(),repositoryUrl:"http://example.com"},
  {...valid(),repositoryUrl:"https://alice:password@example.com"},
  {...valid(),deploymentUrl:"https://example.com/?token=secret"},
  {...valid(),deploymentUrl:"https://example.com/#section"},
  {...valid(),deploymentUrl:"javascript:alert(1)"},
  {...valid(),description:"x".repeat(2001)}
 ])assert.throws(()=>validateCustomApplication(bad));
 assert.deepEqual(validateCustomApplication({...valid(),version:2},true).version,2);
 for(const invalidVersion of [-1,0,1.5,"1",2147483647])
  assert.throws(()=>validateCustomApplication({...valid(),version:invalidVersion},true));
});
