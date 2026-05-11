"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app error]", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <div className="rounded-2xl border border-[var(--border-strong)] bg-[var(--card-solid)] p-8 shadow-lg">
        <p className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]">
          Something went wrong
        </p>
        <h1 className="font-display mt-3 text-2xl font-semibold text-[var(--foreground)]">
          We could not render this page
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
          {error.message || "An unexpected error occurred."}
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-6 rounded-xl bg-[var(--foreground)] px-6 py-3 text-sm font-semibold text-[var(--background)] transition hover:opacity-90"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
