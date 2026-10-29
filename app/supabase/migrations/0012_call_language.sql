-- Preferred call language per person: 'english' or 'hindi'. NULL = never chosen, so the first call asks "Hindi or English?".
alter table public.profiles add column if not exists call_lang text check (call_lang in ('english', 'hindi'));
alter table public.providers add column if not exists call_lang text check (call_lang in ('english', 'hindi'));
alter table public.pending_pros add column if not exists call_lang text check (call_lang in ('english', 'hindi'));
