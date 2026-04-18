// app/api/pm/prior-calibrations/route.ts
// Returns the current user's last 2-3 impact records (excluding an optional requestId)
// so the track panel can show prior predictions-vs-actuals as a calibration reference.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withUserDb } from "@/db/user";
import { impactRecords, requests } from "@/db/schema";
import { and, desc, eq, isNotNull, ne } from "drizzle-orm";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const excludeRequestId = searchParams.get("excludeRequestId");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  return withUserDb(user.id, async (db) => {
    const conditions = [
      eq(impactRecords.pmId, user.id),
      isNotNull(impactRecords.actualValue),
    ];
    if (excludeRequestId) {
      conditions.push(ne(impactRecords.requestId, excludeRequestId));
    }

    const rows = await db
      .select({
        requestId: impactRecords.requestId,
        requestTitle: requests.title,
        predictedMetric: impactRecords.predictedMetric,
        predictedValue: impactRecords.predictedValue,
        actualValue: impactRecords.actualValue,
        variancePercent: impactRecords.variancePercent,
      })
      .from(impactRecords)
      .innerJoin(requests, eq(impactRecords.requestId, requests.id))
      .where(and(...conditions))
      .orderBy(desc(impactRecords.createdAt))
      .limit(3);

    return NextResponse.json({ calibrations: rows });
  });
}
