-- RLS baseline for tenant-scoped data.
-- Normal authenticated app requests should set `app.current_user_id` via the
-- server-side DB session helper. Supabase client and Realtime traffic continue
-- to resolve identity from `request.jwt.claim.sub`.
-- Bootstrap flows that run before a profile exists use SECURITY DEFINER
-- functions instead of broad bootstrap policies.

CREATE OR REPLACE FUNCTION public.current_app_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('app.current_user_id', true), '')::uuid,
    NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
  )
$$;

CREATE OR REPLACE FUNCTION public.current_app_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.org_id
  FROM public.profiles p
  WHERE p.id = public.current_app_user_id()
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.role::text
  FROM public.profiles p
  WHERE p.id = public.current_app_user_id()
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_current_org_member(target_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT target_org_id IS NOT NULL
    AND target_org_id = public.current_app_org_id()
$$;

CREATE OR REPLACE FUNCTION public.is_current_org_privileged()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.current_app_role() IN ('lead', 'admin'), false)
$$;

CREATE OR REPLACE FUNCTION public.can_access_request(target_request_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.requests r
    WHERE r.id = target_request_id
      AND public.is_current_org_member(r.org_id)
  )
$$;

CREATE OR REPLACE FUNCTION public.can_access_idea(target_idea_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.ideas i
    WHERE i.id = target_idea_id
      AND public.is_current_org_member(i.org_id)
  )
$$;

