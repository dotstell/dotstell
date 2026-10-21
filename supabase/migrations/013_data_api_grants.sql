-- ============================================================
-- DATA API GRANTS (migration 013)
-- From 30 Oct 2026 Supabase no longer gives the API roles access to new tables in "public" automatically. Projects
-- that exist already keep the access they have; a new project, a preview branch or a local `supabase db reset` starts
-- with none, and every request then fails with "permission denied". These grants make the access explicit.
-- Row-level security still decides which rows each user sees; the signed-in role gets no more than before, and
-- anonymous visitors get nothing. dotstell itself never uses the service role; it is granted so Supabase's own
-- tools and a self-hoster's scripts keep working as they did.
-- Safe to run more than once.
-- ============================================================
grant select, insert, update, delete
  on public.notes, public.people, public.bookmarks, public.tasks, public.notebooks, public.knowledge_links
  to authenticated;
grant select, insert, update, delete
  on public.notes, public.people, public.bookmarks, public.tasks, public.notebooks, public.knowledge_links
  to service_role;
