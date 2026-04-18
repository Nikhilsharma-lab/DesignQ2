import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withUserSession } from "@/db/user";
import { requests, iterations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateIterationSummary } from "@/lib/ai/iteration-summary";
import { checkAiRateLimit } from "@/lib/rate-limit";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: requestId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const rateLimited = await checkAiRateLimit(user.id);
  if (rateLimited) return rateLimited;

  try {
    return await withUserSession(user.id, async (db) => {
      const [request] = await db
        .select()
        .from(requests)
        .where(eq(requests.id, requestId));

      if (!request) {
        return NextResponse.json(
          { error: "Request not found" },
          { status: 404 },
        );
      }

      const iterationsList = await db
        .select()
        .from(iterations)
        .where(eq(iterations.requestId, requestId));

      if (iterationsList.length === 0) {
        return NextResponse.json(
          { error: "No iterations to summarize" },
          { status: 400 },
        );
      }

      const summary = await generateIterationSummary({
        requestTitle: request.title,
        requestDescription: request.description ?? "",
        designFrame: request.designFrameProblem,
        iterations: iterationsList.map((it) => ({
          title: it.title,
          description: it.description,
          rationale: it.rationale,
          figmaUrl: it.figmaUrl,
        })),
      });

      return NextResponse.json({ summary });
    });
  } catch (err) {
    console.error("[iteration-summary] Failed:", err);
    return NextResponse.json(
      { error: "Failed to generate iteration summary" },
      { status: 500 },
    );
  }
}
