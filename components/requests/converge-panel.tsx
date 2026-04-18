"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { addDecisionLogEntry, getDecisionLog } from "@/app/actions/decision-log";
import type { DecisionLogEntry, Iteration } from "@/db/schema";

interface ConvergePanelProps {
  requestId: string;
  iterations: Iteration[];
}

export function ConvergePanel({ requestId, iterations }: ConvergePanelProps) {
  const [entries, setEntries] = useState<DecisionLogEntry[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [title, setTitle] = useState("");
  const [entryType, setEntryType] = useState<"chosen" | "killed">("chosen");
  const [rationale, setRationale] = useState("");
  const [isPending, startTransition] = useTransition();

  const [edgeCases, setEdgeCases] = useState<string[]>([]);
  const [edgeCasesLoading, setEdgeCasesLoading] = useState(false);
  const [edgeCasesFetched, setEdgeCasesFetched] = useState(false);

  const fetchEntries = useCallback(async () => {
    try {
      const data = await getDecisionLog(requestId);
      setEntries(data);
    } catch (err) {
      console.error("[converge-panel] fetch decision log failed:", err);
    }
  }, [requestId]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    startTransition(async () => {
      await addDecisionLogEntry(requestId, {
        title: title.trim(),
        entryType,
        rationale: rationale.trim() || undefined,
      });
      setTitle("");
      setRationale("");
      setShowAddForm(false);
      fetchEntries();
    });
  }

  async function fetchEdgeCases() {
    setEdgeCasesLoading(true);
    try {
      const res = await fetch(`/api/requests/${requestId}/handoff-brief`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to generate");
      const data = await res.json();
      const brief = data.brief ?? data;
      setEdgeCases(brief.edgeCases ?? []);
      setEdgeCasesFetched(true);
    } catch (err) {
      console.error("[converge-panel] edge cases failed:", err);
    } finally {
      setEdgeCasesLoading(false);
    }
  }

  const resolvedTitles = new Set(entries.map((e) => e.title.toLowerCase()));
  const totalIterations = iterations.length;
  const resolvedCount = iterations.filter((it) =>
    resolvedTitles.has(it.title.toLowerCase()),
  ).length;

  return (
    <div className="space-y-4">
      {totalIterations > 0 && (
        <div className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            {resolvedCount}/{totalIterations}
          </span>{" "}
          directions resolved
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-foreground">Decision log</p>
          <Button
            variant="link"
            size="sm"
            onClick={() => setShowAddForm((v) => !v)}
            className="text-[11px]"
          >
            + Log decision
          </Button>
        </div>

        {showAddForm && (
          <form
            onSubmit={handleAdd}
            className="space-y-2 p-3 rounded-lg bg-muted border"
          >
            <Input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Direction or decision title"
              className="text-xs"
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant={entryType === "chosen" ? "default" : "outline"}
                size="xs"
                onClick={() => setEntryType("chosen")}
              >
                Chosen
              </Button>
              <Button
                type="button"
                variant={entryType === "killed" ? "default" : "outline"}
                size="xs"
                onClick={() => setEntryType("killed")}
              >
                Killed
              </Button>
            </div>
            <Textarea
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              placeholder="Why? (optional)"
              rows={2}
              className="text-xs resize-none"
            />
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAddForm(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isPending || !title.trim()}
              >
                {isPending ? "Adding..." : "Add"}
              </Button>
            </div>
          </form>
        )}

        {entries.length === 0 && !showAddForm && (
          <p className="text-[11px] text-muted-foreground/60 py-2">
            Log what you chose and what you killed. Document the why.
          </p>
        )}

        {entries.map((entry) => (
          <div
            key={entry.id}
            className="rounded-lg border p-3 space-y-1"
          >
            <div className="flex items-center gap-2">
              <span
                className={`text-[10px] font-medium uppercase tracking-wide ${
                  entry.entryType === "chosen"
                    ? "text-accent-success"
                    : "text-muted-foreground/60 line-through"
                }`}
              >
                {entry.entryType}
              </span>
              <span className="text-xs font-medium text-foreground">
                {entry.title}
              </span>
            </div>
            {entry.rationale && (
              <p className="text-xs text-muted-foreground">{entry.rationale}</p>
            )}
          </div>
        ))}
      </div>

      {!edgeCasesFetched && !edgeCasesLoading && (
        <div className="border border-dashed rounded-lg p-4 text-center space-y-2">
          <p className="text-[11px] text-muted-foreground">
            AI can suggest edge cases you might have missed.
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchEdgeCases}
          >
            Generate edge cases
          </Button>
        </div>
      )}

      {edgeCasesLoading && (
        <div className="border border-dashed rounded-lg p-4 text-center">
          <p className="text-[11px] text-muted-foreground animate-pulse">
            Generating edge cases...
          </p>
        </div>
      )}

      {edgeCasesFetched && edgeCases.length > 0 && (
        <div className="border rounded-lg p-4 space-y-2">
          <p className="text-xs font-medium text-foreground">AI edge cases</p>
          {edgeCases.map((ec, i) => (
            <p
              key={i}
              className="text-xs text-muted-foreground flex items-start gap-1.5"
            >
              <span className="text-muted-foreground/40 shrink-0">?</span>
              {ec}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
