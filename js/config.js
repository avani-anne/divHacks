// Supabase connection. The publishable key is meant to be public: row-level security policies in
// supabase/schema.sql decide what each user can read and write. Never put a secret or
// service_role key here.

const SUPABASE_URL = 'https://ugbbkbgdhdtmubvliese.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Ln54NzXb0Xt1W4LgdtuGuQ_8HUmoH5N';
const GOOGLE_MAPS_API_KEY = '';

// Email links (password reset, sign-up confirmation) come back with details in the URL. Read
// them before the Supabase client consumes and clears them.
const AUTH_REDIRECT = (() => {
  const params = new URLSearchParams(location.hash.slice(1) || location.search.slice(1));
  return {
    type: params.get('type'),                       // 'recovery' for password-reset links
    error: params.get('error_description') || params.get('error'),
    errorCode: params.get('error_code'),
  };
})();

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
