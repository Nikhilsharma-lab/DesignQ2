"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

const PHASES = [
  { value: "predesign", label: "Predesign" },
  { value: "design", label: "Design" },
  { value: "dev", label: "Build" },
  { value: "track", label: "Track" },
] as const;

export function PhaseFilter({
  activePhase,
}: {
  activePhase: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setPhase(phase: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (phase) {
      params.set("phase", phase);
    } else {
      params.delete("phase");
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className="flex gap-1">
      <Button
        size="sm"
        variant={!activePhase ? "default" : "ghost"}
        onClick={() => setPhase(null)}
        className={
          !activePhase
            ? ""
            : "bg-muted text-muted-foreground hover:text-foreground"
        }
      >
        All
      </Button>
      {PHASES.map((phase) => (
        <Button
          key={phase.value}
          size="sm"
          variant={activePhase === phase.value ? "default" : "ghost"}
          onClick={() =>
            setPhase(activePhase === phase.value ? null : phase.value)
          }
          className={
            activePhase === phase.value
              ? ""
              : "bg-muted text-muted-foreground hover:text-foreground"
          }
        >
          {phase.label}
        </Button>
      ))}
    </div>
  );
}
