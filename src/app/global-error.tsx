"use client";

/**
 * Renders when the root layout fails. Must define its own <html> and <body>.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          fontFamily: "system-ui, sans-serif",
          background: "#0b0a10",
          color: "#f4f2ff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: "28rem" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "0.75rem" }}>
            Application error
          </h1>
          <p style={{ fontSize: "0.875rem", opacity: 0.75, marginBottom: "1.5rem" }}>
            {error.message || "The app hit a fatal error. Try reloading."}
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              borderRadius: "0.75rem",
              border: "none",
              padding: "0.75rem 1.25rem",
              fontWeight: 600,
              fontSize: "0.875rem",
              cursor: "pointer",
              background: "#2dd4bf",
              color: "#0b0a10",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
