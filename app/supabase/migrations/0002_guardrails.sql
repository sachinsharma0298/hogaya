-- D3: live-call guardrails.

-- A customer on the approved list is approved for ONE email + phone pair, so nobody can trigger a call to someone
-- else's number by typing it into a form.
alter table public.approved_numbers add column if not exists email text not null default '';

-- Only ONE live Fo call can be in flight at any moment, enforced by the database itself (not just by our code).
-- A second live call that tries to start while one is running is refused by this index.
create unique index if not exists one_live_call_at_a_time
  on public.calls ((true))
  where not demo and status in ('calling', 'waiting_summary', 'needs_reply');
