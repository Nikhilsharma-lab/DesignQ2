# Lane — Deferred Features & Future Build Log

---

## PRE-LAUNCH KILLER FEATURES (build before launch, in this order)

Agreed 2026-04-02. No hard deadline — launch when all 7 are done.

### Approach 3 — Speed + Visibility (build first)
- [x] **Speed Layer** — Cmd+K command palette, J/K navigation, Cmd+N quick capture, optimistic UI ✅ Built 2026-04-02
- [x] **Design Radar** — live designer status (in flow/idle/blocked), phase heat map, risk panel, shipped this week ✅ Built 2026-04-02
- [x] **AI Context Brief** — auto-generated brief when designer opens a request (what PM means, related past work, constraints, questions to ask) ✅ Built 2026-04-03

### Approach 1 — Make Design Visible (build second)
- [x] **Handoff Intelligence** — AI handoff brief, Figma drift alert, handoff quality score per designer ✅ Built 2026-04-03
- [x] **Impact Intelligence** — prediction confidence score before betting, Design ROI by type, "what we learned" retrospective brief ✅ Built 2026-04-04

### Approach 2 — AI Does the Work (build third)
- [ ] **Proactive Alerts** — AI-decided push alerts for Design Head (stalls, overdue sign-offs, blocked designers)
- [ ] **AI Pre-flight Check** — PM impact prediction rated by AI before submission, quality score before triage

### Additional (added post-roadmap, now built)
- [x] **Dev Board (KF8)** — `/dashboard/dev`, full dev kanban with drag-and-drop, slide-over detail, Design QA gate ✅ Built
- [x] **Projects (KF9)** — project switcher, per-project scoping of radar/digest/calibration ✅ Built

### Plane-Inspired Features (built 2026-04-10)
- [x] **Intake Split-Pane** — dedicated `/dashboard/intake` triage UI with sidebar list + detail panel, accept/decline/snooze/duplicate actions ✅
- [x] **Power K Command Palette** — two-key keyboard shortcuts (G+R, N+R, etc.), enhanced cmdk palette with navigation/creation/request groups ✅
- [x] **Filter Chips** — URL-param backed applied filter chips on request list with clear all ✅
- [x] **Rich Empty States** — contextual warm copy across all views matching Lane's tone ✅
- [x] **Snooze / Defer** — date-based snooze with presets + auto-resurface cron job (daily 9 AM) ✅
- [x] **Stickies + Reflections** — unified floating capture pad (FAB), stickies panel, optional request linking, private by default ✅
- [x] **Notification Preferences** — per-category × per-channel (in-app + email) toggle grid at `/settings/notifications` ✅
- [x] **Appetite-Based Cycles** — project-level cycles with appetite bar, aggregate throughput, one active per project ✅
- [x] **Initiatives** — cross-project request grouping, requests can belong to 1 project + N initiatives ✅
- [x] **Team-Level Analytics** — pipeline chart, flow rate, cycle throughput (aggregate only, never per-designer) ✅
- [x] **Request Timeline** — per-request activity log with actor, action, timestamps in detail dock Timeline tab ✅
- [x] **Per-Iteration Commenting** — iterations in diverge/converge stages with threaded comments ✅
- [x] **Published Views** — shareable views with authenticated or public link access modes ✅
- [x] **Dashboard Polish** — welcome greeting, briefing refresh button, dismiss all alerts, sidebar nav updates ✅

---

Everything here was intentionally skipped during the current sprint.
Nothing here is abandoned — it's queued. Pick up items in priority order.

Last updated: April 10, 2026

---

## Priority 0 — Build Immediately (before first customer)

### RLS Policies (Security — BLOCKING)
**Why urgent:** All data is org-scoped in app code, but there's no DB-level enforcement. A crafted request could leak cross-org data. Must ship before any real user touches the product.