CREATE OR REPLACE FUNCTION public.bootstrap_organization_membership(
  target_user_id uuid,
  target_org_name text,
  target_org_slug text,
  target_full_name text,
  target_email text
)
RETURNS TABLE (org_id uuid, profile_created boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_profile public.profiles%ROWTYPE;
  created_org public.organizations%ROWTYPE;
BEGIN
  SELECT *
  INTO existing_profile
  FROM public.profiles
  WHERE id = target_user_id
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT existing_profile.org_id, false;
    RETURN;
  END IF;

  INSERT INTO public.organizations (name, slug)
  VALUES (target_org_name, target_org_slug)
  RETURNING *
  INTO created_org;

  INSERT INTO public.profiles (id, org_id, full_name, email, role)
  VALUES (target_user_id, created_org.id, target_full_name, target_email, 'lead');

  RETURN QUERY SELECT created_org.id, true;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_invite_context(invite_token text)
RETURNS TABLE (
  org_id uuid,
  org_name text,
  email text,
  role text,
  invited_by uuid,
  invited_by_name text,
  accepted_at timestamptz,
  expires_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    i.org_id,
    o.name AS org_name,
    i.email,
    i.role,
    i.invited_by,
    p.full_name AS invited_by_name,
    i.accepted_at,
    i.expires_at
  FROM public.invites i
  JOIN public.organizations o ON o.id = i.org_id
  LEFT JOIN public.profiles p ON p.id = i.invited_by
  WHERE i.token = invite_token
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.accept_invite_membership(
  invite_token text,
  target_user_id uuid,
  target_full_name text,
  target_email text
)
RETURNS TABLE (org_id uuid, profile_created boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invite_row public.invites%ROWTYPE;
  existing_profile public.profiles%ROWTYPE;
  created_profile boolean := false;
BEGIN
  SELECT *
  INTO invite_row
  FROM public.invites
  WHERE token = invite_token
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid invite link';
  END IF;

  IF invite_row.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'This invite has already been used';
  END IF;

  IF now() > invite_row.expires_at THEN
    RAISE EXCEPTION 'This invite has expired. Ask your team lead to send a new one.';
  END IF;

  IF lower(trim(target_email)) <> lower(trim(invite_row.email)) THEN
    RAISE EXCEPTION 'This invite was sent to a different email address';
  END IF;

  SELECT *
  INTO existing_profile
  FROM public.profiles
  WHERE id = target_user_id
  LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO public.profiles (id, org_id, full_name, email, role)
    VALUES (
      target_user_id,
      invite_row.org_id,
      target_full_name,
      target_email,
      invite_row.role::public.role
    );
    created_profile := true;
  END IF;

  UPDATE public.invites
  SET accepted_at = now()
  WHERE id = invite_row.id;

  RETURN QUERY SELECT invite_row.org_id, created_profile;
END;
$$;

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_ai_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.validation_signoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.idea_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.idea_validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.figma_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.impact_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_context_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_handoff_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.figma_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_digests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prediction_confidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.impact_retrospectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proactive_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.morning_briefings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "organizations_select_current_org"
ON public.organizations
FOR SELECT
TO public
USING (id = public.current_app_org_id());

CREATE POLICY "profiles_select_same_org"
ON public.profiles
FOR SELECT
TO public
USING (
  id = public.current_app_user_id()
  OR public.is_current_org_member(org_id)
);

CREATE POLICY "profiles_update_self_or_admin"
ON public.profiles
FOR UPDATE
TO public
USING (
  public.is_current_org_member(org_id)
  AND (id = public.current_app_user_id() OR public.current_app_role() = 'admin')
)
WITH CHECK (
  public.is_current_org_member(org_id)
  AND (id = public.current_app_user_id() OR public.current_app_role() = 'admin')
);

CREATE POLICY "projects_org_access"
ON public.projects
FOR ALL
TO public
USING (public.is_current_org_member(org_id))
WITH CHECK (public.is_current_org_member(org_id));

CREATE POLICY "requests_org_access"
ON public.requests
FOR ALL
TO public
USING (public.is_current_org_member(org_id))
WITH CHECK (public.is_current_org_member(org_id));

CREATE POLICY "request_ai_analysis_request_access"
ON public.request_ai_analysis
FOR ALL
TO public
USING (public.can_access_request(request_id))
WITH CHECK (public.can_access_request(request_id));

CREATE POLICY "comments_request_access"
ON public.comments
FOR ALL
TO public
USING (public.can_access_request(request_id))
WITH CHECK (public.can_access_request(request_id));

CREATE POLICY "assignments_request_access"
ON public.assignments
FOR ALL
TO public
USING (public.can_access_request(request_id))
WITH CHECK (public.can_access_request(request_id));

CREATE POLICY "request_stages_request_access"
ON public.request_stages
FOR ALL
TO public
USING (public.can_access_request(request_id))
WITH CHECK (public.can_access_request(request_id));

CREATE POLICY "validation_signoffs_request_access"
ON public.validation_signoffs
FOR ALL
TO public
USING (public.can_access_request(request_id))
WITH CHECK (public.can_access_request(request_id));

CREATE POLICY "ideas_org_access"
ON public.ideas
FOR ALL
TO public
USING (public.is_current_org_member(org_id))
WITH CHECK (public.is_current_org_member(org_id));

CREATE POLICY "idea_votes_select_org_idea"
ON public.idea_votes
FOR SELECT
TO public
USING (public.can_access_idea(idea_id));

CREATE POLICY "idea_votes_insert_own_vote"
ON public.idea_votes
FOR INSERT
TO public
WITH CHECK (
  public.can_access_idea(idea_id)
  AND voter_id = public.current_app_user_id()
);

CREATE POLICY "idea_votes_update_own_vote"
ON public.idea_votes
FOR UPDATE
TO public
USING (
  public.can_access_idea(idea_id)
  AND voter_id = public.current_app_user_id()
)
WITH CHECK (
  public.can_access_idea(idea_id)
  AND voter_id = public.current_app_user_id()
);

CREATE POLICY "idea_votes_delete_own_vote"
ON public.idea_votes
FOR DELETE
TO public
USING (
  public.can_access_idea(idea_id)
  AND voter_id = public.current_app_user_id()
);

CREATE POLICY "idea_validations_select_org_idea"
ON public.idea_validations
FOR SELECT
TO public
USING (public.can_access_idea(idea_id));

CREATE POLICY "idea_validations_mutate_privileged"
ON public.idea_validations
FOR ALL
TO public
USING (
  public.can_access_idea(idea_id)
  AND public.is_current_org_privileged()
)
WITH CHECK (
  public.can_access_idea(idea_id)
  AND public.is_current_org_privileged()
);

CREATE POLICY "figma_updates_request_access"
ON public.figma_updates
FOR ALL
TO public
USING (public.can_access_request(request_id))
WITH CHECK (public.can_access_request(request_id));

CREATE POLICY "impact_records_request_access"
ON public.impact_records
FOR ALL
TO public
USING (public.can_access_request(request_id))
WITH CHECK (public.can_access_request(request_id));

CREATE POLICY "request_context_briefs_request_access"
ON public.request_context_briefs
FOR ALL
TO public
USING (public.can_access_request(request_id))
WITH CHECK (public.can_access_request(request_id));

CREATE POLICY "request_handoff_briefs_request_access"
ON public.request_handoff_briefs
FOR ALL
TO public
USING (public.can_access_request(request_id))
WITH CHECK (public.can_access_request(request_id));

CREATE POLICY "prediction_confidence_request_access"
ON public.prediction_confidence
FOR ALL
TO public
USING (public.can_access_request(request_id))
WITH CHECK (public.can_access_request(request_id));

CREATE POLICY "impact_retrospectives_request_access"
ON public.impact_retrospectives
FOR ALL
TO public
USING (public.can_access_request(request_id))
WITH CHECK (public.can_access_request(request_id));

CREATE POLICY "figma_connections_privileged_org_access"
ON public.figma_connections
FOR ALL
TO public
USING (
  public.is_current_org_member(org_id)
  AND public.is_current_org_privileged()
)
WITH CHECK (
  public.is_current_org_member(org_id)
  AND public.is_current_org_privileged()
);

CREATE POLICY "weekly_digests_org_select"
ON public.weekly_digests
FOR SELECT
TO public
USING (public.is_current_org_member(org_id));

CREATE POLICY "weekly_digests_privileged_mutation"
ON public.weekly_digests
FOR ALL
TO public
USING (
  public.is_current_org_member(org_id)
  AND public.is_current_org_privileged()
)
WITH CHECK (
  public.is_current_org_member(org_id)
  AND public.is_current_org_privileged()
);

CREATE POLICY "proactive_alerts_recipient_access"
ON public.proactive_alerts
FOR SELECT
TO public
USING (
  public.is_current_org_member(org_id)
  AND recipient_id = public.current_app_user_id()
);

CREATE POLICY "proactive_alerts_recipient_update"
ON public.proactive_alerts
FOR UPDATE
TO public
USING (
  public.is_current_org_member(org_id)
  AND recipient_id = public.current_app_user_id()
)
WITH CHECK (
  public.is_current_org_member(org_id)
  AND recipient_id = public.current_app_user_id()
);

CREATE POLICY "morning_briefings_owner_access"
ON public.morning_briefings
FOR SELECT
TO public
USING (
  public.is_current_org_member(org_id)
  AND user_id = public.current_app_user_id()
);

CREATE POLICY "morning_briefings_owner_update"
ON public.morning_briefings
FOR UPDATE
TO public
USING (
  public.is_current_org_member(org_id)
  AND user_id = public.current_app_user_id()
)
WITH CHECK (
  public.is_current_org_member(org_id)
  AND user_id = public.current_app_user_id()
);

CREATE POLICY "invites_privileged_org_access"
ON public.invites
FOR ALL
TO public
USING (
  public.is_current_org_member(org_id)
  AND public.is_current_org_privileged()
)
WITH CHECK (
  public.is_current_org_member(org_id)
  AND public.is_current_org_privileged()
);
