const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
const flush=()=>new Promise(setImmediate);
const operating=n=>({customers:{status:'ready',total:n,active:n,suspended:0},delivery:{status:'unavailable'},workforce:{status:'unavailable'},products:{status:'unavailable'}});
const finance={currency:'INR',basis:'manual_cash_receipts',asOf:'2026-11-04',summary:{invoicedPaise:'0',collectedPaise:'0',outstandingPaise:'0',pastDuePaise:'0',issuedInvoices:0,voidInvoices:0,clients:0,projects:0},monthly:[6,7,8,9,10,11].map(m=>({month_start:'2026-'+String(m).padStart(2,'0')+'-01',collected_paise:'0'}))};
function mount(fetch){
 const nodes=new Map();const element=()=>({textContent:'',hidden:false,dataset:{},style:{},events:{},append(){},replaceChildren(){},setAttribute(){},addEventListener(name,fn){this.events[name]=fn;}});
 const document={documentElement:{dataset:{}},getElementById(id){if(!nodes.has(id))nodes.set(id,element());return nodes.get(id);},createElement:element};
 const window={location:{pathname:'/dashboard',replace(){}}};
 vm.runInNewContext(fs.readFileSync('public/owner-overview.js','utf8'),{window,document,fetch,AbortController,setTimeout,clearTimeout,Intl,Date,BigInt});
 window.VSPHOwnerOverview.activate();return {nodes};
}
test('an operating body arriving after finance denial cannot redraw cleared privileged facts',async()=>{
 const body=deferred(),balance=deferred();
 const {nodes}=mount(url=>url.includes('admin-management')?Promise.resolve({status:200,ok:true,json:()=>body.promise}):balance.promise);
 await flush();balance.resolve({status:403,ok:false});await flush();
 assert.equal(nodes.get('ownerActiveCustomers').textContent,'—');
 body.resolve(operating(5));await flush();
 assert.equal(nodes.get('ownerActiveCustomers').textContent,'—');
 assert.match(nodes.get('ownerOperationsStatus').textContent,/access is no longer available/);
});
test('an older response body cannot overwrite the next completed operating refresh',async()=>{
 const old=deferred();let count=0;
 const {nodes}=mount(url=>Promise.resolve(url.includes('admin-management')?{status:200,ok:true,json:()=>++count===1?old.promise:Promise.resolve(operating(5))}:{status:200,ok:true,json:async()=>finance}));
 await flush();await nodes.get('ownerOverviewRefresh').events.click();await flush();
 assert.equal(nodes.get('ownerActiveCustomers').textContent,'5');
 old.resolve(operating(87));await flush();
 assert.equal(nodes.get('ownerActiveCustomers').textContent,'5');
});
