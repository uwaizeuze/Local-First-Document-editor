-- Row Level Security policies for local-first document editor
-- Run after drizzle migrations: psql $DATABASE_URL -f drizzle/rls.sql

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_snapshots ENABLE ROW LEVEL SECURITY;

-- Helper: current app user id from session variable
-- Application sets: SET LOCAL app.current_user_id = '<uuid>';

CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION app_user_has_document_access(
  doc_id uuid,
  min_role text DEFAULT 'viewer'
) RETURNS boolean AS $$
DECLARE
  user_role text;
  role_rank int;
  min_rank int;
BEGIN
  IF app_current_user_id() IS NULL THEN
    RETURN false;
  END IF;

  SELECT dm.role::text INTO user_role
  FROM document_members dm
  WHERE dm.document_id = doc_id AND dm.user_id = app_current_user_id();

  IF user_role IS NULL THEN
    RETURN false;
  END IF;

  role_rank := CASE user_role
    WHEN 'owner' THEN 3
    WHEN 'editor' THEN 2
    WHEN 'viewer' THEN 1
    ELSE 0
  END;

  min_rank := CASE min_role
    WHEN 'owner' THEN 3
    WHEN 'editor' THEN 2
    WHEN 'viewer' THEN 1
    ELSE 0
  END;

  RETURN role_rank >= min_rank;
END;
$$ LANGUAGE plpgsql STABLE;

-- Users: read/update own profile only
CREATE POLICY users_select_own ON users
  FOR SELECT USING (id = app_current_user_id());

CREATE POLICY users_update_own ON users
  FOR UPDATE USING (id = app_current_user_id());

-- Documents: members can read; editors+ can update; owners can delete
CREATE POLICY documents_select ON documents
  FOR SELECT USING (app_user_has_document_access(id, 'viewer'));

CREATE POLICY documents_insert ON documents
  FOR INSERT WITH CHECK (owner_id = app_current_user_id());

CREATE POLICY documents_update ON documents
  FOR UPDATE USING (app_user_has_document_access(id, 'editor'));

CREATE POLICY documents_delete ON documents
  FOR DELETE USING (app_user_has_document_access(id, 'owner'));

-- Document members
CREATE POLICY document_members_select ON document_members
  FOR SELECT USING (app_user_has_document_access(document_id, 'viewer'));

CREATE POLICY document_members_manage ON document_members
  FOR ALL USING (app_user_has_document_access(document_id, 'owner'));

-- Document updates: viewers read; editors write
CREATE POLICY document_updates_select ON document_updates
  FOR SELECT USING (app_user_has_document_access(document_id, 'viewer'));

CREATE POLICY document_updates_insert ON document_updates
  FOR INSERT WITH CHECK (app_user_has_document_access(document_id, 'editor'));

-- Snapshots: viewers read; editors create
CREATE POLICY document_snapshots_select ON document_snapshots
  FOR SELECT USING (app_user_has_document_access(document_id, 'viewer'));

CREATE POLICY document_snapshots_insert ON document_snapshots
  FOR INSERT WITH CHECK (app_user_has_document_access(document_id, 'editor'));

CREATE POLICY document_snapshots_delete ON document_snapshots
  FOR DELETE USING (app_user_has_document_access(document_id, 'owner'));
