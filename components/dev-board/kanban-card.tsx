"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ProjectBadge } from "@/components/projects/project-badge";
import type { CardData } from "./types";

const PRIORITY_COLORS: Record<string, string> = {
  p0: "bg-red-500/15 text-red-400 border-red-500/20",
  p1: "bg-orange-500/15 text-orange-400 border-orange-500/20",
  p2: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
  p3: "bg-zinc-700/50 text-zinc-400 border-zinc-700",
};

interface Props {
  card: CardData;
  isFocused: boolean;
  onClick: () => void;
  onFocus: () => void;
}

export function KanbanCard({ card, isFocused, onClick, onFocus }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      tabIndex={0}
      onClick={onClick}
      onFocus={onFocus}
      className={`bg-zinc-900 border rounded-lg px-3 py-3 cursor-pointer select-none focus:outline-none transition-colors space-y-2 ${
        isFocused
          ? "border-indigo-500/50 ring-1 ring-indigo-500/20"
          : "border-zinc-800 hover:border-zinc-700"
      }`}
    >
      {/* Title */}
      <p className="text-xs font-medium text-zinc-200 leading-snug line-clamp-2">
        {card.title}
      </p>

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5">
        {card.priority && (
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${
              PRIORITY_COLORS[card.priority] ?? ""
            }`}
          >
            {card.priority.toUpperCase()}
          </span>
        )}
        {card.requestType && (
          <span className="text-[10px] text-zinc-500 bg-zinc-800/60 border border-zinc-700/40 rounded px-1.5 py-0.5 capitalize">
            {card.requestType}
          </span>
        )}
      </div>

      {/* Project */}
      {card.projectName && card.projectColor && (
        <ProjectBadge name={card.projectName} color={card.projectColor} />
      )}

      {/* Footer: assignees + deadline */}
      <div className="flex items-center justify-between gap-2">
        {card.assignees.length > 0 && (
          <span className="text-[10px] text-zinc-500 truncate">
            {card.assignees.join(", ")}
          </span>
        )}
        {card.deadlineAt && (
          <span className="text-[10px] text-zinc-600 shrink-0">
            {new Date(card.deadlineAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </span>
        )}
      </div>
    </div>
  );
}
