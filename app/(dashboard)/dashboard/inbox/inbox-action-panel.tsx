"use client";

import { useState, useRef, useTransition } from "react";
import Link from "next/link";
import {
  UserPlus,
  MessageSquare,
  AtSign,
  ArrowRight,
  Shield,
  CheckCircle2,
  XCircle,
  FileWarning,
  ThumbsUp,
  Sparkles,
  Bell,
  FolderOpen,
  ExternalLink,
  Send,
  Check,
  X,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

interface InboxNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  url: string;
  readAt: string | null;
  archivedAt: string | null;
  snoozedUntil: string | null;
  createdAt: string;
  requestId: string | null;
  actorName: string | null;
}

interface ActionPanelProps {
  notification: InboxNotification;
  onArchive: (id: string) => void;
  onToggleRead: (id: string) => void;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function getInitials(name: string | null): string {
  if (!name) return "S";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const typeConfig: Record<string, { icon: typeof Bell; color: string; label: string }> = {
  assigned: { icon: UserPlus, color: "var(--notif-assigned)", label: "Assignment" },
  comment: { icon: MessageSquare, color: "var(--notif-comment)", label: "Comment" },
  mention: { icon: AtSign, color: "var(--notif-mention)", label: "Mention" },
  stage_change: { icon: ArrowRight, color: "var(--notif-stage-change)", label: "Stage Change" },
  signoff_requested: { icon: Shield, color: "var(--notif-signoff-requested)", label: "Sign-off Request" },
  signoff_submitted: { icon: CheckCircle2, color: "var(--notif-signoff-submitted)", label: "Sign-off Submitted" },
  request_approved: { icon: CheckCircle2, color: "var(--notif-request-approved)", label: "Request Approved" },
  request_rejected: { icon: XCircle, color: "var(--notif-request-rejected)", label: "Request Rejected" },
  figma_update: { icon: FileWarning, color: "var(--notif-figma-update)", label: "Figma Update" },
  idea_vote: { icon: ThumbsUp, color: "var(--notif-idea-vote)", label: "Idea Vote" },
  idea_approved: { icon: Sparkles, color: "var(--notif-idea-approved)", label: "Idea Approved" },
  nudge: { icon: Bell, color: "var(--notif-nudge)", label: "Nudge" },
  project_update: { icon: FolderOpen, color: "var(--notif-project-update)", label: "Project Update" },
};

// ── Sub-panels ──────────────────────────────────────────────────────────────

function SignoffRequestedPanel({ notification, onArchive }: { notification: InboxNotification; onArchive: (id: string) => void }) {
  const [decision, setDecision] = useState<string | null>(null);
  const [conditions, setConditions] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit() {
    if (!decision || !notification.requestId) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/requests/${notification.requestId}/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          conditions: decision === "approved_with_conditions" ? conditions : undefined,
          comments: decision === "rejected" ? reason : undefined,
        }),
      });
      if (res.ok) {
        setSubmitted(true);
        setTimeout(() => onArchive(notification.id), 800);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <CheckCircle2 size={28} className="text-green-500 mb-2" />
        <p className="text-sm font-medium text-foreground">Sign-off submitted</p>
        <p className="text-xs text-muted-foreground mt-1">Moving to done...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Review and submit your sign-off for this request.</p>

      <div className="flex flex-col gap-2">
        {(["approved", "approved_with_conditions", "rejected"] as const).map((d) => (
          <button
            key={d}
            onClick={() => setDecision(decision === d ? null : d)}
            className={`text-left text-sm px-3 py-2.5 rounded-lg border transition-colors ${
              decision === d
                ? d === "approved"
                  ? "bg-green-500/10 border-green-500/30 text-green-600"
                  : d === "approved_with_conditions"
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-600"
                  : "bg-red-500/10 border-red-500/30 text-red-600"
                : "border-border hover:bg-accent text-foreground"
            }`}
          >
            {d === "approved" ? "Approve" : d === "approved_with_conditions" ? "Approve with conditions" : "Request changes"}
          </button>
        ))}
      </div>

      {decision === "approved_with_conditions" && (
        <input
          type="text"
          value={conditions}
          onChange={(e) => setConditions(e.target.value)}
          placeholder="Describe the conditions..."
          className="w-full bg-muted border rounded-lg px-3 py-2 text-sm text-foreground placeholder-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/30"
        />
      )}

      {decision === "rejected" && (
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="What needs to change?"
          rows={3}
          className="w-full bg-muted border rounded-lg px-3 py-2 text-sm text-foreground placeholder-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none"
        />
      )}

      {decision && (
        <button
          onClick={handleSubmit}
          disabled={submitting || (decision === "approved_with_conditions" && !conditions.trim())}
          className={`w-full text-sm font-medium px-3 py-2.5 rounded-lg transition-colors disabled:opacity-40 ${
            decision === "rejected"
              ? "bg-red-600 hover:bg-red-500 text-white"
              : "bg-primary hover:opacity-90 text-primary-foreground"
          }`}
        >
          {submitting ? "Submitting..." : "Submit sign-off"}
        </button>
      )}
    </div>
  );
}

