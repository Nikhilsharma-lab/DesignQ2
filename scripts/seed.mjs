/**
 * Seed script — creates demo org, users, requests, triage, assignments, comments
 *
 * Usage:
 *   node scripts/seed.mjs
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local to create auth users.
 * All seed users get password: seed1234
 *
 * Safe to run multiple times — skips if seed org already exists.
 */

import postgres from "postgres";
import { readFileSync } from "fs";
import { randomUUID } from "crypto";

// ── Load env ──────────────────────────────────────────────────────────────────
const env = readFileSync(".env.local", "utf8");
for (const line of env.split("\n")) {
  const [key, ...rest] = line.split("=");
  if (key && rest.length) process.env[key.trim()] = rest.join("=").trim();
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error(`
❌  SUPABASE_SERVICE_ROLE_KEY not found in .env.local

Add it from: Supabase dashboard → Project Settings → API → service_role key
Then re-run this script.
`);
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { prepare: false });

// ── Helpers ───────────────────────────────────────────────────────────────────
async function createAuthUser(email, fullName) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({
      email,
      password: "seed1234",
      email_confirm: true,
      user_metadata: { full_name: fullName },
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    // If user already exists, fetch them
    if (err.msg?.includes("already been registered") || err.code === "email_exists") {
      const listRes = await fetch(
        `${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
        {
          headers: {
            Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
            apikey: SERVICE_ROLE_KEY,
          },
        }
      );
      const list = await listRes.json();
      const existing = list.users?.find((u) => u.email === email);
      if (existing) return existing.id;
      throw new Error(`Could not find existing user for ${email}`);
    }
    throw new Error(`Auth API error for ${email}: ${JSON.stringify(err)}`);
  }
  const user = await res.json();
  return user.id;
}

function ago(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function future(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

// ── Seed data definitions ─────────────────────────────────────────────────────
const ORG_SLUG = "acme-demo";

const USERS = [
  { email: "priya@acme-demo.io",  fullName: "Priya Sharma",    role: "admin"    },
  { email: "marcus@acme-demo.io", fullName: "Marcus Johnson",  role: "pm"       },
  { email: "sarah@acme-demo.io",  fullName: "Sarah Chen",      role: "pm"       },
  { email: "alex@acme-demo.io",   fullName: "Alex Rivera",     role: "designer" },
  { email: "jordan@acme-demo.io", fullName: "Jordan Kim",      role: "developer"},
];

// Rich request fixtures — all statuses, types, priorities
const REQUEST_FIXTURES = [
  {
    title: "Redesign checkout flow to reduce drop-off",
    description: "Users are abandoning checkout at the payment step. We need a streamlined single-page checkout that reduces cognitive load and surface friction points.",
    businessContext: "Checkout completion rate is 61% vs 78% industry benchmark. Each 1% improvement = ~$40k ARR.",
    successMetrics: "Checkout completion rate ≥ 72% within 30 days post-launch",
    status: "shipped",
    stage: "impact",
    priority: "p0",
    complexity: 4,
    requestType: "feature",
    impactMetric: "Checkout completion rate",
    impactPrediction: "8% improvement to ~69%",
    impactActual: "Completion rate increased to 71.3% (+10.3pp)",
    requesterKey: "marcus",
    assigneeKey: "alex",
    assigneeRole: "lead",
    createdDaysAgo: 45,
    qualityScore: 88,
    qualityFlags: [],
    summary: "High-priority UX overhaul for checkout funnel with clear business case.",
    reasoning: "Strong business context, measurable success criteria, complexity aligns with P0 urgency.",
    suggestions: ["Add A/B test plan to success metrics", "Consider mobile-specific flow"],
  },
  {
    title: "Empty state designs for all dashboard views",
    description: "The dashboard has no empty states — new users see broken layouts with no guidance. Need empty states for: request list, team page, and analytics.",
    businessContext: "New user activation rate is low (38%). Empty states are a key onboarding friction point.",
    successMetrics: "New user 7-day activation ≥ 50%",
    status: "in_review",
    stage: "validate",
    priority: "p1",
    complexity: 2,
    requestType: "feature",
    requesterKey: "sarah",
    assigneeKey: "alex",
    assigneeRole: "lead",
    createdDaysAgo: 12,
    qualityScore: 82,
    qualityFlags: [],
    summary: "Quick-win UX polish for new user onboarding.",
    reasoning: "Clear scope, good business rationale, low complexity fits P1.",
    suggestions: ["Define copy for each empty state as part of the spec"],
  },
  {
    title: "Mobile responsiveness audit + fixes",
    description: "Several pages break on mobile. Specifically: request detail sidebar overlaps content, form inputs don't handle keyboard push-up, team cards wrap incorrectly.",
    businessContext: "23% of traffic is mobile. Design team uses iPads in review meetings.",
    successMetrics: "Zero Lighthouse mobile layout shift warnings on key pages",
    status: "assigned",
    stage: "shape",
    priority: "p1",
    complexity: 3,
    requestType: "bug",
    requesterKey: "jordan",
    assigneeKey: "priya",
    assigneeRole: "lead",
    createdDaysAgo: 8,
    qualityScore: 75,
    qualityFlags: ["Missing reproduction steps"],
    summary: "Mobile layout bug fix across multiple views.",
    reasoning: "Bug type with business impact justifies P1; complexity 3 for multi-page scope.",
    suggestions: ["Document specific breakpoints that fail", "Add before/after screenshots to spec"],
  },
  {
    title: "Request submission form — AI pre-fill from description",
    description: "When a PM types a description, Claude should pre-fill business context and success metrics fields based on what's written. Reduces form completion time.",
    businessContext: "Form completion rate is 64%. PMs say filling context fields feels redundant.",
    successMetrics: "Form completion rate ≥ 80%, AI pre-fill acceptance rate ≥ 60%",
    status: "in_progress",
    stage: "explore",
    priority: "p1",
    complexity: 3,
    requestType: "feature",
    impactMetric: "Form completion rate",
    impactPrediction: "16pp improvement to ~80%",
    requesterKey: "marcus",
    assigneeKey: "alex",
    assigneeRole: "lead",
    createdDaysAgo: 18,
    qualityScore: 91,
    qualityFlags: [],
    summary: "AI-assisted form fill to reduce PM friction at intake.",
    reasoning: "Excellent business context and measurable metrics. High confidence in complexity estimate.",
    suggestions: [],
  },
  {
    title: "Design system token documentation page",
    description: "We need a living doc page showing all our design tokens — colors, spacing, typography. Should pull from Figma variables and be auto-updated.",
    status: "triaged",
    stage: "context",
    priority: "p2",
    complexity: 3,
    requestType: "process",
    requesterKey: "priya",
    createdDaysAgo: 5,
    qualityScore: 65,
    qualityFlags: ["No success metrics", "Scope unclear"],
    summary: "Design token documentation — useful but underspecified.",
    reasoning: "Good idea but missing owner, success criteria, and clear delivery format.",
    suggestions: [
      "Define who the audience is (PMs? Devs? Designers?)",
      "Add success metric (e.g. reduction in Figma questions in Slack)",
      "Specify whether this is a Figma page, Notion doc, or web page",
    ],
  },
  {
    title: "Notification preferences page",
    description: "Users can't control which emails they receive. Need a preferences page with toggles for: assignment notifications, comment mentions, weekly digest.",
    businessContext: "Increasing unsubscribe rate on transactional emails (14%). Users complain they get too many.",
    successMetrics: "Email unsubscribe rate < 5%",
    status: "submitted",
    stage: "intake",
    priority: null,
    complexity: null,
    requestType: null,
    requesterKey: "sarah",
    createdDaysAgo: 2,
    qualityScore: null,
  },
  {
    title: "Bulk request status update",
    description: "Designers need to update multiple request statuses at once — right now they have to open each request individually. Add checkbox selection + bulk action bar.",
    status: "triaged",
    stage: "context",
    priority: "p2",
    complexity: 2,
    requestType: "feature",
    requesterKey: "jordan",
    createdDaysAgo: 7,
    qualityScore: 70,
    qualityFlags: ["No business impact stated"],
    summary: "Productivity feature for designers managing multiple requests.",
    reasoning: "Common power-user workflow, low complexity.",
    suggestions: ["Add rollback / undo to the bulk action for safety"],
  },
  {
    title: "Analytics dashboard — request volume & cycle time",
    description: "Leadership wants visibility into: how many requests per week, average time from submitted to shipped, and which PMs submit the most vs. highest quality requests.",
    businessContext: "Design team is asking for headcount. Need data to make the case.",
    successMetrics: "Head of Design can pull weekly report in < 2 minutes",
    status: "in_progress",
    stage: "build",
    priority: "p1",
    complexity: 5,
    requestType: "feature",
    impactMetric: "Time to generate weekly design report",
    impactPrediction: "From 30 min manual → 2 min self-serve",
    requesterKey: "priya",
    assigneeKey: "alex",
    assigneeRole: "lead",
    createdDaysAgo: 22,
    qualityScore: 94,
    qualityFlags: [],
    summary: "High-value analytics feature for design ops visibility.",
    reasoning: "Excellent spec — clear audience, use case, and measurable outcome. Complexity 5 is appropriate.",
    suggestions: [],
  },
  {
    title: "Figma plugin — submit request directly from Figma",
    description: "Designers reviewing work in Figma should be able to submit a design request without leaving Figma. Pre-populate title and Figma URL automatically.",
    businessContext: "65% of requests originate from a Figma review session.",
    successMetrics: "20% of requests submitted via Figma plugin within 60 days",
    status: "triaged",
    stage: "bet",
    priority: "p1",
    complexity: 4,
    requestType: "feature",
    requesterKey: "marcus",
    createdDaysAgo: 14,
    qualityScore: 85,
    qualityFlags: [],
    summary: "Figma plugin to reduce context switching for request submission.",
    reasoning: "Strong adoption metric, good business context. Complexity 4 for cross-platform plugin work.",
    suggestions: ["Define auth handoff between Figma plugin and web app"],
  },
  {
    title: "Request template library",
    description: "Allow PMs to save and reuse request templates for common request types (e.g. 'Landing page redesign', 'A/B test spec'). Should be org-level shared templates.",
    status: "draft",
    stage: "intake",
    priority: null,
    complexity: null,
    requestType: null,
    requesterKey: "sarah",
    createdDaysAgo: 1,
    qualityScore: null,
  },
  {
    title: "Dark/light mode toggle",
    description: "Some users want a light mode option. Add a toggle to user preferences that switches the UI between dark (current) and light themes.",
    status: "completed",
    stage: "impact",
    priority: "p3",
    complexity: 2,
    requestType: "feature",
    requesterKey: "jordan",
    assigneeKey: "alex",
    assigneeRole: "lead",
    createdDaysAgo: 60,
    qualityScore: 55,
    qualityFlags: ["Low business impact", "No success metric"],
    summary: "UI polish request — low priority cosmetic feature.",
    reasoning: "Valid request but low business impact. P3 appropriate.",
    suggestions: ["Consider deferring to post-MVP to focus on higher-impact items"],
  },
  {
    title: "Onboarding checklist for new team members",
    description: "New team members don't know what to do after signing up. Need an interactive checklist (invite your team, submit your first request, assign a designer) visible until completed.",
    businessContext: "Day-1 activation (submitting first request) is 29%. Industry benchmark is 60%.",
    successMetrics: "Day-1 activation ≥ 55% within 30 days",
    status: "blocked",
    stage: "shape",
    priority: "p0",
    complexity: 3,
    requestType: "feature",
    requesterKey: "marcus",
    assigneeKey: "priya",
    assigneeRole: "lead",
    createdDaysAgo: 30,
    qualityScore: 90,
    qualityFlags: [],
    summary: "Critical onboarding feature directly tied to activation rate.",
    reasoning: "P0 justified by large gap to benchmark. Clear metrics, well-scoped.",
    suggestions: [],
  },
];

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🌱 Starting seed...\n");

  // Check if already seeded
  const existing = await sql`SELECT id FROM organizations WHERE slug = ${ORG_SLUG} LIMIT 1`;
  if (existing.length > 0) {
    console.log(`⚡ Seed org "${ORG_SLUG}" already exists — skipping org/user creation.`);
    console.log("   Delete the org from Supabase to re-seed from scratch.\n");
    await sql.end();
    return;
  }

  // 1. Create org
  const [org] = await sql`
    INSERT INTO organizations (name, slug, plan)
    VALUES ('Acme Design Co', ${ORG_SLUG}, 'pro')
    RETURNING id
  `;
  console.log(`✓ Created org: Acme Design Co (${org.id})`);

  // 2. Create auth users + profiles
  const userMap = {}; // key → { id, role }
  for (const u of USERS) {
    const key = u.email.split("@")[0];
    try {
      const authId = await createAuthUser(u.email, u.fullName);
      await sql`
        INSERT INTO profiles (id, org_id, full_name, email, role)
        VALUES (${authId}, ${org.id}, ${u.fullName}, ${u.email}, ${u.role})
        ON CONFLICT (id) DO UPDATE SET org_id = ${org.id}, role = ${u.role}
      `;
      userMap[key] = { id: authId, role: u.role };
      console.log(`✓ User: ${u.fullName} (${u.role}) — ${u.email}`);
    } catch (err) {
      console.error(`✗ Failed to create user ${u.email}:`, err.message);
      process.exit(1);
    }
  }

  console.log("");

  // 3. Create requests + triage + assignments + comments
  for (const fixture of REQUEST_FIXTURES) {
    const requesterId = userMap[fixture.requesterKey].id;
    const createdAt = new Date(Date.now() - fixture.createdDaysAgo * 86_400_000).toISOString();

    const [req] = await sql`
      INSERT INTO requests (
        org_id, requester_id, title, description,
        business_context, success_metrics,
        status, stage, priority, complexity, request_type,
        figma_url, impact_metric, impact_prediction, impact_actual,
        created_at, updated_at
      ) VALUES (
        ${org.id}, ${requesterId}, ${fixture.title}, ${fixture.description},
        ${fixture.businessContext ?? null}, ${fixture.successMetrics ?? null},
        ${fixture.status}, ${fixture.stage},
        ${fixture.priority ?? null}, ${fixture.complexity ?? null}, ${fixture.requestType ?? null},
        ${fixture.figmaUrl ?? null},
        ${fixture.impactMetric ?? null}, ${fixture.impactPrediction ?? null}, ${fixture.impactActual ?? null},
        ${createdAt}, ${createdAt}
      )
      RETURNING id
    `;

    // AI triage row (only for triaged+ requests)
    if (fixture.qualityScore !== null && fixture.qualityScore !== undefined) {
      await sql`
        INSERT INTO request_ai_analysis (
          request_id, priority, complexity, request_type,
          quality_score, quality_flags, summary, reasoning, suggestions,
          potential_duplicates, ai_model, tokens_used
        ) VALUES (
          ${req.id},
          ${fixture.priority}, ${fixture.complexity}, ${fixture.requestType},
          ${fixture.qualityScore}, ${JSON.stringify(fixture.qualityFlags ?? [])},
          ${fixture.summary}, ${fixture.reasoning},
          ${JSON.stringify(fixture.suggestions ?? [])},
          ${JSON.stringify([])},
          ${"claude-3-5-haiku-20241022"}, ${Math.floor(800 + Math.random() * 400)}
        )
      `;
    }

    // Assignment (for assigned+ requests)
    if (fixture.assigneeKey) {
      const assigneeId = userMap[fixture.assigneeKey].id;
      const assignedById = requesterId;
      await sql`
        INSERT INTO assignments (request_id, assignee_id, assigned_by_id, role)
        VALUES (${req.id}, ${assigneeId}, ${assignedById}, ${fixture.assigneeRole ?? "lead"})
      `;
    }

    // System comment for blocked requests
    if (fixture.status === "blocked") {
      await sql`
        INSERT INTO comments (request_id, author_id, body, is_system)
        VALUES (
          ${req.id}, ${requesterId},
          ${"Blocked: waiting on brand guidelines update from marketing before proceeding with visual design."},
          false
        )
      `;
    }

    // System comment for shipped requests
    if (fixture.status === "shipped" || fixture.status === "completed") {
      await sql`
        INSERT INTO comments (request_id, author_id, body, is_system)
        VALUES (
          ${req.id}, null,
          ${"✓ Marked as shipped. Impact will be tracked for 30 days."},
          true
        )
      `;
    }

    const badge = {
      shipped: "✅", completed: "✅", in_progress: "🔨", in_review: "👀",
      assigned: "📋", triaged: "🔍", submitted: "📬", blocked: "🚫", draft: "📝",
    }[fixture.status] ?? "•";
    console.log(`${badge} [${fixture.priority ?? "  --"}] ${fixture.status.padEnd(12)} — ${fixture.title.slice(0, 55)}`);
  }

  console.log(`
✅ Seed complete!

Org:      Acme Design Co  (slug: ${ORG_SLUG})
Users:    5 team members  (password: seed1234)
Requests: ${REQUEST_FIXTURES.length} across all statuses

Login at: /login
  priya@acme-demo.io   — Lead
  marcus@acme-demo.io  — PM
  sarah@acme-demo.io   — PM
  alex@acme-demo.io    — Designer
  jordan@acme-demo.io  — Developer
`);

  await sql.end();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
