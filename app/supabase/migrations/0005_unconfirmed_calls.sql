-- A call whose start we could not confirm ("unconfirmed": Fo may already be phoning) still occupies the single live-call line.
drop index if exists public.one_live_call_at_a_time;
create unique index one_live_call_at_a_time
  on public.calls ((true))
  where not demo and status in ('calling', 'waiting_summary', 'needs_reply', 'unconfirmed');
