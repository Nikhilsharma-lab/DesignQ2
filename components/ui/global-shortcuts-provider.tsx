"use client";

import { useState, useEffect, createContext, useContext, useCallback } from "react";
import dynamic from "next/dynamic";
import type { ComponentType } from "react";

interface ModalProps {
  onClose: () => void;
}

// Lazy-load modals so they don't bloat the initial bundle
const CommandPalette = dynamic<ModalProps>(
  () => import("./command-palette").then((m) => m.CommandPalette as ComponentType<ModalProps>),
  { ssr: false }
);
const QuickCapture = dynamic<ModalProps>(
  () => import("./quick-capture").then((m) => m.QuickCapture as ComponentType<ModalProps>),
  { ssr: false }
);
const KeyboardShortcuts = dynamic<ModalProps>(
  () => import("./keyboard-shortcuts").then((m) => m.KeyboardShortcuts as ComponentType<ModalProps>),
  { ssr: false }
);

interface ShortcutsCtx {
  openPalette: () => void;
  openQuickCapture: () => void;
  openCheatsheet: () => void;
}

const ShortcutsContext = createContext<ShortcutsCtx>({
  openPalette: () => {},
  openQuickCapture: () => {},
  openCheatsheet: () => {},
});

export function useShortcuts() {
  return useContext(ShortcutsContext);
}

export function GlobalShortcutsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [quickCaptureOpen, setQuickCaptureOpen] = useState(false);
  const [cheatsheetOpen, setCheatsheetOpen] = useState(false);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    const isInput =
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      (e.target as HTMLElement).isContentEditable;

    // Cmd+K / Ctrl+K — command palette
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      setPaletteOpen((v) => !v);
      return;
    }

    // Cmd+N / Ctrl+N — quick capture
    if ((e.metaKey || e.ctrlKey) && e.key === "n") {
      e.preventDefault();
      setQuickCaptureOpen((v) => !v);
      return;
    }

    // ? — cheatsheet (not when typing in an input)
    if (!isInput && e.key === "?") {
      e.preventDefault();
      setCheatsheetOpen((v) => !v);
    }
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <ShortcutsContext.Provider
      value={{
        openPalette: () => setPaletteOpen(true),
        openQuickCapture: () => setQuickCaptureOpen(true),
        openCheatsheet: () => setCheatsheetOpen(true),
      }}
    >
      {children}

      {paletteOpen && (
        <CommandPalette onClose={() => setPaletteOpen(false)} />
      )}
      {quickCaptureOpen && (
        <QuickCapture onClose={() => setQuickCaptureOpen(false)} />
      )}
      {cheatsheetOpen && (
        <KeyboardShortcuts onClose={() => setCheatsheetOpen(false)} />
      )}
    </ShortcutsContext.Provider>
  );
}
