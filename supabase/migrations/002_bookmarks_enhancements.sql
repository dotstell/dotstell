-- Add reading_time and hostname columns to bookmarks
alter table bookmarks add column if not exists reading_time integer;
alter table bookmarks add column if not exists hostname text;

-- Add unique constraint for bulk import dedup (user_id + url)
alter table bookmarks drop constraint if exists bookmarks_user_url_unique;
alter table bookmarks add constraint bookmarks_user_url_unique unique (user_id, url);
