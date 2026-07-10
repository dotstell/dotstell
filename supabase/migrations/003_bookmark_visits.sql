-- Track when a bookmark was last visited and how many times
alter table bookmarks add column if not exists last_visited_at timestamptz;
alter table bookmarks add column if not exists visit_count integer default 0;
