-- Pro profile page: working hours, a short bio, and changes to categories / area / visit charge that wait for the operator's approval.
alter table public.providers add column if not exists working_hours text not null default '';
alter table public.providers add column if not exists bio text not null default '';
alter table public.providers add column if not exists pending_changes jsonb;
