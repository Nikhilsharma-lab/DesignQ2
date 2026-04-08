"use client";

import { useState } from "react";
import Link from "next/link";
import type { MorningBriefingRow } from "@/db/schema/morning_briefings";

interface Props {
  brief: MorningBriefingRow | null;
}

export function MorningBriefingCard({ brief }: Props) {
  const [dismissed, setDismissed] = useState(false);

  if (!brief || brief.dismissedAt || dismissed) return null;

  const content = brief.content;
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  async function handleDismiss() {
    setDismissed(true);
    try {
      const res = await fetch("/api/morning-briefing/dismiss", { method: "POST" });
      if (!res.ok) {
        setDismissed(false); // rollback
      }
    } catch {
      setDismissed(false); // rollback
    }
  }

  return (
    <div
      className="mb-5 rounded-xl border overflow-hidden"
      style={{
        background: "var(--bg-subtle)",
        borderColor: "var(--border)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            {content.greeting}
          </span>
          <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
            · {today}
          </span>
        </div>
        <button
          onClick={handleDismiss}
          className="w-6 h-6 flex items-center justify-center rounded-md text-xs transition-colors hover:opacity-70"
          style={{ color: "var(--text-tertiary)" }}
          aria-label="Dismiss briefing"
        >
          ×
        </button>
      </div>

      {/* Items */}
      <ul className="px-4 py-3 space-y-1.5">
        {content.items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
            <span className="mt-px shrink-0">{item.icon}</span>
            {item.href ? (
              <Link
                href={item.href}
                className="hover:underline underline-offset-2 transition-opacity hover:opacity-80"
                style={{ color: "var(--text-secondary)" }}
              >
                {item.text}
              </Link>
            ) : (
              <span>{item.text}</span>
            )}
          </li>
        ))}
      </ul>

      {/* One Thing */}
      <div
        className="px-4 py-3 border-t flex items-center justify-between gap-3"
        style={{ borderColor: "var(--border)", background: "var(--bg-base)" }}
      >
        <p className="text-xs font-medium" style={{ color: "var(--accent)" }}>
          {content.oneThing}
        </p>
        {content.oneThingHref && (
          <Link
            href={content.oneThingHref}
            className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-md transition-opacity hover:opacity-80"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            Go →
          </Link>
        )}
      </div>
    </div>
  );
}
