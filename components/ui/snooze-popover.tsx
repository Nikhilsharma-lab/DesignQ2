"use client";

import { useState, useRef, useEffect } from "react";
import { addDays, addWeeks, format } from "date-fns";
import { Clock } from "lucide-react";

interface SnoozePopoverProps {
  onSnooze: (until: Date) => void;
  label?: string;
}

export function SnoozePopover({ onSnooze, label = "Snooze" }: SnoozePopoverProps) {
  const [open, setOpen] = useState(false);
  const [customDate, setCustomDate] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  const now = new Date();
  const presets = [
    { label: "Tomorrow", date: addDays(now, 1) },
    { label: "Next week", date: addWeeks(now, 1) },
    { label: "In 2 weeks", date: addWeeks(now, 2) },
  ];

  function handlePreset(date: Date) {
    onSnooze(date);
    setOpen(false);
  }

  function handleCustomConfirm() {
    if (!customDate) return;
    onSnooze(new Date(customDate));
    setCustomDate("");
    setOpen(false);
  }

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          height: 30,
          padding: "0 10px",
          borderRadius: 5,
          fontSize: 12,
          fontFamily: "'Geist Mono', monospace",
          fontWeight: 500,
          background: "var(--bg-subtle)",
          color: "var(--text-secondary)",
          border: "1px solid var(--border)",
          cursor: "pointer",
          transition: "background 0.1s",
        }}
      >
        <Clock size={13} />
        {label}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            width: 220,
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
            zIndex: 50,
            padding: 6,
          }}
        >
          {presets.map((p) => (
            <button
              key={p.label}
              onClick={() => handlePreset(p.date)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
                padding: "7px 10px",
                borderRadius: 5,
                fontSize: 12,
                fontFamily: "'Geist', sans-serif",
                color: "var(--text-primary)",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span style={{ fontWeight: 500 }}>{p.label}</span>
              <span
                style={{
                  fontFamily: "'Geist Mono', monospace",
                  fontSize: 10,
                  color: "var(--text-tertiary)",
                }}
              >
                {format(p.date, "MMM d")}
              </span>
            </button>
          ))}

          <div
            style={{
              borderTop: "1px solid var(--border)",
              margin: "4px 0",
            }}
          />

          <div style={{ padding: "4px 10px 6px" }}>
            <span
              style={{
                fontFamily: "'Geist Mono', monospace",
                fontSize: 9,
                fontWeight: 500,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "var(--text-tertiary)",
              }}
            >
              CUSTOM DATE
            </span>
            <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
              <input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                min={format(addDays(now, 1), "yyyy-MM-dd")}
                style={{
                  flex: 1,
                  height: 28,
                  padding: "0 6px",
                  borderRadius: 4,
                  border: "1px solid var(--border)",
                  background: "var(--bg-subtle)",
                  fontSize: 11,
                  fontFamily: "'Geist Mono', monospace",
                  color: "var(--text-primary)",
                  outline: "none",
                }}
              />
              <button
                onClick={handleCustomConfirm}
                disabled={!customDate}
                style={{
                  height: 28,
                  padding: "0 8px",
                  borderRadius: 4,
                  fontSize: 11,
                  fontFamily: "'Geist Mono', monospace",
                  fontWeight: 600,
                  background: customDate ? "var(--accent)" : "var(--bg-hover)",
                  color: customDate ? "#fff" : "var(--text-tertiary)",
                  border: "none",
                  cursor: customDate ? "pointer" : "default",
                }}
              >
                Set
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
