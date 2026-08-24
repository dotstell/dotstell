-- Prevent two notebooks with the same name for the same user (slug collision guard)
ALTER TABLE notebooks ADD CONSTRAINT notebooks_user_name_unique UNIQUE (user_id, name);

-- Explicit WITH CHECK makes the INSERT/UPDATE ownership rule unambiguous during audits
DROP POLICY IF EXISTS "Users manage own notebooks" ON notebooks;
CREATE POLICY "Users manage own notebooks" ON notebooks
  FOR ALL
  USING     (auth.uid() = user_id)
  WITH CHECK(auth.uid() = user_id);

-- updated_at trigger (the app-level assignment in PATCH is a fallback; trigger is authoritative)
CREATE TRIGGER notebooks_updated_at
  BEFORE UPDATE ON notebooks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
