const {uuid}=require('./rpc');
const {IdentityError}=require('./verify-identity');
class SetupError extends Error{}
function options(args){
 const result={};
 if(args.length===1&&args[0]==='--help')return {help:true};
 const fields={'--project-ref':'projectRef','--owner-email':'ownerEmail','--factor-id':'factorId'};
 for(let n=0;n<args.length;n+=2){const key=fields[args[n]],value=args[n+1];if(!Object.hasOwn(fields,args[n])||!key||!value||result[key]!==undefined)throw new SetupError('Use --project-ref PROJECT_REF, optionally --owner-email EMAIL and --factor-id UUID.');result[key]=value;}
 if(!/^[a-z]{20}$/.test(result.projectRef||''))throw new SetupError('An explicit valid --project-ref is required.');
 if(result.ownerEmail!==undefined){if(result.ownerEmail.length>190||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.ownerEmail))throw new SetupError('Provide a valid --owner-email.');result.ownerEmail=result.ownerEmail.toLowerCase();}
 if(result.factorId!==undefined&&!uuid(result.factorId))throw new SetupError('Provide a valid --factor-id UUID.');
 return result;
}
function boundedFetch(fetcher,timeoutMs=15000){
 return (url,init={})=>{const caller=init.signal??(url instanceof Request?url.signal:null);return fetcher(url,{...init,redirect:'error',signal:AbortSignal.any([...(caller?[caller]:[]),AbortSignal.timeout(timeoutMs)])});};
}
function failureMessage(error,stage){
 const known=error instanceof SetupError||error instanceof IdentityError;
 const codes={'42501':'Current permission or consent is unavailable. Review access before retrying.','40001':'A record changed concurrently. Refresh its governance state before retrying.','23505':'A record conflicts with existing data. Keep the private file and review the collision.','PGRST202':'A required database function is missing. Review migration readiness before retrying.','PGRST205':'A required database table is missing. Review migration readiness before retrying.','EEXIST':'Another setup process or its lock exists. Confirm that it has stopped before removing setup.lock.','ENOENT':'A required local file or tool is missing. Review the private directory and Windows tooling.'};
 return 'Account setup stopped at '+stage+': '+(known?error.message:codes[error?.code]||'A provider, database or filesystem dependency failed. No provider details or credentials were printed. Keep the private file and retry after recovery.');
}
module.exports={SetupError,options,boundedFetch,failureMessage};
