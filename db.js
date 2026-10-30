const { createClient } = require('@supabase/supabase-js');
function configured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY && process.env.SUPABASE_PUBLISHABLE_KEY &&
    !process.env.SUPABASE_URL.includes('YOUR_PROJECT') &&
    !process.env.SUPABASE_SECRET_KEY.startsWith('YOUR_'));
}
function options() { return {auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}}; }
let admin;
function db() {
  if (!configured()) throw new Error('Configure the Supabase URL, publishable key, and secret key in .env');
  if (!admin) admin = createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,options());
  return admin;
}
function publicAuth() {
  if (!configured()) throw new Error('Supabase is not configured');
  // A fresh client prevents parallel requests from sharing an Auth session in memory.
  return createClient(process.env.SUPABASE_URL,process.env.SUPABASE_PUBLISHABLE_KEY,options());
}
function check({data,error}) { if(error) throw error; return data; }
module.exports = {db,publicAuth,check,configured};
