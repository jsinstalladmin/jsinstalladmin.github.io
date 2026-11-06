/* ============================================================
   supa-config.js — where the database is and the key to reach it.

   This key is the PUBLISHABLE key. It is designed to sit in public
   website code. It is safe here because Row Level Security decides
   what it can actually do, and the rules on this database allow it
   exactly one thing: drop a new lead into the leads table. It cannot
   read a lead back, and it cannot see a client, a job, a quote or a
   crew member. Those need a signed-in member of staff.

   The secret key and the database password are a different thing
   entirely and never appear in any file that ships to a browser.
   ============================================================ */
export const SUPA_URL  = 'https://dbcumsbssqjuowioaqqj.supabase.co';
export const SUPA_KEY  = 'sb_publishable_9riphDkD2NNX7wH6693ckQ_Di3ZA5tg';
export const SUPA_REST = SUPA_URL + '/rest/v1';
