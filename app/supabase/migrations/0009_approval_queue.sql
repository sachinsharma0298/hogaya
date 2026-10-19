-- Approval queue. Customers: profiles.review is 'pending' until the operator approves (adds to the approved list) or rejects (stays in preview).
-- Pros: a sign-up lands in pending_pros and is never matched or called until the operator approves it (which then creates the real Pro).
alter table public.profiles add column if not exists review text not null default 'pending' check (review in ('pending', 'approved', 'rejected'));
update public.profiles set review = 'approved' where role <> 'customer' and review = 'pending';

create table if not exists public.pending_pros (
  id text primary key,
  name text not null,
  email text not null,
  phone text not null,
  categories text[] not null,
  area text not null default '',
  visit_charge text not null default '',
  consent_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);
-- Server only, like the approved list: no policy and no privileges for the browser roles.
alter table public.pending_pros enable row level security;
revoke all on public.pending_pros from anon, authenticated;
