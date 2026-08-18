-- Add sort_order and pinned to notes
alter table notes
  add column if not exists sort_order integer not null default 0,
  add column if not exists pinned     boolean not null default false;

create index if not exists notes_sort_order_idx on notes (user_id, pinned desc, sort_order asc);
