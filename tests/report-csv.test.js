const test=require('node:test'),assert=require('node:assert/strict');
const {cell,projectCsv}=require('../services/report-csv');
const {reportQuery}=require('../routes/notifications');
test('CSV quotes fields and neutralizes spreadsheet formulas including whitespace prefixes',()=>{
 for(const value of ['=HYPERLINK("https://example.test")',' +1','-2+3','@SUM(A1)','\t=1','\nformula','\uFEFF=1'])assert.ok(cell(value).startsWith('"\''),JSON.stringify(value));
 assert.equal(cell('plain "quoted", text'),'"plain ""quoted"", text"');assert.equal(cell(-2),'"-2"');assert.equal(cell(null),'""');assert.equal(cell('a\u0000b'),'"ab"');
});
test('project CSV uses allowlisted columns, explicit bounds and source-backed report values',()=>{
 const csv=projectCsv({generatedAt:'2026-11-03T00:00:00Z',deploymentStatus:'unconfigured',projects:[{id:'test',name:'=1+1',completed_tasks:3,total_tasks:5,secret:'NEVER_EXPORT',details:{token:'NEVER_EXPORT'}}]});
 assert.ok(csv.startsWith('\uFEFF"Export scope"'));assert.ok(csv.endsWith('\r\n'));assert.match(csv,/First 100 authorized matching projects/);assert.match(csv,/unconfigured/);assert.match(csv,/"'\=1\+1"/);assert.doesNotMatch(csv,/NEVER_EXPORT|\[object Object\]/);assert.throws(()=>projectCsv({projects:Array(101).fill({})}));
 assert.equal(projectCsv({projects:[]}).split('\r\n').length,2);
});
test('JSON and CSV reports share strict UUID/date/filter validation',()=>{
 assert.deepEqual(reportQuery({status:'active',from:'2026-11-01'}),{projectId:null,data:{status:'active',from:'2026-11-01'}});
 for(const query of [{limit:10000},{from:'2026-02-30'},{from:['2026-11-01']},{from:'2026-11-03',to:'2026-11-01'},{projectId:['bad']},{status:'unknown'},{organizationId:'wrong'}])assert.throws(()=>reportQuery(query));
});
