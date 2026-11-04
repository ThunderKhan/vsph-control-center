// Existing FK supplies the current profile in the same PostgREST statement.
// Keep this projection bounded; never return password/Auth metadata or every profile field.
module.exports={PORTAL_SESSION_FIELDS:'token_hash,user_id,expires_at,profile:profiles!inner(id,full_name,email,status,platform_role)'};
