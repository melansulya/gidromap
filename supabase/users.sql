-- Run this once in the Supabase SQL editor (Project → SQL Editor → New query).
-- Creates the table used for admin/akim/deputy accounts (src/app/api/auth/login,
-- src/app/api/admin/create-user, src/app/api/admin/users). Previously this table
-- existed only in the live Supabase project with no migration checked into the
-- repo — this file makes the schema reproducible.

create table if not exists users (
  id bigint generated always as identity primary key,
  email text not null unique,
  password_hash text not null,
  name text not null,
  role text not null check (role in ('admin', 'akim', 'deputy')),
  totp_secret text,
  totp_enabled boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists users_email_idx on users (lower(email));

-- 2FA (TOTP): totp_secret stays null until the user finishes setup via
-- /api/auth/2fa/setup + /api/auth/2fa/confirm. totp_enabled gates whether
-- login requires the second step.
alter table users add column if not exists totp_secret text;
alter table users add column if not exists totp_enabled boolean not null default false;
