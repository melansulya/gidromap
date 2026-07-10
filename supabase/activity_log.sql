-- Run this once in the Supabase SQL editor (Project → SQL Editor → New query).
-- Creates the table used to log logins, AI chat queries, and hydropost/water-object views
-- so the admin panel can show activity history and usage stats.

create table if not exists activity_log (
  id bigint generated always as identity primary key,
  user_email text not null,
  user_name text,
  user_role text,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists activity_log_created_at_idx on activity_log (created_at desc);
create index if not exists activity_log_email_idx on activity_log (user_email);
create index if not exists activity_log_action_idx on activity_log (action);