**What to build:**
- RLS policies on ALL tables: `requests`, `stickies`, `notification_preferences`, `activity_log`, `cycles`, `cycle_requests`, `initiatives`, `initiative_requests`, `iterations`, `iteration_comments`, `published_views`, `validations`, `assignments`, `comments`, `ideas`, `impact_records`, `figma_connections`, `figma_updates`
- Pattern: `auth.uid()` → join to `profiles.id` → check `profiles.org_id` matches row's `org_id`
- Stickies: additional policy — only author can read/write (privacy)
- Published views with `access_mode = 'public'`: allow anonymous SELECT when valid `public_token` matches
- Enable RLS on each table (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`)
- Test: create two test orgs, verify cross-org queries return empty

### Redis Rate Limiting (AI abuse prevention — BLOCKING)
**Why urgent:** AI routes call Claude API which costs money. No rate limiting = one bad actor burns through your Anthropic credits.

**What to build:**
- Add Upstash Redis (`@upstash/ratelimit` + `@upstash/redis`)
- Rate limit these routes: `/api/requests/triage`, `/api/requests/[id]/context-brief`, `/api/requests/[id]/handoff-brief`, `/api/ideas/validate`, `/api/morning-briefing`
- Limits: 10 req/min per user for AI routes, 60 req/min for non-AI
- Env vars: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- Return 429 with friendly message when rate limited

### Design Frame Creation (Week 5-6 gap)
**Why:** The Frame stage in the design phase has no dedicated UI yet. Designers need a structured form to articulate the problem, success criteria, and constraints — this is the "north star" referenced in all subsequent stages.

**What to build:**
- Structured form in the Frame stage panel: Problem (designer's words), Success criteria, Constraints, Divergence from PM brief (optional)
- AI comparison widget: PM's original problem ↔ Designer's frame, with highlighted differences
- Save as a `design_frames` record (may need new schema table or store as JSON on request)

---

## Priority 1 — Build Next (Month 1–2)

### Figma OAuth
**Status: IN PROGRESS** — spec written at `docs/superpowers/specs/2026-04-03-figma-oauth-design.md`

MVP ships on-demand sync (fetch on request detail load). The following are deferred:

#### Figma OAuth — Scheduled Polling
**Why deferred:** On-demand sync is sufficient for MVP. Cron adds infra overhead (job runner, failure handling, rate-limit management) with no clear customer ask yet.

**What to build when ready:**
- Cron job (via `vercel.json`) that runs every 15–30 min
- Iterates all orgs with a `figma_connections` row
- For each org: fetches versions for all requests with a `figmaUrl` in dev/design phase
- Inserts new versions into `figma_updates` (same dedup logic as on-demand)
- Secured via `CRON_SECRET` header

#### Figma OAuth — App Registration (Activation Blocker)
**Why deferred:** Requires manual setup in Figma's developer console — doing when ready to onboard customers.

**What to do (not a code task):**
1. Go to figma.com/developers → Create a new app named "Lane"
2. Add redirect URIs: `http://localhost:3000/api/figma/oauth/callback` (dev) + `https://your-vercel-url/api/figma/oauth/callback` (prod)
3. Copy Client ID + Client Secret
4. Add to `.env.local`: `FIGMA_CLIENT_ID=` and `FIGMA_CLIENT_SECRET=`
5. Add same vars to Vercel environment variables → redeploy

This is a one-time setup. One OAuth app for all customers — each customer authorises through Lane's app, their token is stored per-org in `figma_connections`.

#### Figma OAuth — Token Encryption at Rest
**Why deferred:** Plaintext token is acceptable for pre-launch. Add before onboarding paying customers.

**What to build when ready:**
- Add `ENCRYPTION_KEY` env var (32-byte AES key)
- Encrypt `access_token` + `refresh_token` in `figma_connections` on write
- Decrypt on read before passing to Figma API calls
- One-time migration to encrypt existing rows

#### /settings/integrations — Full Hub (Slack, Linear live)
**Why deferred:** UI shell ships now (Figma functional + Slack/Linear as placeholders). Live integrations are Month 2–3.

**What to build when ready:**
- Slack: webhook URL per org, wire into assign/sign-off/handoff/shipped events
- Linear: OAuth, auto-create issue on handoff, sync status back

#### figma_updates — Scale Optimisation (100+ customers)
**Why deferred:** At current scale (10–50 orgs) the table is negligible. Revisit when you have 100+ active orgs each syncing frequently.

**What to do when ready:**
- Add a DB index on `(request_id, figma_version_id)` — speeds up the dedup SELECT in `lib/figma/sync.ts`
- Add a retention policy: archive or delete `figma_updates` rows older than 90 days for requests in `track` or `done` phase (they're no longer actionable)
- Consider a `figma_updates_archive` table for audit trail if legal/compliance requires it
- If row count exceeds ~1M: partition `figma_updates` by `created_at` month (Postgres native partitioning)

**Trigger:** Check when Supabase dashboard shows `figma_updates` approaching 500k rows.

---

### Weekly Digest — Stored Per Org (Cron Pre-generation)
**Why deferred:** Current digest is on-demand (user clicks "Generate"). For the Friday auto-delivery vision, the cron needs to generate and store digests per org so they're pre-loaded when users open Insights on Monday.

**What to build:**
- Add `weekly_digests` table to DB: `id`, `org_id`, `week_start`, `digest_json`, `generated_at`
- Update `/api/insights/digest/generate/route.ts` to iterate all orgs, generate + store digest
- Update `/api/digest` GET to first check for a stored digest for current week, fall back to live generation
- DigestPanel: show "Generated Friday" timestamp when loading a stored digest

**Cron already configured** (`vercel.json` — every Friday 9am UTC):
```json
{ "path": "/api/insights/digest/generate", "schedule": "0 9 * * 5" }
```

**Env var needed:**
```
CRON_SECRET=   ← set in Vercel to secure the cron endpoint
```

---

## Priority 2 — Month 2–3

### Email Activation (not a build task — just env vars)
Code is fully built. Just needs 3 Vercel env vars:

```
RESEND_API_KEY=        ← sign up at resend.com (free, 3k/month)
EMAIL_FROM=            ← "Lane <notifications@yourdomain.com>" (domain verified in Resend)
                          OR use "onboarding@resend.dev" for testing without domain verification
NEXT_PUBLIC_APP_URL=   ← live Vercel URL e.g. https://lane.vercel.app
```

Steps:
1. Sign up at resend.com → copy API key
2. Verify sending domain in Resend OR use `onboarding@resend.dev`
3. Add all 3 vars in Vercel → redeploy
4. Test by creating an invite — should receive email

---

### Slack Notifications
**Why deferred:** Low ROI for MVP. Zapier can bridge this initially.

**What to build when ready:**
- `SLACK_WEBHOOK_URL` env var (per org or global)
- `lib/slack/index.ts` — `sendSlack(text)` helper, silent no-op if key not set
- Wire into: assign route, validation sign-off, handoff, shipped
- Settings page: paste webhook URL per org

---

### Designer Performance Dashboard
**Why deferred:** PM calibration (built) covers the PM side. Designer side needs more data to be meaningful.

**What to build:**
- Per-designer view: avg cycle time, throughput per week, on-time rate, requests by type
- Trend charts (last 4 weeks)
- Compare designer against org average
- Surfaces in Team page or as sub-tab on Insights

---

## Priority 3 — Month 3–4

### Linear Integration (Native)
**Why deferred:** Zapier can bridge for MVP. Native integration is Month 3.

**What to build:**
- OAuth with Linear API
- On handoff: auto-create Linear issue with title, description, Figma link, assignee
- Sync status back: when Linear issue closes → mark Lane request as shipped
- `LINEAR_CLIENT_ID` + `LINEAR_CLIENT_SECRET` env vars

---

### Duplicate Detection (Embeddings-Based)
**Why deferred:** AI triage already flags potential duplicates via text matching. Embeddings-based is more accurate but requires vector storage.

**What to build:**
- Generate embeddings for each new request on creation (OpenAI `text-embedding-3-small` or Supabase pgvector)
- Cosine similarity search against existing request embeddings
- Threshold: surface anything above 0.85 similarity
- Show in triage results + at request creation time

---

### Figma Plugin
**Why deferred:** Web app link is sufficient for MVP. Plugin is a nice-to-have for power users.

**When to build:** Only if customers explicitly ask. Defer 6+ months.

---

### Auto-Comment in Figma
**Why deferred:** Low ROI. Figma's own notification system handles this.

---

### Version Comparison Tool (Figma Diff Viewer)
**Why deferred:** Too complex for MVP. Figma link is enough.

---

## Activation Checklist (things built but not yet live)

| Item | Status | What's needed |
|------|--------|---------------|
| Email notifications | Built ✅ | 3 Vercel env vars (see above) |
| Weekly digest cron | Cron configured ✅ | `CRON_SECRET` in Vercel + per-org storage (Priority 1) |
| Figma sync | UI built ✅ | Figma OAuth flow (Priority 1) |
| RLS policies | Schema ready ✅ | Write + enable RLS on all tables (Priority 0) |
| Redis rate limiting | Not started | Add Upstash Redis + rate limit AI routes (Priority 0) |
| Snooze resurface cron | Cron configured ✅ | `CRON_SECRET` in Vercel (shares with other crons) |
| Notification preferences | Built ✅ | Email channel needs Resend env vars (see above) |
| Published views (public) | Built ✅ | Needs RLS policy for anonymous SELECT with token |

---

## Notes

- **Figma webhook route** (`app/api/figma/webhook/route.ts`) is deleted as part of the OAuth build — replaced by on-demand sync.
- **`FIGMA_WEBHOOK_TOKEN`** env var was removed from the plan. Don't add it.
- Everything in this file has corresponding code stubs or downstream components already built — nothing starts from zero.
