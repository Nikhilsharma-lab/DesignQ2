-- =========================================================================
-- test_migration_0014.sql — pg-tap assertions for migration 0014
-- =========================================================================
-- Purpose: verify migration 0014_b3_ownership_transfer applied correctly.
-- Covers:
--   Structural: function exists, signature, SECURITY DEFINER flag.
--   Behavioral — validation gates:
--     Gate 0: invalid demote_current_owner_to rejected.
--     Gate 1: workspace with no owner rejected.
--     Gate 2: caller is not current owner rejected.
--     Gate 3: self-transfer rejected.
--     Gate 4: new owner is not a workspace member rejected.
--   Behavioral — happy path:
--     Return value (true, 'Ownership transferred successfully').
--     Old owner demoted to 'admin' (default demote target).
--     New owner promoted to 'owner'.
--     organizations.owner_id mirror update.
--   Behavioral — audit_log:
--     Row created with event_type='ownership.transferred'.
--     event_data has from_user_id/to_user_id/demoted_to keys.
--   Behavioral — demote variations:
--     demote='member' demotes old owner to 'member'.
--     demote='guest' demotes old owner to 'guest'.
--   Invariant: workspace has exactly one owner after transfer.
--
-- Run: npm run test:sql
--
-- Isolation: BEGIN ... ROLLBACK wraps the whole file. Synthetic data
-- seeded per test function with fresh gen_random_uuid() — no cross-test
-- contamination within the file, no effect on lane dev state.
--
-- Composition notes:
--   - 2 direct-helper assertions (#1-2); 15 function-wrapped assertions
--     (#3 plus 9 other test functions) using the CREATE FUNCTION
--     RETURNS SETOF TEXT + RETURN NEXT ok(...) pattern from ccdf703.
--   - auth.uid() simulation via PERFORM set_config('request.jwt.claim.sub',
--     caller_uid::text, true) — matches Supabase's internal auth.uid()
--     implementation (reads from request.jwt.claim.sub session setting).
--   - Gate 0 (invalid demote) and gate 1 (no owner) tests skip seeding
--     because the RPC rejects before touching any rows.
--   - SQL identifiers verified via information_schema probe before
--     composition (PART 5a column-name verification).
--   - Test functions use prefixed local vars (t_owner_id, t_new_owner_id,
--     etc.) to avoid shadowing column names in WHERE clauses.
--   - Assertions 9-14 + 17 share one test function (test_happy_path_and_audit)
--     with 7 RETURN NEXT calls, since they all verify state after the
--     same successful transfer. Reduces redundant seeding.
--   - plan(17).
-- =========================================================================

BEGIN;

SELECT plan(17);

-- =========================================================================
-- 1. Function transfer_workspace_ownership exists in public schema
-- =========================================================================

SELECT has_function(
  'public',
  'transfer_workspace_ownership',
  'transfer_workspace_ownership exists in public schema'
);

-- =========================================================================
-- 2. Function signature is (uuid, uuid, text)
-- =========================================================================

SELECT has_function(
  'public',
  'transfer_workspace_ownership',
  ARRAY['uuid', 'uuid', 'text'],
  'transfer_workspace_ownership signature is (uuid, uuid, text)'
);

-- =========================================================================
-- 3. Function is SECURITY DEFINER
-- =========================================================================

CREATE OR REPLACE FUNCTION test_03_security_definer() RETURNS SETOF TEXT
LANGUAGE plpgsql AS $$
DECLARE
  is_sd boolean;
BEGIN
  SELECT prosecdef INTO is_sd
    FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace
      AND proname = 'transfer_workspace_ownership';
  RETURN NEXT ok(is_sd,
    'transfer_workspace_ownership is SECURITY DEFINER');
END $$;

SELECT * FROM test_03_security_definer();

-- =========================================================================
-- 4. Gate 0: invalid demote_current_owner_to rejected
-- Gate 0 fires before any DB reads — no seed required.
-- =========================================================================

CREATE OR REPLACE FUNCTION test_04_invalid_demote_target() RETURNS SETOF TEXT
LANGUAGE plpgsql AS $$
DECLARE
  result record;
BEGIN
  SELECT * INTO result FROM public.transfer_workspace_ownership(
    gen_random_uuid(),
    gen_random_uuid(),
    'garbage_value'
  );
  RETURN NEXT ok(
    result.success = false
      AND result.message = 'Invalid demote target: must be admin, member, or guest',
    'gate 0 rejects invalid demote_current_owner_to'
  );
END $$;

SELECT * FROM test_04_invalid_demote_target();

-- =========================================================================
-- 5. Gate 1: workspace with no owner rejected
-- Gate 1 fires before caller check — no seed required.
-- =========================================================================

CREATE OR REPLACE FUNCTION test_05_no_owner() RETURNS SETOF TEXT
LANGUAGE plpgsql AS $$
DECLARE
  result record;
BEGIN
  SELECT * INTO result FROM public.transfer_workspace_ownership(
    gen_random_uuid(),
    gen_random_uuid()
  );
  RETURN NEXT ok(
    result.success = false
      AND result.message = 'Workspace has no current owner',
    'gate 1 rejects workspace with no owner'
  );
END $$;

SELECT * FROM test_05_no_owner();

-- =========================================================================
-- 6. Gate 2: caller is not the current owner
-- =========================================================================

CREATE OR REPLACE FUNCTION test_06_caller_not_owner() RETURNS SETOF TEXT
LANGUAGE plpgsql AS $$
DECLARE
  t_owner_id uuid := gen_random_uuid();
  t_attacker_id uuid := gen_random_uuid();
  t_org_id uuid := gen_random_uuid();
  result record;
BEGIN
  INSERT INTO auth.users (id, email) VALUES
    (t_owner_id, 'b3-test-06-owner@example.com'),
    (t_attacker_id, 'b3-test-06-attacker@example.com');
  INSERT INTO public.organizations (id, name, slug, owner_id)
    VALUES (t_org_id, 'Test 06', 'b3-test-06', t_owner_id);
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (t_org_id, t_owner_id, 'owner');

  -- auth.uid() = attacker, NOT owner
  PERFORM set_config('request.jwt.claim.sub', t_attacker_id::text, true);

  SELECT * INTO result FROM public.transfer_workspace_ownership(
    t_org_id, gen_random_uuid()
  );
  RETURN NEXT ok(
    result.success = false
      AND result.message = 'Only the current owner can transfer ownership',
    'gate 2 rejects caller who is not current owner'
  );
END $$;

SELECT * FROM test_06_caller_not_owner();

-- =========================================================================
-- 7. Gate 3: self-transfer rejected
-- =========================================================================

CREATE OR REPLACE FUNCTION test_07_self_transfer() RETURNS SETOF TEXT
LANGUAGE plpgsql AS $$
DECLARE
  t_owner_id uuid := gen_random_uuid();
  t_org_id uuid := gen_random_uuid();
  result record;
BEGIN
  INSERT INTO auth.users (id, email) VALUES
    (t_owner_id, 'b3-test-07@example.com');
  INSERT INTO public.organizations (id, name, slug, owner_id)
    VALUES (t_org_id, 'Test 07', 'b3-test-07', t_owner_id);
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (t_org_id, t_owner_id, 'owner');

  PERFORM set_config('request.jwt.claim.sub', t_owner_id::text, true);

  -- Transfer to self
  SELECT * INTO result FROM public.transfer_workspace_ownership(
    t_org_id, t_owner_id
  );
  RETURN NEXT ok(
    result.success = false
      AND result.message = 'New owner is already the current owner',
    'gate 3 rejects self-transfer'
  );
END $$;

SELECT * FROM test_07_self_transfer();

-- =========================================================================
-- 8. Gate 4: new owner is not a workspace member
-- =========================================================================

CREATE OR REPLACE FUNCTION test_08_new_owner_not_member() RETURNS SETOF TEXT
LANGUAGE plpgsql AS $$
DECLARE
  t_owner_id uuid := gen_random_uuid();
  t_stranger_id uuid := gen_random_uuid();
  t_org_id uuid := gen_random_uuid();
  result record;
BEGIN
  INSERT INTO auth.users (id, email) VALUES
    (t_owner_id, 'b3-test-08-owner@example.com'),
    (t_stranger_id, 'b3-test-08-stranger@example.com');
  INSERT INTO public.organizations (id, name, slug, owner_id)
    VALUES (t_org_id, 'Test 08', 'b3-test-08', t_owner_id);
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (t_org_id, t_owner_id, 'owner');
  -- stranger is NOT a workspace_member

  PERFORM set_config('request.jwt.claim.sub', t_owner_id::text, true);

  SELECT * INTO result FROM public.transfer_workspace_ownership(
    t_org_id, t_stranger_id
  );
  RETURN NEXT ok(
    result.success = false
      AND result.message = 'New owner is not a member of this workspace',
    'gate 4 rejects new owner who is not a workspace member'
  );
END $$;

SELECT * FROM test_08_new_owner_not_member();

-- =========================================================================
-- 9-14 + 17. Happy path + audit_log + invariant — shared seed.
-- =========================================================================

CREATE OR REPLACE FUNCTION test_happy_path_and_audit() RETURNS SETOF TEXT
LANGUAGE plpgsql AS $$
DECLARE
  t_owner_id uuid := gen_random_uuid();
  t_new_owner_id uuid := gen_random_uuid();
  t_org_id uuid := gen_random_uuid();
  result record;
  old_owner_role public.workspace_role;
  new_owner_role public.workspace_role;
  org_owner_id_after uuid;
  audit_count integer;
  audit_event_data jsonb;
  owner_count integer;
BEGIN
  INSERT INTO auth.users (id, email) VALUES
    (t_owner_id, 'b3-test-happy-owner@example.com'),
    (t_new_owner_id, 'b3-test-happy-new@example.com');
  INSERT INTO public.organizations (id, name, slug, owner_id)
    VALUES (t_org_id, 'Test Happy', 'b3-test-happy', t_owner_id);
  INSERT INTO public.workspace_members (workspace_id, user_id, role) VALUES
    (t_org_id, t_owner_id, 'owner'),
    (t_org_id, t_new_owner_id, 'member');

  PERFORM set_config('request.jwt.claim.sub', t_owner_id::text, true);

  SELECT * INTO result FROM public.transfer_workspace_ownership(
    t_org_id, t_new_owner_id
  );

  -- Assertion 9: return value
  RETURN NEXT ok(
    result.success = true
      AND result.message = 'Ownership transferred successfully',
    'happy path returns (true, Ownership transferred successfully)'
  );

  -- Assertion 10: old owner demoted to 'admin' (default)
  SELECT role INTO old_owner_role
    FROM public.workspace_members
    WHERE workspace_members.workspace_id = t_org_id
      AND user_id = t_owner_id;
  RETURN NEXT ok(
    old_owner_role = 'admin'::public.workspace_role,
    'old owner demoted to admin (default demote target)'
  );

  -- Assertion 11: new owner promoted to 'owner'
  SELECT role INTO new_owner_role
    FROM public.workspace_members
    WHERE workspace_members.workspace_id = t_org_id
      AND user_id = t_new_owner_id;
  RETURN NEXT ok(
    new_owner_role = 'owner'::public.workspace_role,
    'new owner promoted to owner'
  );

  -- Assertion 12: organizations.owner_id mirror
  SELECT owner_id INTO org_owner_id_after
    FROM public.organizations
    WHERE id = t_org_id;
  RETURN NEXT ok(
    org_owner_id_after = t_new_owner_id,
    'organizations.owner_id updated to new owner (mirror invariant #4)'
  );

  -- Assertion 13: audit_log row count
  SELECT count(*) INTO audit_count
    FROM public.audit_log
    WHERE audit_log.workspace_id = t_org_id
      AND event_type = 'ownership.transferred';
  RETURN NEXT ok(
    audit_count = 1,
    'audit_log row created with event_type=ownership.transferred'
  );

  -- Assertion 14: event_data keys/values
  SELECT event_data INTO audit_event_data
    FROM public.audit_log
    WHERE audit_log.workspace_id = t_org_id
      AND event_type = 'ownership.transferred'
    LIMIT 1;
  RETURN NEXT ok(
    (audit_event_data->>'from_user_id')::uuid = t_owner_id
      AND (audit_event_data->>'to_user_id')::uuid = t_new_owner_id
      AND audit_event_data->>'demoted_to' = 'admin',
    'audit_log event_data has from_user_id/to_user_id/demoted_to keys'
  );

  -- Assertion 17: workspace has exactly one owner after transfer
  SELECT count(*) INTO owner_count
    FROM public.workspace_members
    WHERE workspace_members.workspace_id = t_org_id
      AND role = 'owner';
  RETURN NEXT ok(
    owner_count = 1,
    'workspace has exactly one owner after transfer (invariant #2)'
  );
END $$;

SELECT * FROM test_happy_path_and_audit();

-- =========================================================================
-- 15. demote_current_owner_to='member' demotes old owner to 'member'
-- =========================================================================

CREATE OR REPLACE FUNCTION test_15_demote_to_member() RETURNS SETOF TEXT
LANGUAGE plpgsql AS $$
DECLARE
  t_owner_id uuid := gen_random_uuid();
  t_new_owner_id uuid := gen_random_uuid();
  t_org_id uuid := gen_random_uuid();
  result record;
  old_owner_role public.workspace_role;
BEGIN
  INSERT INTO auth.users (id, email) VALUES
    (t_owner_id, 'b3-test-15-owner@example.com'),
    (t_new_owner_id, 'b3-test-15-new@example.com');
  INSERT INTO public.organizations (id, name, slug, owner_id)
    VALUES (t_org_id, 'Test 15', 'b3-test-15', t_owner_id);
  INSERT INTO public.workspace_members (workspace_id, user_id, role) VALUES
    (t_org_id, t_owner_id, 'owner'),
    (t_org_id, t_new_owner_id, 'member');

  PERFORM set_config('request.jwt.claim.sub', t_owner_id::text, true);

  SELECT * INTO result FROM public.transfer_workspace_ownership(
    t_org_id, t_new_owner_id, 'member'
  );

  SELECT role INTO old_owner_role
    FROM public.workspace_members
    WHERE workspace_members.workspace_id = t_org_id
      AND user_id = t_owner_id;

  RETURN NEXT ok(
    result.success = true
      AND old_owner_role = 'member'::public.workspace_role,
    'demote_current_owner_to=member demotes old owner to member'
  );
END $$;

SELECT * FROM test_15_demote_to_member();

-- =========================================================================
-- 16. demote_current_owner_to='guest' demotes old owner to 'guest'
-- =========================================================================

CREATE OR REPLACE FUNCTION test_16_demote_to_guest() RETURNS SETOF TEXT
LANGUAGE plpgsql AS $$
DECLARE
  t_owner_id uuid := gen_random_uuid();
  t_new_owner_id uuid := gen_random_uuid();
  t_org_id uuid := gen_random_uuid();
  result record;
  old_owner_role public.workspace_role;
BEGIN
  INSERT INTO auth.users (id, email) VALUES
    (t_owner_id, 'b3-test-16-owner@example.com'),
    (t_new_owner_id, 'b3-test-16-new@example.com');
  INSERT INTO public.organizations (id, name, slug, owner_id)
    VALUES (t_org_id, 'Test 16', 'b3-test-16', t_owner_id);
  INSERT INTO public.workspace_members (workspace_id, user_id, role) VALUES
    (t_org_id, t_owner_id, 'owner'),
    (t_org_id, t_new_owner_id, 'member');

  PERFORM set_config('request.jwt.claim.sub', t_owner_id::text, true);

  SELECT * INTO result FROM public.transfer_workspace_ownership(
    t_org_id, t_new_owner_id, 'guest'
  );

  SELECT role INTO old_owner_role
    FROM public.workspace_members
    WHERE workspace_members.workspace_id = t_org_id
      AND user_id = t_owner_id;

  RETURN NEXT ok(
    result.success = true
      AND old_owner_role = 'guest'::public.workspace_role,
    'demote_current_owner_to=guest demotes old owner to guest'
  );
END $$;

SELECT * FROM test_16_demote_to_guest();

-- =========================================================================
SELECT * FROM finish();
ROLLBACK;
