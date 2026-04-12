import type { Request, Phase } from "@/db/schema";

const PHASE_META: { key: Phase; label: string }[] = [
  { key: "predesign", label: "Predesign" },
  { key: "design", label: "Design" },
  { key: "dev", label: "Dev" },
  { key: "track", label: "Track" },
];

export function PipelineSummary({
  allRequests,
}: {
  allRequests: Request[];
}) {
  const counts: Record<Phase, number> = {
    predesign: 0,
    design: 0,
    dev: 0,
    track: 0,
  };

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  let shippedThisWeek = 0;

  for (const r of allRequests) {
    if (r.phase && counts[r.phase] !== undefined) {
      counts[r.phase]++;
    }
    if (r.status === "shipped" && r.updatedAt > oneWeekAgo) {
      shippedThisWeek++;
    }
  }

  const hasAny = allRequests.length > 0;
  if (!hasAny) return null;

  return (
    <div className="flex items-center gap-4 flex-wrap">
      {PHASE_META.map((p) =>
        counts[p.key] > 0 ? (
          <div key={p.key} className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: `var(--phase-${p.key})` }}
            />
            <span className="text-xs text-muted-foreground">
              {counts[p.key]} in {p.label}
            </span>
          </div>
        ) : null
      )}
      {shippedThisWeek > 0 && (
        <span className="text-xs text-accent-success font-medium">
          {shippedThisWeek} shipped this week
        </span>
      )}
    </div>
  );
}
