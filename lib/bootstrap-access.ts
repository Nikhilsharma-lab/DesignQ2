import { systemSql } from "@/db/system";

export interface InviteContext {
  orgId: string;
  orgName: string;
  email: string;
  role: string;
  invitedBy: string | null;
  invitedByName: string | null;
  acceptedAt: Date | null;
  expiresAt: Date;
}

interface BootstrapOrganizationResult {
  orgId: string;
  profileCreated: boolean;
}

interface AcceptInviteResult {
  orgId: string;
  profileCreated: boolean;
}

export async function getInviteContext(token: string): Promise<InviteContext | null> {
  const rows = await systemSql<InviteContext[]>`
    select
      org_id as "orgId",
      org_name as "orgName",
      email,
      role,
      invited_by as "invitedBy",
      invited_by_name as "invitedByName",
      accepted_at as "acceptedAt",
      expires_at as "expiresAt"
    from public.get_invite_context(${token})
  `;

  return rows[0] ?? null;
}

export async function bootstrapOrganizationMembership(input: {
  userId: string;
  orgName: string;
  slug: string;
  fullName: string;
  email: string;
}): Promise<BootstrapOrganizationResult> {
  const rows = await systemSql<BootstrapOrganizationResult[]>`
    select
      org_id as "orgId",
      profile_created as "profileCreated"
    from public.bootstrap_organization_membership(
      ${input.userId},
      ${input.orgName},
      ${input.slug},
      ${input.fullName},
      ${input.email}
    )
  `;

  return rows[0];
}

export async function acceptInviteMembership(input: {
  token: string;
  userId: string;
  fullName: string;
  email: string;
}): Promise<AcceptInviteResult> {
  const rows = await systemSql<AcceptInviteResult[]>`
    select
      org_id as "orgId",
      profile_created as "profileCreated"
    from public.accept_invite_membership(
      ${input.token},
      ${input.userId},
      ${input.fullName},
      ${input.email}
    )
  `;

  return rows[0];
}
