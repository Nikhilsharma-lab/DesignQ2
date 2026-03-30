"use client";

import { useState } from "react";
import { EditRequestModal } from "./edit-request-modal";
import type { Request } from "@/db/schema";

export function EditRequestButton({ request }: { request: Request }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {open && <EditRequestModal request={request} onClose={() => setOpen(false)} />}
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-zinc-500 hover:text-zinc-300 border border-zinc-800 hover:border-zinc-700 rounded-lg px-3 py-1.5 transition-colors"
      >
        Edit
      </button>
    </>
  );
}
