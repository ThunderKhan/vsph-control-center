// The session-bound RPC owns counts, allowlists and the coherent DB snapshot.
// Preserve route-level owner authorization and the post-read privilege fence.
async function ownerDashboard(client,actor,currentHash) {
 if(!actor||!currentHash){const e=Error('Current owner session required');e.code='42501';throw e;}
 const {data,error}=await client.rpc('owner_dashboard_snapshot',{p_actor:actor,p_action:'get',p_id:null,p_data:{currentHash}});
 if(error)throw error;
 return data;
}
module.exports={ownerDashboard};
