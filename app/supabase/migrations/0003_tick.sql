-- D4: serverless autopilot. A "tick" moves one booking one short step forward; nothing runs for minutes inside a request.

-- A booking is locked while a tick works on it, so two ticks never act on the same booking at once.
-- The lock expires on its own (so a crashed tick never blocks a booking forever).
alter table public.requests add column if not exists lock_until timestamptz;

-- Where a call is in its short-step life (for example: how many Fo messages existed when we started waiting for the summary).
alter table public.calls add column if not exists meta jsonb not null default '{}';
