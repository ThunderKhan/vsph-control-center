// Isolated history only. All invoices void and all receipts reversed, so these
// rows never manufacture billed/collected cash for the existing ledger journeys.
module.exports=async(pool,owner)=>{
 const org='dadadada-1111-4111-8111-111111111111',project='dadadada-2222-4222-8222-222222222222';
 await pool.query("insert into organizations(id,name,slug,status) values($1,'Journal Historical Customer','journal-historical-fixture','suspended')",[org]);
 await pool.query("insert into projects(id,key,name,kind,customer_organization_id,owner_id,created_by) values($1,'JOURNAL-FIXTURE','Journal Historical Project','customer',$2,$3,$3)",[project,org,owner]);
 await pool.query(`insert into finance_invoices(idempotency_key,request_hash,reference,organization_id,project_id,amount_paise,issued_on,due_on,created_by,created_at,status,voided_at,void_reason)
  select gen_random_uuid(),md5(g::text),'JOURNAL-E2E-'||lpad(g::text,3,'0'),$1,$2,101,'2025-01-01','2025-01-31',$3,'2025-01-01T00:00:00Z'::timestamptz+(g/2)*interval '1 microsecond','void','2025-02-01','Synthetic historical invoice' from generate_series(1,61) g`,[org,project,owner]);
 await pool.query(`insert into finance_payments(idempotency_key,request_hash,invoice_id,reference,amount_paise,received_on,recorded_at,recorded_by)
  select gen_random_uuid(),md5(reference),id,'RECEIPT-'||reference,101,'2025-01-06',created_at,$1 from finance_invoices where organization_id=$2`,[owner,org]);
 await pool.query(`insert into finance_payment_reversals(payment_id,reason,reversed_by) select p.id,'Synthetic historical receipt',$1 from finance_payments p join finance_invoices i on i.id=p.invoice_id where i.organization_id=$2`,[owner,org]);
};
