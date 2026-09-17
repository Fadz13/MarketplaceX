-- =============================================================================
-- Migration: Create avatars storage bucket + RLS policies
--
-- Creates a public `avatars` bucket for user profile/avatar images.
-- Enforces user-scoped ownership via deterministic object paths:
--   {public.users.id}/avatar.{ext}
--
-- Uses rls_user_id() which maps auth.uid() -> public.users.id.
-- Policies:
--   1. Public read (anyone can view avatars)
--   2. Authenticated insert (own path only)
--   3. Authenticated update (own path only)
--   4. Authenticated delete (own path only)
--
-- Idempotent: bucket creation ignores duplicates, policies are dropped
-- before recreation.
-- =============================================================================

-- ── 0. Create the avatars bucket (public, idempotent) ─────────────────────
-- Direct INSERT to avoid version-specific storage.create_bucket signature.
INSERT INTO storage.buckets (id, name, owner, public, created_at, updated_at)
VALUES ('avatars', 'avatars', NULL, true, now(), now())
ON CONFLICT (id) DO UPDATE
  SET public = true, updated_at = now();

-- ── 1. Drop existing avatars policies (idempotent) ───────────────────────
DROP POLICY IF EXISTS avatars_public_read ON storage.objects;
DROP POLICY IF EXISTS avatars_insert_own ON storage.objects;
DROP POLICY IF EXISTS avatars_update_own ON storage.objects;
DROP POLICY IF EXISTS avatars_delete_own ON storage.objects;

-- ── 2. SELECT: Public read for all avatars ────────────────────────────────
CREATE POLICY avatars_public_read ON storage.objects
  FOR SELECT
  USING (bucket_id = 'avatars');

-- ── 3. INSERT: Authenticated user can upload to own path only ─────────────
-- Path convention: {public.users.id}/avatar.{ext}
-- split_part(name, '/', 1) extracts the user ID from the object path.
-- rls_user_id() returns the current caller's public.users.id.
CREATE POLICY avatars_insert_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND split_part(name, '/', 1) = rls_user_id()::text
  );

-- ── 4. UPDATE: Authenticated user can update own avatar only ──────────────
CREATE POLICY avatars_update_own ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND split_part(name, '/', 1) = rls_user_id()::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND split_part(name, '/', 1) = rls_user_id()::text
  );

-- ── 5. DELETE: Authenticated user can delete own avatar only ──────────────
CREATE POLICY avatars_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND split_part(name, '/', 1) = rls_user_id()::text
  );
