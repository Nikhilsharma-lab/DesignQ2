"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

interface NotificationItem {
  id: string;
  type: "assigned" | "comment" | "stage";
  requestId: string;
  requestTitle: string;
  body: string;
  createdAt: string;
  forYou: boolean;
}

function timeAgo(date: string) {
  const s = (Date.now() - new Date(date).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const typeIcon: Record<string, string> = {
  assigned: "→",
  comment: "↩",
  stage: "⭢",
};

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Load on mount silently to get unread count
  useEffect(() => {
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []));
  }, []);

  function handleOpen() {
    if (!open) {
      setOpen(true);
      setLoading(true);
      fetch("/api/notifications")
        .then((r) => r.json())
        .then((d) => {
          const fetched: NotificationItem[] = d.items ?? [];
          setItems(fetched);
          setSeen(new Set(fetched.map((i) => i.id)));
        })
        .finally(() => setLoading(false));
    } else {
      setOpen(false);
    }
  }

  const unread = items.filter((i) => !seen.has(i.id)).length;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleOpen}
        className="relative text-zinc-500 hover:text-zinc-300 transition-colors p-1"
        aria-label="Notifications"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M8 1.5a4.5 4.5 0 0 0-4.5 4.5v2.5L2 10h12l-1.5-1.5V6A4.5 4.5 0 0 0 8 1.5z"/>
          <path d="M6.5 13a1.5 1.5 0 0 0 3 0"/>
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-indigo-500 rounded-full text-[8px] text-white flex items-center justify-center font-medium">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-8 w-80 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Activity</span>
            {items.length > 0 && (
              <span className="text-[10px] text-zinc-600">{items.length} events</span>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="flex items-center gap-2 px-4 py-6">
                <span className="w-3 h-3 border-2 border-zinc-700 border-t-indigo-400 rounded-full animate-spin" />
                <span className="text-xs text-zinc-600">Loading…</span>
              </div>
            ) : items.length === 0 ? (
              <p className="text-xs text-zinc-600 px-4 py-6 text-center">No activity yet</p>
            ) : (
              items.map((item) => (
                <Link
                  key={item.id}
                  href={`/dashboard/requests/${item.requestId}`}
                  onClick={() => setOpen(false)}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-zinc-800/60 transition-colors border-b border-zinc-800/50 last:border-0"
                >
                  <span className="text-xs text-zinc-500 mt-0.5 w-4 shrink-0">{typeIcon[item.type]}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-zinc-300 truncate font-medium">{item.requestTitle}</p>
                    <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{item.body}</p>
                  </div>
                  <span className="text-[10px] text-zinc-700 shrink-0 mt-0.5">{timeAgo(item.createdAt)}</span>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
