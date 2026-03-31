"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function RequestError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[RequestDetail] Error:", error.message, error.digest, error.stack);
  }, [error]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
      <div className="text-center max-w-md px-6">
        <p className="text-zinc-500 text-sm mb-1">Something went wrong loading this request.</p>
        {error.digest && (
          <p className="text-zinc-700 text-xs mb-6 font-mono">Digest: {error.digest}</p>
        )}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="text-sm text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-500 rounded-lg px-4 py-2 transition-colors"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Back to requests
          </Link>
        </div>
      </div>
    </div>
  );
}
