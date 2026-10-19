-- One person can hold more than one role on the same phone (operator, approved customer, Pro).
-- Before: approved_numbers allowed only one row per phone, so approving the same number as a Pro overwrote the customer approval.
alter table public.approved_numbers drop constraint if exists approved_numbers_phone_key;
create unique index if not exists approved_numbers_phone_kind_idx on public.approved_numbers (phone, kind);
