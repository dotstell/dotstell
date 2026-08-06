-- Sub-notes: notes can have a parent note
alter table notes
  add column if not exists parent_id uuid references notes(id) on delete cascade;

create index if not exists notes_parent_id_idx on notes(parent_id);
