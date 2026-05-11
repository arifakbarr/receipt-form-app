import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]">
        404
      </p>
      <h1 className="font-display text-2xl font-semibold text-[var(--foreground)]">
        Page not found
      </h1>
      <Link
        href="/"
        className="mt-4 rounded-xl bg-[var(--foreground)] px-6 py-3 text-sm font-semibold text-[var(--background)]"
      >
        Back home
      </Link>
    </div>
  );
}
