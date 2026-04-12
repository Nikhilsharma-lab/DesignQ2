import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  getPhaseLabel,
  getActiveStageLabel,
  getStageLabel,
  PREDESIGN_STAGES,
  DESIGN_STAGES,
} from "@/lib/workflow";
import { PRIORITY_STYLE } from "@/lib/theme-colors";
import type { Request, Phase } from "@/db/schema";

// ── Helpers ────────────────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: string | null }) {
  if (!priority) return null;
  const style = PRIORITY_STYLE[priority];
  return (
    <Badge
      variant="outline"
      className="font-mono text-[10px] font-bold uppercase tracking-wide shrink-0 border-transparent"
      style={
        style
          ? { background: style.bg, color: style.color }
          : undefined
      }
    >
      {priority.toUpperCase()}
    </Badge>
  );
}

const DEV_STAGES = ["todo", "in_progress", "in_review", "qa", "done"];
const TRACK_STAGES = ["measuring", "complete"];

function getStagesForPhase(phase: Phase): string[] {
  switch (phase) {
    case "predesign":
      return [...PREDESIGN_STAGES];
    case "design":
      return [...DESIGN_STAGES];
    case "dev":
      return DEV_STAGES;
    case "track":
      return TRACK_STAGES;
  }
}

function getCurrentStage(request: Request): string {
  if (!request.phase) return request.stage ?? "intake";
  switch (request.phase) {
    case "predesign":
      return request.predesignStage ?? "intake";
    case "design":
      return request.designStage ?? "sense";
    case "dev":
      return request.kanbanState ?? "todo";
    case "track":
      return request.trackStage ?? "measuring";
  }
}

function PhaseProgressDots({ request }: { request: Request }) {
  if (!request.phase) return null;
  const stages = getStagesForPhase(request.phase);
  const current = getCurrentStage(request);
  const currentIdx = stages.indexOf(current);

  return (
    <div className="flex items-center gap-1 mt-1.5">
      {stages.map((s, i) => (
        <span
          key={s}
          className={`size-1 rounded-full ${
            i <= currentIdx
              ? "bg-foreground/40"
              : "bg-foreground/10"
          }`}
          title={getStageLabel(s)}
        />
      ))}
      <span className="ml-1 text-[10px] text-muted-foreground font-mono">
        {getStageLabel(current)}
      </span>
    </div>
  );
}

// ── Rich Card (Needs Your Attention) ───────────────────────────────────────

function RichRequestCard({
  request,
  firstAssigneeName,
}: {
  request: Request;
  firstAssigneeName: string | undefined;
}) {
  const phaseLabel = request.phase ? getPhaseLabel(request.phase) : null;
  const stageLabel = getActiveStageLabel(request);

  return (
    <Link
      href={`/dashboard/requests?dock=${request.id}`}
      className="block no-underline group"
    >
      <div className="rounded-lg border bg-card p-3 transition-colors group-hover:bg-accent/50">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground truncate">
              {request.title}
            </p>
            <div className="flex items-center gap-2 mt-1">
              {phaseLabel && (
                <span className="text-[11px] text-muted-foreground">
                  {phaseLabel} &middot; {stageLabel}
                </span>
              )}
              {firstAssigneeName && (
                <span className="text-[11px] text-muted-foreground/60">
                  {firstAssigneeName}
                </span>
              )}
            </div>
            <PhaseProgressDots request={request} />
          </div>
          <PriorityBadge priority={request.priority} />
        </div>
      </div>
    </Link>
  );
}

// ── Medium Card (Active Work) ──────────────────────────────────────────────

function MediumRequestCard({
  request,
  firstAssigneeName,
}: {
  request: Request;
  firstAssigneeName: string | undefined;
}) {
  const phaseLabel = request.phase ? getPhaseLabel(request.phase) : null;
  const stageLabel = getActiveStageLabel(request);

  return (
    <Link
      href={`/dashboard/requests?dock=${request.id}`}
      className="block no-underline group"
    >
      <div className="rounded-lg border bg-card p-3 transition-colors group-hover:bg-accent/50 h-full">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground truncate">
              {request.title}
            </p>
            <div className="flex items-center gap-2 mt-1">
              {phaseLabel && (
                <span className="text-[11px] text-muted-foreground">
                  {phaseLabel} &middot; {stageLabel}
                </span>
              )}
              {firstAssigneeName && (
                <span className="text-[11px] text-muted-foreground/60">
                  {firstAssigneeName}
                </span>
              )}
            </div>
          </div>
          <PriorityBadge priority={request.priority} />
        </div>
      </div>
    </Link>
  );
}

// ── Compact Row (Recently Updated / Completed) ─────────────────────────────

function CompactRequestRow({
  request,
  firstAssigneeName,
}: {
  request: Request;
  firstAssigneeName: string | undefined;
}) {
  const phaseLabel = request.phase ? getPhaseLabel(request.phase) : null;
  const stageLabel = getActiveStageLabel(request);

  return (
    <Link
      href={`/dashboard/requests?dock=${request.id}`}
      className="flex items-center gap-3 px-3 py-2.5 no-underline transition-colors hover:bg-accent/50"
    >
      <span className="flex-1 text-sm font-medium truncate text-foreground">
        {request.title}
      </span>
      {phaseLabel && (
        <span className="text-[11px] text-muted-foreground shrink-0">
          {phaseLabel} &middot; {stageLabel}
        </span>
      )}
      <PriorityBadge priority={request.priority} />
    </Link>
  );
}

export {
  RichRequestCard,
  MediumRequestCard,
  CompactRequestRow,
  PriorityBadge,
  PhaseProgressDots,
};
