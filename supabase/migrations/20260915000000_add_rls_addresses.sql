-- =============================================================================
-- Migration: Add RLS policies + GRANTs for public.addresses
--
-- Problem: RLS is enabled on addresses but 'authenticated' role has no
-- SELECT/INSERT/UPDATE/DELETE privileges. RLS policies are only evaluated
-- AFTER base table privileges are granted. Without GRANTs, all queries
-- return "permission denied" regardless of policy definitions.
--
-- Uses rls_user_id() helper which maps auth.uid() -> public.users.id
-- to match addresses.user_id (FK to public.users.id).
--
-- Idempotent: drops existing policies before creating.
-- =============================================================================

-- ── 0. Grant base table privileges to authenticated role ───────────────────
-- RLS policies restrict WHICH rows; GRANTs restrict WHICH operations.
-- Both are needed. Without these GRANTs, PostgREST returns "permission denied"
-- before RLS is even evaluated.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.addresses TO authenticated;
GRANT SELECT ON public.addresses TO anon;

-- ── 1. Drop ALL existing policies (idempotent) ────────────────────────────
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'addresses' AND schemaname = 'public'
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(pol.policyname) || ' ON public.addresses';
  END LOOP;
END
$$;

-- ── 2. SELECT: Authenticated user can read own addresses ───────────────────
CREATE POLICY addresses_select_own ON public.addresses
  FOR SELECT TO authenticated
  USING (user_id = rls_user_id());

-- ── 3. INSERT: Authenticated user can create addresses for themselves ──────
-- WITH CHECK prevents spoofing user_id to another user's ID
CREATE POLICY addresses_insert_own ON public.addresses
  FOR INSERT TO authenticated
  WITH CHECK (user_id = rls_user_id());

-- ── 4. UPDATE: Authenticated user can update own addresses ─────────────────
-- Both USING and WITH CHECK ensure user_id stays as own
CREATE POLICY addresses_update_own ON public.addresses
  FOR UPDATE TO authenticated
  USING (user_id = rls_user_id())
  WITH CHECK (user_id = rls_user_id());

-- ── 5. DELETE: Authenticated user can delete own addresses ─────────────────
CREATE POLICY addresses_delete_own ON public.addresses
  FOR DELETE TO authenticated
  USING (user_id = rls_user_id());
