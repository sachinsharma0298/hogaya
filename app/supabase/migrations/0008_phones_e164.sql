-- Every stored phone number becomes E.164 (+<country code><number>). Bare 10-digit numbers are Indian (+91).
-- Safe to run twice. Empty values and local test numbers ("dev-...") are left alone.
create or replace function pg_temp.e164(p text) returns text language sql immutable as $$
  select case
    when p is null or p = '' or p like 'dev-%' then p
    else case
      when d ~ '^[0-9]{10}$' then '+91' || d
      when d ~ '^91[0-9]{10}$' then '+' || d
      when d ~ '^0[0-9]{10}$' then '+91' || substr(d, 2)
      else d
    end
  end
  from (select regexp_replace(p, '[^0-9+]', '', 'g') as d) x
$$;
update public.approved_numbers set phone = pg_temp.e164(phone) where phone is distinct from pg_temp.e164(phone);
update public.providers set phone = pg_temp.e164(phone) where phone is distinct from pg_temp.e164(phone);
update public.profiles set phone = pg_temp.e164(phone) where phone is distinct from pg_temp.e164(phone);
update public.request_private set customer_phone = pg_temp.e164(customer_phone) where customer_phone is distinct from pg_temp.e164(customer_phone);
update public.consents set phone = pg_temp.e164(phone) where phone is distinct from pg_temp.e164(phone);
update public.settings set operator_phone = pg_temp.e164(operator_phone) where operator_phone is distinct from pg_temp.e164(operator_phone);
