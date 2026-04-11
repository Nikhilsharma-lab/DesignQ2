"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

export type GroupByOption =
  | "none"
  | "phase"
  | "stage"
  | "project"
  | "assignee"
  | "priority"
  | "cycle";

const GROUP_BY_OPTIONS: { value: GroupByOption; label: string }[] = [
  { value: "none", label: "None" },
  { value: "phase", label: "Phase" },
  { value: "stage", label: "Stage" },
  { value: "project", label: "Project" },
  { value: "assignee", label: "Assignee" },
  { value: "priority", label: "Priority" },
  { value: "cycle", label: "Cycle" },
];

interface GroupByDropdownProps {
  value: GroupByOption;
  onChange: (value: GroupByOption) => void;
}

export function GroupByDropdown({ value, onChange }: GroupByDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedLabel =
    GROUP_BY_OPTIONS.find((o) => o.value === value)?.label ?? "None";

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          height: 28,
          padding: "0 10px",
          border: "1px solid hsl(var(--border))",
          borderRadius: 6,
          background: open ? "hsl(hsl(var(--primary)))" : "hsl(var(--card))",
          color: "hsl(var(--muted-foreground))",
          fontFamily: "'Geist Mono', monospace",
          fontSize: 11,
          fontWeight: 500,
          cursor: "pointer",
          whiteSpace: "nowrap",
          transition: "background 0.1s",
        }}
        className="hover:bg-[hsl(hsl(var(--primary)))]"
      >
        <span style={{ color: "hsl(var(--muted-foreground) / 0.6)" }}>Group:</span>
        <span style={{ color: "hsl(var(--foreground))", marginLeft: 3 }}>
          {selectedLabel}
        </span>
        <ChevronDown
          size={12}
          style={{
            marginLeft: 2,
            color: "hsl(var(--muted-foreground) / 0.6)",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.15s",
          }}
        />
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            zIndex: 50,
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
            minWidth: 140,
            overflow: "hidden",
          }}
        >
          {GROUP_BY_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "7px 12px",
                fontFamily: "'Geist Mono', monospace",
                fontSize: 11,
                fontWeight: value === option.value ? 600 : 400,
                color:
                  value === option.value
                    ? "hsl(var(--primary))"
                    : "hsl(var(--foreground))",
                background:
                  value === option.value
                    ? "hsl(var(--muted))"
                    : "transparent",
                border: "none",
                cursor: "pointer",
                transition: "background 0.1s",
              }}
              className="hover:bg-[hsl(hsl(var(--primary)))]"
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
