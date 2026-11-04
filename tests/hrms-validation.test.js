const test=require('node:test'),assert=require('node:assert/strict'),{validate}=require('../routes/hrms');
test('HRMS field allowlists reject role escalation, foreign ownership and forged timestamps',()=>{
 assert.deepEqual(validate('task',{version:1,status:'in_progress'}),{version:1,status:'in_progress'});
 for(const fields of [{employeeId:'other'},{platformRole:'super_admin'},{checkedInAt:'2026-01-01'},{currentHash:'forged'}])assert.throws(()=>validate('in',fields));
 assert.throws(()=>validate('task',{version:1,status:'cancelled'}));assert.throws(()=>validate('review',{version:1,decision:'approved',note:'',confirmed:false}));
 assert.throws(()=>validate('leave',{startOn:'2026-02-30',endOn:'2026-03-01',kind:'annual',reason:'Test'}));
 assert.throws(()=>validate('incomplete',{version:1,note:'short',confirmed:true}));
});
