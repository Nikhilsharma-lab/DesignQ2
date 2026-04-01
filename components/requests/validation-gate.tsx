"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

type SignerRole = "designer" | "pm" | "design_head";
type Decision = "approved" | "approved_with_conditions" | "rejected";

interface Signoff {
  id: string;
  signerRole: SignerRole;
  decision: Decision;
  conditions: string | null;
  comments: string | null;
  signedAt: string;
}

interface ValidationGateProps {
  requestId: string;
  myProfileRole: string; // raw profile role (designer/pm/lead/admin)
}

const ROLES: { key: SignerRole; label: string; desc: string }[] = [
  { key: "designer",    label: "Designer",    desc: "Design is complete and ready" },
  { key: "pm",          label: "PM",          desc: "Solves the original problem" },
  { key: "design_head", label: "Design Head", desc: "Quality standards met" },
];

function signerRoleFromProfile(role: string): SignerRole | null {
  if (role === "designer") return "designer";
  if (role === "pm") return "pm";
  if (role === "lead" || role === "admin") return "design_head";
  return null;
}

const decisionStyles: Record<Decision, string> = {
  approved: "text-green-400 bg-green-500/10 border-green-500/20",
  approved_with_conditions: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  rejected: "text-red-400 bg-red-500/10 border-red-500/20",
};

const decisionLabels: Record<Decision, string> = {
  approved: "Approved",
  approved_with_conditions: "Approved with conditions",
  rejected: "Rejected",
};

export function ValidationGate({ requestId, myProfileRole }: ValidationGateProps) {
  const router = useRouter();
  const mySignerRole = signerRoleFromProfile(myProfileRole);

  const [signoffs, setSignoffs] = useState<Signoff[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Per-role action state
  const [activeDecision, setActiveDecision] = useState<Decision | null>(null);
  const [conditions, setConditions] = useState("");
  const [commentText, setCommentText] = useState("");

  const fetchSignoffs = useCallback(async () => {
    try {
      const res = await fetch(`/api/requests/${requestId}/validate`);
      const data = await res.json();
      if (res.ok) setSignoffs(data.signoffs);
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => { fetchSignoffs(); }, [fetchSignoffs]);

  async function handleSubmit() {
    if (!activeDecision) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/requests/${requestId}/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: activeDecision, conditions, comments: commentText }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to submit");
      } else {
        setActiveDecision(null);
        setConditions("");
        setCommentText("");
        if (data.autoAdvanced) {
          router.refresh();
        } else {
          await fetchSignoffs();
        }
      }
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  const mySignoff = signoffs.find((s) => s.signerRole === mySignerRole);
  const allSigned = ["designer", "pm", "design_head"].every((r) =>
    signoffs.some((s) => s.signerRole === r && s.decision !== "rejected")
  );
  const anyRejected = signoffs.some((s) => s.decision === "rejected");

  return (
    <div className="space-y-3">
      {/* Status banner */}
      {allSigned && (
        <div className="bg-green-500/5 border border-green-500/20 rounded-lg px-3 py-2.5 flex items-center gap-2">
          <span className="text-green-400 text-xs">✓</span>
          <p className="text-[11px] text-green-400">All 3 sign-offs received — advancing to Handoff</p>
        </div>
      )}
      {anyRejected && !allSigned && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2.5">
          <p className="text-[11px] text-red-400">Validation rejected — design needs revision before re-submission</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-2">
          <div className="w-3 h-3 border border-zinc-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-zinc-600">Loading sign-offs...</span>
        </div>
      ) : (
        <>
          {/* 3-row sign-off table */}
          <div className="border border-zinc-800 rounded-xl overflow-hidden divide-y divide-zinc-800/60">
            {ROLES.map((role) => {
              const signoff = signoffs.find((s) => s.signerRole === role.key);
              const isMyRole = mySignerRole === role.key;

              return (
                <div key={role.key} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-zinc-300">{role.label}</span>
                        {isMyRole && (
                          <span className="text-[10px] text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 rounded px-1.5 py-0.5">you</span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-600 mt-0.5">{role.desc}</p>
                      {signoff?.conditions && (
                        <p className="text-[11px] text-amber-400/80 mt-1 italic">Conditions: {signoff.conditions}</p>
                      )}
                    </div>

                    {/* Status */}
                    <div className="shrink-0">
                      {signoff ? (
                        <span className={`text-[10px] px-2 py-0.5 rounded border font-medium ${decisionStyles[signoff.decision]}`}>
                          {decisionLabels[signoff.decision]}
                        </span>
                      ) : (
                        <span className="text-[10px] text-zinc-700 bg-zinc-900 border border-zinc-800 rounded px-2 py-0.5">Pending</span>
                      )}
                    </div>
                  </div>

                  {/* Action buttons for current user's role */}
                  {isMyRole && !allSigned && (
                    <div className="mt-3 space-y-2">
                      {/* Decision buttons */}
                      <div className="flex gap-1.5 flex-wrap">
                        {(["approved", "approved_with_conditions", "rejected"] as Decision[]).map((d) => (
                          <button
                            key={d}
                            onClick={() => setActiveDecision(activeDecision === d ? null : d)}
                            className={`text-[11px] px-2.5 py-1 rounded border transition-colors ${
                              activeDecision === d
                                ? d === "approved"
                                  ? "bg-green-500/15 border-green-500/30 text-green-400"
                                  : d === "approved_with_conditions"
                                  ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                                  : "bg-red-500/15 border-red-500/30 text-red-400"
                                : "border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700"
                            }`}
                          >
                            {d === "approved" ? "Approve" : d === "approved_with_conditions" ? "Approve with conditions" : "Reject"}
                          </button>
                        ))}
                      </div>

                      {/* Conditions input */}
                      {activeDecision === "approved_with_conditions" && (
                        <input
                          type="text"
                          value={conditions}
                          onChange={(e) => setConditions(e.target.value)}
                          placeholder="Describe the conditions..."
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-700 focus:outline-none focus:border-zinc-600 transition-colors"
                        />
                      )}

                      {/* Rejection reason */}
                      {activeDecision === "rejected" && (
                        <input
                          type="text"
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          placeholder="Reason for rejection..."
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-700 focus:outline-none focus:border-zinc-600 transition-colors"
                        />
                      )}

                      {/* Submit */}
                      {activeDecision && (
                        <button
                          onClick={handleSubmit}
                          disabled={submitting || (activeDecision === "approved_with_conditions" && !conditions.trim())}
                          className={`text-[11px] px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 ${
                            activeDecision === "rejected"
                              ? "bg-red-600 hover:bg-red-500 text-white"
                              : "bg-indigo-600 hover:bg-indigo-500 text-white"
                          }`}
                        >
                          {submitting && <span className="w-2.5 h-2.5 border border-white border-t-transparent rounded-full animate-spin" />}
                          {submitting ? "Submitting..." : "Confirm"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Progress summary */}
          <p className="text-[10px] text-zinc-700 text-center">
            {signoffs.filter((s) => s.decision !== "rejected").length} / 3 approvals received
          </p>
        </>
      )}

      {error && (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
      )}
    </div>
  );
}
