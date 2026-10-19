-- The operator's display name and phone are kept here (not in profiles), so the operator's number never competes with
-- the same number being used by a Pro or a customer. Empty name = the default shown in the app.
alter table public.settings add column if not exists operator_name text not null default '';
alter table public.settings add column if not exists operator_phone text not null default '';
