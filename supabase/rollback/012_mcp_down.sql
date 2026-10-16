-- Undoes supabase/migrations/012_mcp.sql. Removes only what that migration created: the MCP token tables and the
-- mcp_* functions. Notes, tasks, people and every other table are not touched. Tokens already issued stop working.
-- Safe to run more than once.

drop function if exists public.mcp_get_person(text, uuid);
drop function if exists public.mcp_list_people(text, text, int);
drop function if exists public.mcp_list_meetings(text, int);
drop function if exists public.mcp_list_tasks(text, text, timestamptz, int);
drop function if exists public.mcp_recent_notes(text, int);
drop function if exists public.mcp_get_note(text, uuid);
drop function if exists public.mcp_search_notes(text, text, int);
drop function if exists public.mcp_check_token(text);
drop function if exists public.mcp_resolve(text, text);

drop table if exists public.mcp_token_events;
drop table if exists public.mcp_tokens;

-- The pgcrypto extension is left in place: other things may use it.
