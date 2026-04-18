// lib/impact/variance.ts
// Shared impact-variance vocabulary. Both track-phase-panel and pm-calibration
// use this — keeps the "calibration not scoring" framing consistent across the app.

export type VarianceLabel = "well_calibrated" | "over_optimistic" | "under_optimistic";

export interface VarianceConfig {
  label: VarianceLabel;
  displayText: string;
  description: string;
  style: string; // tailwind classes for badge
}

export const LABEL_CONFIG: Record<VarianceLabel, VarianceConfig> = {
  well_calibrated: {
    label: "well_calibrated",
    displayText: "Close to the mark",
    description: "Prediction within ±10%",
    style: "text-accent-success bg-accent-success/10 border-accent-success/20",
  },
  over_optimistic: {
    label: "over_optimistic",
    displayText: "Aimed high",
    description: "Delivered less than predicted",
    style: "text-accent-danger bg-accent-danger/10 border-accent-danger/20",
  },
  under_optimistic: {
    label: "under_optimistic",
    displayText: "Aimed low",
    description: "Delivered more than predicted",
    style: "text-accent-warning bg-accent-warning/10 border-accent-warning/20",
  },
};

// Classify a numeric variance percent into a label + config.
// Well-calibrated if |v| ≤ 10%; over-optimistic if v < -10% (predicted more than delivered);
// under-optimistic otherwise (delivered more than predicted).
export function classifyVariance(variancePercent: number): VarianceConfig {
  const abs = Math.abs(variancePercent);
  if (abs <= 10) return LABEL_CONFIG.well_calibrated;
  if (variancePercent < -10) return LABEL_CONFIG.over_optimistic;
  return LABEL_CONFIG.under_optimistic;
}

// Graduated pill style for the inline +N.N% badge — used when you want
// a visual weight that scales with the magnitude of the variance.
// Different from classifyVariance, which only cares about sign past the ±10% band.
export function variancePillStyle(variancePercent: number): string {
  const abs = Math.abs(variancePercent);
  if (abs <= 10) return "text-accent-success bg-accent-success/10 border-accent-success/20";
  if (abs <= 25) return "text-accent-warning bg-accent-warning/10 border-accent-warning/20";
  return "text-accent-danger bg-accent-danger/10 border-accent-danger/20";
}

export function formatVariance(variancePercent: number): string {
  return `${variancePercent > 0 ? "+" : ""}${variancePercent.toFixed(1)}%`;
}
