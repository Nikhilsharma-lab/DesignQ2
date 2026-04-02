"use client";
import { useShortcuts } from "./global-shortcuts-provider";

export function HeaderSearch() {
  const { openPalette } = useShortcuts();
  return (
    <button
      onClick={openPalette}
      className="hidden md:flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-400 border border-zinc-800 hover:border-zinc-700 rounded-lg px-2.5 py-1.5 transition-colors"
    >
      <span>Search</span>
      <kbd className="text-[10px] border border-zinc-700 rounded px-1 font-mono bg-zinc-900">⌘K</kbd>
    </button>
  );
}
