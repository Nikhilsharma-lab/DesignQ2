// components/requests/track-phase-panel.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PanelHeader } from "@/components/ui/panel-header";
import { SectionLabel } from "@/components/ui/section-label";
import { classifyVariance, formatVariance } from "@/lib/impact/variance";

interface PriorCalibration {
  requestId: string;
  requestTitle: string;
  predictedValue: string;
  actualValue: string | null;
  variancePercent: string | number | null;
}

interface Props {
  requestId: string;
  trackStage: "measuring" | "complete";
  impactMetric: string | null;
  impactPrediction: string | null;
  impactActual: string | null;
  initialVariancePercent: number | null;
}

function formatMeasuredAgo(measuredAt: Date | null): string {
  if (!measuredAt) return "";
  const diffMs = Date.now() - measuredAt.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days === 0) return "Measured today";
  if (days === 1) return "Measured 1 day ago";
  return `Measured ${days} days ago`;
}

export function TrackPhasePanel({
  requestId,
  trackStage,
  impactMetric,
  impactPrediction,
  impactActual,
  initialVariancePercent,
}: Props) {
  const router = useRouter();
  const [actual, setActual] = useState(impactActual ?? "");
  const [optimisticActual, setOptimisticActual] = useState<string | null>(impactActual);
  const [notes, setNotes] = useState("");
  const [variancePercent, setVariancePercent] = useState<number | null>(initialVariancePercent);
  const [measuredAt, setMeasuredAt] = useState<Date | null>(null);
  const [priorCalibrations, setPriorCalibrations] = useState<PriorCalibration[]>([]);
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch existing record + prior calibrations on mount
  useEffect(() => {
    fetch(`/api/requests/${requestId}/impact-record`)
      .then((r) => r.json())
      .then((data) => {
        if (data.record) {
          setNotes(data.record.notes ?? "");
          const vp = data.record.variancePercent;
          if (vp !== null && vp !== undefined) {
            setVariancePercent(typeof vp === "string" ? parseFloat(vp) : vp);
          }
          if (data.record.measuredAt) {
            setMeasuredAt(new Date(data.record.measuredAt));
          }
        }
      })
      .catch((err) =>
        console.error("[track-phase-panel] fetch record failed:", err),
      );

    fetch(`/api/pm/prior-calibrations?excludeRequestId=${requestId}`)
      .then((r) => r.json())
      .then((data) => {
        setPriorCalibrations(data.calibrations ?? []);
      })
      .catch((err) =>
        console.error("[track-phase-panel] fetch prior calibrations failed:", err),
      );
  }, [requestId]);

  async function handleSave() {
    if (!actual.trim()) return;
    const previousActual = optimisticActual;
    const previousVariance = variancePercent;
    setOptimisticActual(actual.trim());
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/requests/${requestId}/impact-record`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actualValue: actual.trim(),
          notes: notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOptimisticActual(previousActual);
        setVariancePercent(previousVariance);
        setError(data.error ?? "Failed to save");
      } else {
        if (typeof data.variancePercent === "number") {
          setVariancePercent(data.variancePercent);
        }
        setMeasuredAt(new Date());
        setEditing(false);
        router.refresh();
      }
    } catch {
      setOptimisticActual(previousActual);
      setVariancePercent(previousVariance);
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function markComplete() {
    setCompleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/requests/${requestId}/advance-phase`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Failed to complete");
      else router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setCompleting(false);
    }
  }

  const isComplete = trackStage === "complete";
  const vcfg = variancePercent !== null ? classifyVariance(variancePercent) : null;
  const showInput = !isComplete && (!optimisticActual || editing);

  return (
    <div className="border rounded-xl overflow-hidden">
      <PanelHeader>
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Phase 4 — Track
        </span>
        <span
          className={`text-[10px] px-2 py-0.5 rounded border font-medium ${
            isComplete
              ? "text-accent-success bg-accent-success/10 border-accent-success/20"
              : "text-accent-warning bg-accent-warning/10 border-accent-warning/20"
          }`}
        >
          {isComplete ? "Complete" : "Measuring"}
        </span>
      </PanelHeader>

      <div className="px-5 py-4 space-y-4">
        {impactMetric && (
          <div>
            <SectionLabel className="mb-1">Metric</SectionLabel>
            <p className="text-xs text-foreground">{impactMetric}</p>
          </div>
        )}

        {impactPrediction && (
          <div>
            <SectionLabel className="mb-1">Predicted</SectionLabel>
            <p className="text-xs text-muted-foreground">{impactPrediction}</p>
          </div>
        )}

        {/* Prior-calibration hint — shown only when still measuring and the input is visible */}
        {showInput && priorCalibrations.length > 0 && (
          <div className="border border-dashed rounded-lg p-3 space-y-1.5">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
              Your recent predictions — for reference
            </p>
            {priorCalibrations.map((p) => {
              const vp =
                p.variancePercent === null
                  ? null
                  : typeof p.variancePercent === "string"
                    ? parseFloat(p.variancePercent)
                    : p.variancePercent;
              return (
                <div key={p.requestId} className="text-[11px] text-muted-foreground">
                  <span className="text-foreground">{p.requestTitle}</span>
                  {" — predicted "}
                  <span className="font-mono text-foreground">{p.predictedValue}</span>
                  {", actual "}
                  <span className="font-mono text-foreground">{p.actualValue ?? "—"}</span>
                  {vp !== null && (
                    <span className="ml-1 text-muted-foreground/60">({formatVariance(vp)})</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Actual result */}
        <div>
          <SectionLabel>Actual result</SectionLabel>
          {isComplete ? (
            <p className="text-xs text-foreground">{optimisticActual ?? "—"}</p>
          ) : (
            <div className="space-y-2">
              {optimisticActual && !editing && (
                <div className="flex items-center gap-2">
                  <p className="text-xs text-foreground">{optimisticActual}</p>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => {
                      setActual(optimisticActual);
                      setEditing(true);
                    }}
                    className="text-[11px]"
                  >
                    Edit
                  </Button>
                </div>
              )}
              {showInput && (
                <>
                  <Input
                    type="text"
                    value={actual}
                    onChange={(e) => setActual(e.target.value)}
                    placeholder="e.g. +4.2% retention"
                    inputSize="sm"
                  />
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Notes (optional) — context that shaped this result, e.g. 'competitor launched same week', 'holiday slowdown'"
                    rows={2}
                    className="text-xs resize-none"
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSave}
                      disabled={!actual.trim() || saving}
                    >
                      {saving ? "Saving..." : optimisticActual ? "Save changes" : "Save"}
                    </Button>
                    {editing && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setActual(optimisticActual ?? "");
                          setEditing(false);
                        }}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Accuracy block — shown when variance is known */}
        {vcfg && optimisticActual && (
          <div className="border rounded-lg px-4 py-3 space-y-2.5 bg-muted">
            <SectionLabel className="mb-0">Accuracy</SectionLabel>
            {impactPrediction && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground/60">Predicted</span>
                <span className="font-mono text-muted-foreground">{impactPrediction}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground/60">Variance</span>
              <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded border ${vcfg.style}`}>
                {formatVariance(variancePercent!)}
              </span>
            </div>
            <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded border font-medium ${vcfg.style}`}>
              {vcfg.displayText}
            </span>
            {measuredAt && (
              <p className="text-[10px] text-muted-foreground/50 pt-1">
                {formatMeasuredAgo(measuredAt)}
              </p>
            )}
          </div>
        )}

        {/* Mark complete */}
        {!isComplete && optimisticActual && !editing && (
          <Button
            variant="default"
            size="sm"
            onClick={markComplete}
            disabled={completing}
            className="flex items-center gap-2"
          >
            {completing && (
              <span className="w-3 h-3 border border-primary-foreground border-t-transparent rounded-full animate-spin" />
            )}
            Mark complete
          </Button>
        )}

        {isComplete && (
          <div className="bg-accent-success/5 border border-accent-success/15 rounded-lg px-3 py-2 flex items-center gap-2">
            <span className="text-accent-success text-xs">✓</span>
            <p className="text-[11px] text-accent-success/80">Impact recorded — request complete</p>
          </div>
        )}

        {error && (
          <p className="text-xs text-accent-danger bg-accent-danger/10 border border-accent-danger/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
