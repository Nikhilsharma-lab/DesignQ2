"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { markHintSeen } from "@/app/actions/mark-hint-seen";

interface ProveFirstTimeModalProps {
  open: boolean;
  onClose: () => void;
  onProceed: () => void;
}

/**
 * First-time teaching moment for the Prove gate, shown the first time a user
 * advances a Request from Converge to Prove. Dismissed on "Request sign-off"
 * (proceeds with advance + marks seen) or "Not ready yet" (cancels advance,
 * does NOT mark seen — user can re-trigger later).
 */
export function ProveFirstTimeModal({
  open,
  onClose,
  onProceed,
}: ProveFirstTimeModalProps) {
  function handleProceed() {
    // Fire-and-forget: user continues immediately even if the write is in flight.
    markHintSeen("prove_modal").catch((err) => {
      console.error("[prove-first-time-modal] markHintSeen failed:", err);
    });
    onProceed();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Prove</DialogTitle>
          <DialogDescription>
            Before a Request moves from Converge to Prove, it needs three
            sign-offs: you (the designer), the PM, and the design lead.
            This is Lane&apos;s one deliberate slow-down — the place where
            non-linear work becomes intentional.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Not ready yet
          </Button>
          <Button onClick={handleProceed}>Request sign-off</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
