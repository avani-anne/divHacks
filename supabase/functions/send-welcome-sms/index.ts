// Supabase Edge Function: sends the "you're signed up for text alerts" SMS through Twilio.
//
// Called from the Community → Volunteer tab with the signed-in user's session. The Twilio
// credentials live in Edge Function secrets, never in the website:
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER (e.g. +15551234567)
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided automatically.

import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const MAX_TEXTS_PER_DAY = 3;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

// US numbers only: accepts (212) 555-0100, 212-555-0100, +1 212 555 0100, etc.
function toE164(raw: string): string | null {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // Who is asking? (Supabase also verifies the JWT before the function runs.)
  const auth = req.headers.get('Authorization') || '';
  const asUser = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: { user } } = await asUser.auth.getUser();
  if (!user) return json({ error: 'Please log in first.' }, 401);

  const { phone, zip } = await req.json().catch(() => ({}));
  const to = toE164(phone);
  if (!to) return json({ error: 'Enter a 10-digit US phone number.' }, 400);
  if (!/^\d{5}$/.test(String(zip || ''))) return json({ error: 'Pick a ZIP code first.' }, 400);

  // Rate limit per account so the feature can't be used to spam someone's phone.
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await admin.from('sms_log').select('id', { count: 'exact', head: true })
    .eq('user_id', user.id).gte('sent_at', since);
  if ((count ?? 0) >= MAX_TEXTS_PER_DAY) return json({ error: 'Too many texts today. Try again tomorrow.' }, 429);

  const sid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const token = Deno.env.get('TWILIO_AUTH_TOKEN');
  const from = Deno.env.get('TWILIO_FROM_NUMBER');
  if (!sid || !token || !from) return json({ error: 'Text alerts aren\'t set up yet (missing Twilio secrets).' }, 503);

  const body = `Thank you for signing up for notifications for Greenify NYC. You are entered for ZIP code ${zip}. Reply STOP to unsubscribe.`;
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }),
  });
  const result = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('Twilio error', result);
    // 21608: trial accounts can only text numbers verified in the Twilio console.
    const msg = result?.code === 21608
      ? 'This Twilio trial account can only text verified numbers. Verify this number in Twilio first.'
      : result?.message || 'The text could not be sent.';
    return json({ error: msg }, 502);
  }

  await admin.from('sms_log').insert({ user_id: user.id, phone_last4: to.slice(-4), zip, twilio_sid: result.sid });
  return json({ ok: true, to: `•••-•••-${to.slice(-4)}` });
});
