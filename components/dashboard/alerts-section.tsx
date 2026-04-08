"use client";

import { useState } from "react";
import Link from "next/link";

interface AlertItem {
  id: string;
  type: string;
  urgency: "low" | "medium" | "high";
  title: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
}

interface Props {
  alerts: AlertItem[];
}

const urgencyBorder: Record<string, string> = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "var(--border-strong)",
};

const INLINE_LIMIT = 3;

export function AlertsSection({ alerts: initial }: Props) {
  const [alerts, setAlerts] = useState(initial);
  const [panelOpen, setPanelOpen] = useState(false);

  if (alerts.length === 0) return null;

  const visible = alerts.slice(0, INLINE_LIMIT);
  const overflow = alerts.length - INLINE_LIMIT;

  async function handleDismiss(id: string) {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    try {
      await fetch(`/api/alerts/${id}/dismiss`, { method: "POST" });
    } catch {
      // silent fail — badge in bell will still show on next load
    }
  }

  return (
    <div className="mb-5 flex flex-col gap-2">
      {visible.map((alert) => (
        <div
          key={alert.id}
          className="rounded-xl overflow-hidden flex"
          style={{
            border: "1px solid var(--border)",
            background: "var(--bg-subtle)",
          }}
        >
          {/* Urgency bar */}
          <div
            className="w-1 shrink-0"
            style={{ background: urgencyBorder[alert.urgency] }}
          />

          <div className="flex-1 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium leading-snug" style={{ color: "var(--text-primary)" }}>
                {alert.title}
              </p>
              <button
                onClick={() => handleDismiss(alert.id)}
                className="shrink-0 text-xs leading-none hover:opacity-70 transition-opacity mt-0.5"
                style={{ color: "var(--text-tertiary)", background: "none", border: "none", cursor: "pointer" }}
                aria-label="Dismiss alert"
              >
                ×
              </button>
            </div>

            <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {alert.body}
            </p>

            <div className="mt-2.5">
              <Link
                href={alert.ctaUrl}
                className="text-xs font-medium hover:opacity-80 transition-opacity"
                style={{ color: "var(--accent)" }}
              >
                {alert.ctaLabel} →
              </Link>
            </div>
          </div>
        </div>
      ))}

      {overflow > 0 && (
        <button
          onClick={() => setPanelOpen(true)}
          className="text-xs text-left hover:opacity-70 transition-opacity"
          style={{ color: "var(--text-tertiary)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          View all {alerts.length} alerts →
        </button>
      )}
    </div>
  );
}
