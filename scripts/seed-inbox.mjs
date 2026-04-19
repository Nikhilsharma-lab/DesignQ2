/**
 * Seed Inbox — Demo notifications for the Linear-style Inbox page.
 *
 * Seeds the `notifications` table with ~18 realistic demo notifications
 * across multiple recipients, types, and states (unread, read, archived, snoozed).
 *
 * Must run AFTER seed.mjs and seed-v2.mjs.
 *
 * Usage: node scripts/seed-inbox.mjs
 */

import postgres from "postgres";
import { config } from "dotenv";
config({ path: ".env.local" });

const sql = postgres(process.env.DATABASE_URL, { prepare: false });

async function main() {
  console.log("📥  Seed Inbox — demo notifications\n");

  // ── 1. Find org ──────────────────────────────────────────────────────────
  const [org] = await sql`SELECT id FROM organizations WHERE slug = 'acme-demo' LIMIT 1`;
  if (!org) {
    console.error("❌  Org 'acme-demo' not found. Run seed.mjs first.");
    process.exit(1);
  }

  // ── 2. Build user map keyed by email prefix ──────────────────────────────
  const profiles = await sql`SELECT id, email, full_name, role FROM profiles WHERE org_id = ${org.id}`;
  const U = {};
  for (const p of profiles) {
    const prefix = p.email.split("@")[0];
    U[prefix] = { id: p.id, name: p.full_name, role: p.role };
  }
  const userNames = Object.keys(U);
  console.log(`✓ ${profiles.length} users loaded (${userNames.join(", ")})`);

  // ── 3. Load requests for linking ─────────────────────────────────────────
  const allReqs = await sql`SELECT id, title FROM requests WHERE org_id = ${org.id} LIMIT 30`;
  const findReq = (prefix) => allReqs.find((r) => r.title.toLowerCase().includes(prefix.toLowerCase()));

  const checkout = findReq("checkout");
  const analytics = findReq("analytics");
  const payment = findReq("payment");
  const search = findReq("search");
  const onboarding = findReq("onboarding");
  const darkmode = findReq("dark");
  const errorState = findReq("error state");
  const notifPrefs = findReq("notification");

  console.log(`✓ ${allReqs.length} requests loaded`);
  console.log(`  Matched: ${[checkout, analytics, payment, search, onboarding, darkmode, errorState, notifPrefs].filter(Boolean).length} of 8 expected\n`);

  // ── 4. Clear existing seeded notifications ───────────────────────────────
  const deleted = await sql`DELETE FROM notifications WHERE org_id = ${org.id}`;
  console.log(`🗑  Cleared ${deleted.count} existing notifications\n`);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const hoursAgo = (h) => new Date(Date.now() - h * 60 * 60 * 1000);
  const hoursFromNow = (h) => new Date(Date.now() + h * 60 * 60 * 1000);
  const reqUrl = (r) => r ? `/dashboard/requests/${r.id}` : "/dashboard";

  // ── 5. Build notifications ───────────────────────────────────────────────
  const notifs = [];

  // === TODAY (for Priya — primary test user) ===

  // 1. signoff_requested
  if (checkout && U.priya && U.alex) {
    notifs.push({
      org_id: org.id,
      recipient_id: U.priya.id,
      actor_id: U.alex.id,
      type: "signoff_requested",
      request_id: checkout.id,
      title: "Your sign-off is needed on Checkout flow",
      body: "Alex submitted the design for review. 2 of 3 sign-offs received.",
      url: reqUrl(checkout),
      read_at: null,
      archived_at: null,
      snoozed_until: null,
      created_at: hoursAgo(1),
    });
  }

  // 2. comment on checkout for Priya
  if (checkout && U.priya && U.marcus) {
    notifs.push({
      org_id: org.id,
      recipient_id: U.priya.id,
      actor_id: U.marcus.id,
      type: "comment",
      request_id: checkout.id,
      title: "Marcus commented on Checkout flow",
      body: "The conversion data looks promising — let's move this forward.",
      url: reqUrl(checkout),
      read_at: null,
      archived_at: null,
      snoozed_until: null,
      created_at: hoursAgo(2),
    });
  }

  // 3. mention in search results for Priya
  if (search && U.priya && U.alex) {
    notifs.push({
      org_id: org.id,
      recipient_id: U.priya.id,
      actor_id: U.alex.id,
      type: "mention",
      request_id: search.id,
      title: "Alex mentioned you in Search results",
      body: "@priya can you review the filter pattern I used here?",
      url: reqUrl(search),
      read_at: null,
      archived_at: null,
      snoozed_until: null,
      created_at: hoursAgo(4),
    });
  }

  // 4. figma_update for Sam
  if (analytics && U.sam && U.ananya) {
    notifs.push({
      org_id: org.id,
      recipient_id: U.sam.id,
      actor_id: U.ananya.id,
      type: "figma_update",
      request_id: analytics.id,
      title: "Ananya updated Figma for Analytics dashboard",
      body: "Post-handoff change detected. Please review before continuing.",
      url: reqUrl(analytics),
      read_at: null,
      archived_at: null,
      snoozed_until: null,
      created_at: hoursAgo(3),
    });
  }

  // 5. assigned for Alex
  if (analytics && U.alex && U.sarah) {
    notifs.push({
      org_id: org.id,
      recipient_id: U.alex.id,
      actor_id: U.sarah.id,
      type: "assigned",
      request_id: analytics.id,
      title: "You were assigned to Analytics dashboard",
      body: "Sarah assigned you as lead designer.",
      url: reqUrl(analytics),
      read_at: null,
      archived_at: null,
      snoozed_until: null,
      created_at: hoursAgo(5),
    });
  }

  // === YESTERDAY ===

  // 6. signoff_submitted for Deepak
  if (onboarding && U.deepak && U.marcus) {
    notifs.push({
      org_id: org.id,
      recipient_id: U.deepak.id,
      actor_id: U.marcus.id,
      type: "signoff_submitted",
      request_id: onboarding.id,
      title: "Marcus signed off on Onboarding checklist",
      body: "PM approved with conditions: 'Add error states for empty fields'",
      url: reqUrl(onboarding),
      read_at: null,
      archived_at: null,
      snoozed_until: null,
      created_at: hoursAgo(30),
    });
  }

  // 7. request_approved for Riya (read)
  if (search && U.riya) {
    notifs.push({
      org_id: org.id,
      recipient_id: U.riya.id,
      actor_id: null,
      type: "request_approved",
      request_id: search.id,
      title: "All sign-offs received for Search results",
      body: "Design approved! Moving to dev phase.",
      url: reqUrl(search),
      read_at: hoursAgo(27),
      archived_at: null,
      snoozed_until: null,
      created_at: hoursAgo(28),
    });
  }

  // 8. request_rejected for Ananya (read)
  if (darkmode && U.ananya && U.priya) {
    notifs.push({
      org_id: org.id,
      recipient_id: U.ananya.id,
      actor_id: U.priya.id,
      type: "request_rejected",
      request_id: darkmode.id,
      title: "Priya requested changes on Dark/light mode",
      body: "Contrast ratios need work on the dark theme cards. See comments.",
      url: reqUrl(darkmode),
      read_at: hoursAgo(31),
      archived_at: null,
      snoozed_until: null,
      created_at: hoursAgo(32),
    });
  }

  // 9. comment for Riya
  if (payment && U.riya && U.alex) {
    notifs.push({
      org_id: org.id,
      recipient_id: U.riya.id,
      actor_id: U.alex.id,
      type: "comment",
      request_id: payment.id,
      title: "Alex left feedback on Payment confirmation",
      body: "The success animation feels too slow — can we try 200ms?",
      url: reqUrl(payment),
      read_at: null,
      archived_at: null,
      snoozed_until: null,
      created_at: hoursAgo(26),
    });
  }

  // 10. stage_change for Priya (read)
  if (onboarding && U.priya) {
    notifs.push({
      org_id: org.id,
      recipient_id: U.priya.id,
      actor_id: null,
      type: "stage_change",
      request_id: onboarding.id,
      title: "Onboarding checklist moved to Converge",
      body: "Deepak narrowed to 2 directions and is refining the chosen approach.",
      url: reqUrl(onboarding),
      read_at: hoursAgo(33),
      archived_at: null,
      snoozed_until: null,
      created_at: hoursAgo(34),
    });
  }

  // === LAST 7 DAYS ===

  // 11. stage_change for Priya (read, ARCHIVED)
  if (payment && U.priya) {
    notifs.push({
      org_id: org.id,
      recipient_id: U.priya.id,
      actor_id: null,
      type: "stage_change",
      request_id: payment.id,
      title: "Payment confirmation moved to Prove",
      body: "Riya's design is ready for the 3-signoff gate.",
      url: reqUrl(payment),
      read_at: hoursAgo(70),
      archived_at: hoursAgo(69),
      snoozed_until: null,
      created_at: hoursAgo(72), // 3 days ago
    });
  }

  // 12. idea_vote for Alex
  if (U.alex && U.jordan) {
    notifs.push({
      org_id: org.id,
      recipient_id: U.alex.id,
      actor_id: U.jordan.id,
      type: "idea_vote",
      request_id: null,
      title: "Jordan voted on your idea",
      body: "Upvoted 'Real-time presence indicators on request pages'",
      url: "/dashboard/ideas",
      read_at: null,
      archived_at: null,
      snoozed_until: null,
      created_at: hoursAgo(96), // 4 days ago
    });
  }

  // 13. idea_approved for Nina
  if (U.nina && U.priya) {
    notifs.push({
      org_id: org.id,
      recipient_id: U.nina.id,
      actor_id: U.priya.id,
      type: "idea_approved",
      request_id: null,
      title: "Your idea was approved",
      body: "'Error state illustration library' is now a request. Time to design!",
      url: "/dashboard/ideas",
      read_at: null,
      archived_at: null,
      snoozed_until: null,
      created_at: hoursAgo(72), // 3 days ago
    });
  }

  // 14. assigned for Deepak (read)
  if (darkmode && U.deepak && U.marcus) {
    notifs.push({
      org_id: org.id,
      recipient_id: U.deepak.id,
      actor_id: U.marcus.id,
      type: "assigned",
      request_id: darkmode.id,
      title: "You were assigned to Dark/light mode",
      body: "Marcus assigned you as contributor.",
      url: reqUrl(darkmode),
      read_at: hoursAgo(118),
      archived_at: null,
      snoozed_until: null,
      created_at: hoursAgo(120), // 5 days ago
    });
  }

  // 15. project_update for Priya (ARCHIVED)
  if (U.priya) {
    notifs.push({
      org_id: org.id,
      recipient_id: U.priya.id,
      actor_id: null,
      type: "project_update",
      request_id: null,
      title: "3 requests updated in Mobile App project",
      body: "Analytics dashboard shipped, 2 requests moved to Converge.",
      url: "/dashboard",
      read_at: hoursAgo(95),
      archived_at: hoursAgo(94),
      snoozed_until: null,
      created_at: hoursAgo(96), // 4 days ago
    });
  }

  // === SNOOZED (for Priya) ===

  // 16. comment, snoozed until 1 hour from now
  if (notifPrefs && U.priya && U.sarah) {
    notifs.push({
      org_id: org.id,
      recipient_id: U.priya.id,
      actor_id: U.sarah.id,
      type: "comment",
      request_id: notifPrefs.id,
      title: "Sarah asked a question on Notification preferences",
      body: "Should we default email notifications to on or off?",
      url: reqUrl(notifPrefs),
      read_at: null,
      archived_at: null,
      snoozed_until: hoursFromNow(1),
      created_at: hoursAgo(6),
    });
  }

  // === OLDER ===

  // 17. comment for Nina (read)
  if (errorState && U.nina && U.sarah) {
    notifs.push({
      org_id: org.id,
      recipient_id: U.nina.id,
      actor_id: U.sarah.id,
      type: "comment",
      request_id: errorState.id,
      title: "Sarah left feedback on Error state library",
      body: "Love the empty state illustrations! Can we add one for 'no search results'?",
      url: reqUrl(errorState),
      read_at: hoursAgo(238),
      archived_at: null,
      snoozed_until: null,
      created_at: hoursAgo(240), // 10 days ago
    });
  }

  // 18. nudge for Alex (read, ARCHIVED)
  if (checkout && U.alex) {
    notifs.push({
      org_id: org.id,
      recipient_id: U.alex.id,
      actor_id: null,
      type: "nudge",
      request_id: checkout.id,
      title: "Checkout flow hasn't had updates in 5 days",
      body: "Everything okay? [I'm blocked] [Still thinking] [Forgot to update]",
      url: reqUrl(checkout),
      read_at: hoursAgo(190),
      archived_at: hoursAgo(189),
      snoozed_until: null,
      created_at: hoursAgo(192), // 8 days ago
    });
  }

  // ── 6. Insert notifications ──────────────────────────────────────────────
  console.log(`📬 Inserting ${notifs.length} notifications...\n`);

  const recipientCounts = {};

  for (const n of notifs) {
    try {
      await sql`
        INSERT INTO notifications (
          org_id, recipient_id, actor_id, type, request_id,
          title, body, url, read_at, archived_at, snoozed_until, created_at
        ) VALUES (
          ${n.org_id}, ${n.recipient_id}, ${n.actor_id}, ${n.type}, ${n.request_id},
          ${n.title}, ${n.body}, ${n.url}, ${n.read_at}, ${n.archived_at},
          ${n.snoozed_until}, ${n.created_at}
        )
      `;
      const who = profiles.find((p) => p.id === n.recipient_id)?.full_name || "?";
      const state = n.archived_at ? "archived" : n.snoozed_until ? "snoozed" : n.read_at ? "read" : "unread";
      console.log(`  ✓ [${state}] ${n.type} → ${who}: "${n.title}"`);

      recipientCounts[who] = (recipientCounts[who] || 0) + 1;
    } catch (err) {
      console.error(`  ✗ Failed: ${n.title} — ${err.message}`);
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log(`\n── Summary ──────────────────────────────────────────`);
  console.log(`Total: ${notifs.length} notifications inserted\n`);
  console.log(`Per recipient:`);
  for (const [name, count] of Object.entries(recipientCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${name}: ${count}`);
  }
  console.log(`\n✅ Inbox seeded! Log in as priya@acme-demo.io to see notifications.`);

  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
