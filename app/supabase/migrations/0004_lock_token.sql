-- A tick may only release the lock it took itself (a late, leftover request must never free someone else's lock).
alter table public.requests add column if not exists lock_token text;
