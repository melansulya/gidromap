-- Run this in the Supabase SQL editor (Project → SQL Editor → New query).
--
-- All app access to `users` and `activity_log` goes through the server-side
-- service_role client (src/lib/supabaseServer.ts), which bypasses RLS entirely.
-- The browser-side anon key (src/lib/supabaseClient.ts) is only used for
-- Supabase Auth calls, never for direct table queries against these tables.
--
-- Enabling RLS with no permissive policies means: if the anon/public key is
-- ever used directly against these tables (now or by future code), it gets
-- nothing back instead of full read/write access. The service_role key is
-- unaffected — it bypasses RLS by design.

alter table users enable row level security;
alter table activity_log enable row level security;

-- No policies are created on purpose: default-deny for anon/authenticated
-- roles. service_role continues to have full access regardless of RLS.
