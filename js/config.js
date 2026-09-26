// Supabase connection. The publishable key is meant to be public: row-level security policies in
// supabase/schema.sql decide what each user can read and write. Never put a secret or
// service_role key here.

const SUPABASE_URL = 'https://ugbbkbgdhdtmubvliese.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Ln54NzXb0Xt1W4LgdtuGuQ_8HUmoH5N';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
