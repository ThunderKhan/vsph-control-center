// Explicit isolated provider simulation. Never imported by application code.
module.exports=function enrollmentProvider(pool,credentials){
 const users=new Map(),events=[],fail={create:false,password:false,weakPassword:false};
 const admin={
  async getUserById(id){const user=users.get(id);return {data:{user:user||null},error:user?null:{status:404}};},
  async createUser(attributes){events.push('create');if(fail.create)return {data:{user:null},error:{status:503,message:'private provider diagnostic'}};if(users.has(attributes.id))return {data:{user:null},error:{status:422}};
   await pool.query('insert into auth.users(id) values($1)',[attributes.id]);const user={...attributes,email_confirmed_at:null};users.set(user.id,user);return {data:{user},error:null};},
  async updateUserById(id,attributes){events.push('password');if(fail.weakPassword)return {data:{user:null},error:{status:422}};if(fail.password)return {data:{user:null},error:{status:503,message:'private password provider diagnostic'}};if(fail.beforePassword)await fail.beforePassword();const user=users.get(id);if(!user)return {data:{user:null},error:{status:404}};Object.assign(user,attributes,{email_confirmed_at:new Date().toISOString()});return {data:{user},error:null};}
 };
 const factory=()=>{const client=credentials();const original=client.auth.signInWithPassword.bind(client.auth),getUser=client.auth.getUser.bind(client.auth);client.auth.getUser=async()=>{const result=await getUser(),stored=users.get(result.data?.user?.id);if(stored)result.data.user={...result.data.user,app_metadata:stored.app_metadata,email_confirmed_at:stored.email_confirmed_at};return result;};client.auth.signInWithPassword=async input=>{const user=[...users.values()].find(u=>u.email===input.email);if(user){if(!user.email_confirmed_at||input.password!==user.password)return {data:{user:null,session:null},error:{status:400}};return original({...input,password:'fixture-password-only'});}return original(input);};return client;};
 return {auth:{admin},factory,users,events,fail};
};
