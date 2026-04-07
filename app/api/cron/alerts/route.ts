// app/api/cron/alerts/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { organizations, proactiveAlerts } from "@/db/schema";
import {
  detectStallNudges,
  detectStallEscalations,
  detectSignoffOverdue,
  detectFigmaDrift,
} from "@/lib/alerts/detect";
import { generateAlertCopy, type AlertInput } from "@/lib/ai/proactive-alerts";

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allOrgs = await db.select({ id: organizations.id }).from(organizations);
  const results: { orgId: string; generated: number; skipped: number; errors: number }[] = [];

  for (const org of allOrgs) {
    let generated = 0;
    let skipped = 0;
    let errors = 0;

    try {
      // Run all 4 detectors in parallel
      const [stallNudges, stallEscalations, signoffOverdue, figmaDrift] =
        await Promise.all([
          detectStallNudges(org.id),
          detectStallEscalations(org.id),
          detectSignoffOverdue(org.id),
          detectFigmaDrift(org.id),
        ]);

      const allCandidates = [
        ...stallNudges,
        ...stallEscalations,
        ...signoffOverdue,
        ...figmaDrift,
      ];

      for (const candidate of allCandidates) {
        try {
          // Build input for Claude
          const aiInput: AlertInput = {
            type: candidate.type,
            requestTitle: candidate.requestTitle,
            requestId: candidate.requestId,
            designerName: candidate.designerName,
            daysSinceActivity: candidate.daysSinceActivity,
            lastActivityDescription: candidate.lastActivityDescription,
            pendingSignoffRoles: candidate.pendingSignoffRoles,
            daysSinceValidationRequested: candidate.daysSinceValidationRequested,
            figmaChangeDescription: candidate.figmaChangeDescription,
            hoursSinceFigmaChange: candidate.hoursSinceFigmaChange,
          };

          const copy = await generateAlertCopy(aiInput);

          if (!copy) {
            // Claude failed — skip this alert, retry next hour
            skipped++;
            continue;
          }

          const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

          await db.insert(proactiveAlerts).values({
            orgId: org.id,
            requestId: candidate.requestId,
            recipientId: candidate.recipientId,
            type: candidate.type,
            urgency: copy.urgency,
            title: copy.title,
            body: copy.body,
            ctaLabel: copy.ctaLabel,
            ctaUrl: candidate.ctaUrl,
            ruleKey: candidate.ruleKey,
            expiresAt,
          });

          generated++;
        } catch (err) {
          // Likely a unique constraint violation on ruleKey — another process already inserted
          const message = err instanceof Error ? err.message : String(err);
          if (!message.includes("unique")) {
            console.error(`[cron/alerts] Failed to insert alert ${candidate.ruleKey}:`, err);
            errors++;
          } else {
            skipped++; // duplicate — expected, skip silently
          }
        }
      }
    } catch (err) {
      console.error(`[cron/alerts] Detection failed for org ${org.id}:`, err);
      errors++;
    }

    results.push({ orgId: org.id, generated, skipped, errors });
  }

  return NextResponse.json({
    ok: true,
    firedAt: new Date().toISOString(),
    results,
  });
}
