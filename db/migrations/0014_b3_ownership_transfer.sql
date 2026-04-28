-- =========================================================================
-- 0014_b3_ownership_transfer.sql — transfer_workspace_ownership RPC
-- =========================================================================
-- Spec: user-flows-spec.md §4.3 (post spec-patch commit 58db6b7).
--
-- Adds a SECURITY DEFINER RPC for atomic workspace ownership transfer.
-- No schema changes — function-only migration.
--
-- Validation gates (in order):
--   0. demote_current_owner_to must be admin/member/guest
--   1. Workspace must have a current owner
--   2. Caller (auth.uid()) must be the current owner
--   3. New owner must differ from current owner
--   4. New owner must be a workspace member
--
-- Side effects on success:
--   - Current owner's workspace_members row: role = demote target
--   - New owner's workspace_members row: role = 'owner'
--   - organizations.owner_id = new_owner_user_id (mirror invariant #4)
--   - audit_log event_type='ownership.transferred' with event_data
--     { from_user_id, to_user_id, demoted_to }
--
-- Returns: TABLE (success boolean, message text). 2-col shape
-- per spec §4.3 and parking-lot L474 decision.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.transfer_workspace_ownership(
  target_workspace_id uuid,
  new_owner_user_id uuid,
  demote_current_owner_to text DEFAULT 'admin'
)
RETURNS TABLE (success boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_owner_id uuid;
  new_owner_member_exists boolean;
BEGIN
  -- 0. Validate demote target parameter
  -- Reject 'owner' (would be a no-op trap) and any non-enum value.
  -- 'guest' is a valid demotion target per workspace_role enum.
  IF demote_current_owner_to NOT IN ('admin', 'member', 'guest') THEN
    RETURN QUERY SELECT false,
      'Invalid demote target: must be admin, member, or guest';
    RETURN;
  END IF;

  -- 1. Fetch current owner for target workspace
  SELECT user_id INTO current_owner_id
  FROM public.workspace_members
  WHERE workspace_members.workspace_id = target_workspace_id
    AND role = 'owner';

  IF current_owner_id IS NULL THEN
    RETURN QUERY SELECT false, 'Workspace has no current owner';
    RETURN;
  END IF;

  -- 2. Validate caller is the current owner
  IF current_owner_id != auth.uid() THEN
    RETURN QUERY SELECT false,
      'Only the current owner can transfer ownership';
    RETURN;
  END IF;

  -- 3. Reject self-transfer (no-op with confusing audit trail)
  IF current_owner_id = new_owner_user_id THEN
    RETURN QUERY SELECT false, 'New owner is already the current owner';
    RETURN;
  END IF;

  -- 4. Validate new owner is a workspace member
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_members.workspace_id = target_workspace_id
      AND user_id = new_owner_user_id
  ) INTO new_owner_member_exists;

  IF NOT new_owner_member_exists THEN
    RETURN QUERY SELECT false,
      'New owner is not a member of this workspace';
    RETURN;
  END IF;

  -- Atomic ownership swap: demote current owner, promote new owner.
  UPDATE public.workspace_members
  SET role = demote_current_owner_to::public.workspace_role
  WHERE workspace_members.workspace_id = target_workspace_id
    AND user_id = current_owner_id;

  UPDATE public.workspace_members
  SET role = 'owner'::public.workspace_role
  WHERE workspace_members.workspace_id = target_workspace_id
    AND user_id = new_owner_user_id;

  -- Mirror to organizations.owner_id (invariant #4 — two sources, one
  -- truth; legacy field kept until deferred cleanup per §4.4).
  UPDATE public.organizations
  SET owner_id = new_owner_user_id
  WHERE id = target_workspace_id;

  -- Audit log: who transferred what to whom, and how the outgoing
  -- owner was demoted. event_type uses dot-namespaced convention;
  -- event_data uses flat snake_case keys (Pattern ii per B2).
  INSERT INTO public.audit_log (
    workspace_id, actor_user_id, event_type, event_data
  )
  VALUES (
    target_workspace_id,
    auth.uid(),
    'ownership.transferred',
    jsonb_build_object(
      'from_user_id', current_owner_id,
      'to_user_id', new_owner_user_id,
      'demoted_to', demote_current_owner_to
    )
  );

  RETURN QUERY SELECT true, 'Ownership transferred successfully';
END;
$$;