function CommentPanel({ notification, onArchive }: { notification: InboxNotification; onArchive: (id: string) => void }) {
  const [isPending, startTransition] = useTransition();
  const [reply, setReply] = useState("");
  const [sent, setSent] = useState(false);

  function handleReply() {
    if (!reply.trim() || !notification.requestId) return;
    startTransition(async () => {
      const res = await fetch(`/api/requests/${notification.requestId}/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: reply }),
      });
      if (res.ok) {
        setSent(true);
        setReply("");
        setTimeout(() => onArchive(notification.id), 800);
      }
    });
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <CheckCircle2 size={28} className="text-green-500 mb-2" />
        <p className="text-sm font-medium text-foreground">Reply sent</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Original comment */}
      {notification.body && (
        <div className="bg-muted rounded-lg p-3 border">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-accent border flex items-center justify-center text-[9px] font-medium text-foreground">
              {getInitials(notification.actorName)}
            </div>
            <span className="text-xs font-medium text-foreground">{notification.actorName || "System"}</span>
          </div>
          <p className="text-sm text-foreground/80 leading-relaxed">{notification.body}</p>
        </div>
      )}

      {/* Reply */}
      {notification.requestId && (
        <div className="space-y-2">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Write a reply..."
            rows={3}
            className="w-full bg-muted border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.metaKey) handleReply();
            }}
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground/50">
              {reply.trim() ? "⌘↵ to send" : ""}
            </span>
            <button
              onClick={handleReply}
              disabled={isPending || !reply.trim()}
              className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-colors disabled:opacity-40"
            >
              <Send size={13} />
              {isPending ? "Sending..." : "Reply"}
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => onArchive(notification.id)}
        className="w-full text-xs text-muted-foreground hover:text-foreground py-2 transition-colors"
      >
        Mark as done without replying
      </button>
    </div>
  );
}

function FigmaDriftPanel({ notification, onArchive }: { notification: InboxNotification; onArchive: (id: string) => void }) {
  const [reviewed, setReviewed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleMarkReviewed() {
    setSubmitting(true);
    // Mark the notification as done — the full Figma review flow happens on the request page
    onArchive(notification.id);
    setReviewed(true);
    setSubmitting(false);
  }

  if (reviewed) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <CheckCircle2 size={28} className="text-green-500 mb-2" />
        <p className="text-sm font-medium text-foreground">Acknowledged</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
        <p className="text-xs text-amber-600 font-medium mb-1">Post-handoff change detected</p>
        <p className="text-xs text-muted-foreground">
          {notification.body || "A design file was updated after handoff. Review the changes to ensure your implementation stays in sync."}
        </p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleMarkReviewed}
          disabled={submitting}
          className="flex-1 text-sm font-medium px-3 py-2.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-colors disabled:opacity-40"
        >
          <Check size={14} className="inline mr-1.5" />
          Acknowledge
        </button>
      </div>

      <p className="text-[11px] text-muted-foreground/60 text-center">
        Open the request to do a full Figma review
      </p>
    </div>
  );
}

function NudgePanel({ notification, onArchive }: { notification: InboxNotification; onArchive: (id: string) => void }) {
  const [responded, setResponded] = useState(false);
  const [selectedResponse, setSelectedResponse] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const responses = [
    { key: "blocked", label: "I'm blocked", icon: "🚧", desc: "Something is preventing progress" },
    { key: "thinking", label: "Still thinking", icon: "💭", desc: "Working through the problem" },
    { key: "update", label: "Update now", icon: "✏️", desc: "I'll post a reflection" },
  ];

  function handleRespond(responseKey: string) {
    setSelectedResponse(responseKey);

    startTransition(async () => {
      // Post a comment on the request if linked
      if (notification.requestId) {
        const responseMap: Record<string, string> = {
          blocked: "I'm currently blocked on this — will update when I have a path forward.",
          thinking: "Still thinking through the approach. Will share progress soon.",
          update: "Thanks for the nudge — posting a reflection now.",
        };
        await fetch(`/api/requests/${notification.requestId}/comment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: responseMap[responseKey] || "Acknowledged" }),
        });
      }
      setResponded(true);
      setTimeout(() => onArchive(notification.id), 800);
    });
  }

  if (responded) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <CheckCircle2 size={28} className="text-green-500 mb-2" />
        <p className="text-sm font-medium text-foreground">Response logged</p>
        <p className="text-xs text-muted-foreground mt-1">A check-in was posted on the request.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">How&apos;s this going? Pick the option that fits best.</p>

      <div className="flex flex-col gap-2">
        {responses.map((r) => (
          <button
            key={r.key}
            onClick={() => handleRespond(r.key)}
            disabled={isPending}
            className={`text-left px-3 py-3 rounded-lg border transition-colors hover:bg-accent ${
              selectedResponse === r.key ? "bg-accent border-primary/30" : "border-border"
            } disabled:opacity-60`}
          >
            <div className="flex items-center gap-2">
              <span className="text-base">{r.icon}</span>
              <span className="text-sm font-medium text-foreground">{r.label}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 ml-7">{r.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function StageChangePanel({ notification, onArchive }: { notification: InboxNotification; onArchive: (id: string) => void }) {
  return (
    <div className="space-y-4">
      {notification.body && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
          <p className="text-sm text-foreground/80 leading-relaxed">{notification.body}</p>
        </div>
      )}

      <button
        onClick={() => onArchive(notification.id)}
        className="w-full text-sm font-medium px-3 py-2.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-colors"
      >
        <Check size={14} className="inline mr-1.5" />
        Acknowledge
      </button>
    </div>
  );
}

function GenericPanel({ notification, onArchive }: { notification: InboxNotification; onArchive: (id: string) => void }) {
  return (
    <div className="space-y-4">
      {notification.body && (
        <div className="bg-muted rounded-lg p-3 border">
          <p className="text-sm text-foreground/80 leading-relaxed">{notification.body}</p>
        </div>
      )}

      <button
        onClick={() => onArchive(notification.id)}
        className="w-full text-sm font-medium px-3 py-2.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-colors"
      >
        <Check size={14} className="inline mr-1.5" />
        Mark as done
      </button>
    </div>
  );
}

// ── Main Action Panel ───────────────────────────────────────────────────────

export function InboxActionPanel({ notification, onArchive, onToggleRead }: ActionPanelProps) {
  const config = typeConfig[notification.type] || { icon: Bell, color: "var(--notif-project-update)", label: notification.type };
  const Icon = config.icon;
  const isUnread = !notification.readAt;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-4 border-b shrink-0">
        <div className="flex items-center gap-2.5 mb-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{ background: `${config.color}15` }}
          >
            <Icon size={16} style={{ color: config.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <span
              className="text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: config.color }}
            >
              {config.label}
            </span>
            <p className="text-xs text-muted-foreground/60 mt-0.5">{formatTime(notification.createdAt)}</p>
          </div>

          {/* Quick actions */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => onToggleRead(notification.id)}
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              title={isUnread ? "Mark as read (U)" : "Mark as unread (U)"}
            >
              <div
                className={`w-2.5 h-2.5 rounded-full border-2 ${
                  isUnread ? "border-primary bg-primary" : "border-muted-foreground/40"
                }`}
              />
            </button>
            <button
              onClick={() => onArchive(notification.id)}
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-green-500/10 text-muted-foreground hover:text-green-600 transition-colors"
              title="Mark as done (E)"
            >
              <Check size={15} />
            </button>
          </div>
        </div>

        {/* Title */}
        <h2 className="text-sm font-semibold text-foreground leading-snug">{notification.title}</h2>

        {/* Actor */}
        {notification.actorName && (
          <div className="flex items-center gap-2 mt-2.5">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-medium border"
              style={{
                background: "var(--accent)",
                color: "var(--foreground)",
                borderColor: "var(--border)",
              }}
            >
              {getInitials(notification.actorName)}
            </div>
            <span className="text-xs text-muted-foreground">{notification.actorName}</span>
          </div>
        )}
      </div>

      {/* Content — scrollable */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {renderActionContent(notification, onArchive)}
      </div>

      {/* Footer — view full request */}
      <div className="px-5 py-3 border-t shrink-0">
        <Link
          href={notification.url}
          className="flex items-center justify-center gap-1.5 w-full text-xs font-medium text-muted-foreground hover:text-foreground py-2 rounded-lg hover:bg-accent transition-colors"
        >
          <ExternalLink size={12} />
          View full {notification.requestId ? "request" : "page"}
        </Link>
      </div>
    </div>
  );
}

function renderActionContent(notification: InboxNotification, onArchive: (id: string) => void) {
  switch (notification.type) {
    case "signoff_requested":
      return <SignoffRequestedPanel notification={notification} onArchive={onArchive} />;

    case "comment":
    case "mention":
      return <CommentPanel notification={notification} onArchive={onArchive} />;

    case "figma_update":
      return <FigmaDriftPanel notification={notification} onArchive={onArchive} />;

    case "nudge":
      return <NudgePanel notification={notification} onArchive={onArchive} />;

    case "stage_change":
      return <StageChangePanel notification={notification} onArchive={onArchive} />;

    case "signoff_submitted":
    case "request_approved":
    case "request_rejected":
    case "assigned":
    case "idea_vote":
    case "idea_approved":
    case "project_update":
    default:
      return <GenericPanel notification={notification} onArchive={onArchive} />;
  }
}
