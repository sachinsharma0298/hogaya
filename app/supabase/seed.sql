-- Seed: the 10 service categories. No fake people. Safe to run again.
insert into public.categories (id, label, sort) values
  ('electrician', 'Electrician', 1),
  ('plumber', 'Plumber', 2),
  ('ac', 'AC Technician', 3),
  ('pump', 'Water Motor / Pump', 4),
  ('washing_machine', 'Washing Machine Repair', 5),
  ('ro', 'RO / water purifier', 6),
  ('fridge', 'Fridge Repair', 7),
  ('geyser', 'Geyser Repair', 8),
  ('inverter', 'Inverter / battery', 9),
  ('carpenter', 'Carpenter', 10)
on conflict (id) do update set label = excluded.label, sort = excluded.sort;
