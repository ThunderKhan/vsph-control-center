const test=require('node:test'),assert=require('node:assert/strict');
const {stableId,validateState}=require('../services/role-test-accounts');
test('operator account state requires strong private passwords and stable bounded idempotency keys',()=>{
 const state={runId:'01234567-0123-4123-a123-012345678901',startDate:'2026-11-05',passwords:{hr:'h'.repeat(32),employee:'e'.repeat(32),customer:'c'.repeat(32)}};
 validateState(state);assert.equal(stableId(state.runId,'hr'),stableId(state.runId,'hr'));assert.notEqual(stableId(state.runId,'hr'),stableId(state.runId,'employee'));
 for(const bad of [{...state,runId:'bad'},{...state,passwords:{...state.passwords,hr:'fixture-password-only'}},{...state,startDate:'bad'},{...state,startDate:'2026-02-30'}])assert.throws(()=>validateState(bad));
});
