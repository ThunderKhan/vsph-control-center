const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
const rpcRoute=fn=>async(req,res,next)=>{try{const data=await fn(req,res);if(!res.headersSent)res.json(data)}catch(e){
 const status={'42501':403,'P0002':404,'23505':409,'40001':409,'22023':400,'22P02':400,'22007':400,'23514':400,'23503':400}[e.code];
 if(status)return res.status(status).json({message:status===409?'Conflict: reload and reconcile the current state.':status===403?'Access denied or invitation unavailable.':'Invalid request or unavailable record.'});
 if(e.validation)return res.status(400).json({message:e.message});next(e);
}};
module.exports={uuid,rpcRoute};
