/* ============================================================
   supa.js — the connection to the office database.

   Everything the business owns lives in Postgres now, not in this
   browser. That means it is the same on his Mac, his phone and the
   office computer, it survives clearing browsing data, and there is
   nothing to remember to back up.

   Nobody gets in without signing in. The database refuses to show a
   single client, job, quote or crew member to an unauthenticated
   request, and public sign-ups are turned off, so the only accounts
   that exist are the ones created by hand in the Supabase dashboard.
   ============================================================ */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.47.10/+esm';
import { SUPA_URL, SUPA_KEY } from '../assets/js/supa-config.js';

export const sb = createClient(SUPA_URL, SUPA_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'js_closets_auth' }
});

export async function currentUser(){
  const { data } = await sb.auth.getSession();
  return data?.session?.user || null;
}
export async function signIn(email, password){
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if(error) throw error;
  return data.user;
}
export const signOut = () => sb.auth.signOut();

/* Turn whatever Supabase threw into something a person can act on. */
export function readable(err){
  const m = String(err?.message || err || '').toLowerCase();
  if(m.includes('invalid login')) return 'That email and password do not match an account.';
  if(m.includes('email not confirmed')) return 'That account has not been confirmed yet. In Supabase, open Authentication, Users, and confirm it.';
  if(m.includes('failed to fetch') || m.includes('networkerror'))
    return 'Cannot reach the database. Check the internet connection and try again.';
  if(m.includes('jwt') || m.includes('expired')) return 'The session expired. Sign in again.';
  return err?.message || 'Something went wrong.';
}
