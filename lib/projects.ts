export const PROJECT_COLORS = [
  "#71717a", // zinc
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#ef4444", // red
  "#f97316", // orange
  "#22c55e", // green
  "#0ea5e9", // sky
] as const;

export type ProjectColor = (typeof PROJECT_COLORS)[number];
