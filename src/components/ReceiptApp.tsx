"use client";

import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  emptyReceiptForm,
  type ReceiptFormData,
} from "@/lib/receipt-types";

const STORAGE_KEY = "receipt-form-submissions";

type StoredSubmission = ReceiptFormData & { submittedAt: string };

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const r = reader.result;
      if (typeof r !== "string") {
        reject(new Error("Could not read file"));
        return;
      }
      const comma = r.indexOf(",");
      resolve(comma >= 0 ? r.slice(comma + 1) : r);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

const listVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 420, damping: 32 },
  },
};

export function ReceiptApp() {
  const reduceMotion = useReducedMotion();
  const springConfig = reduceMotion
    ? { type: "tween" as const, duration: 0.15 }
    : { type: "spring" as const, stiffness: 420, damping: 32 };

  const inputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>("image/jpeg");
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [form, setForm] = useState<ReceiptFormData>(emptyReceiptForm());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastModel, setLastModel] = useState<string | null>(null);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [history, setHistory] = useState<StoredSubmission[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [formAnimKey, setFormAnimKey] = useState(0);

  const loadHistory = useCallback(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setHistory([]);
        return;
      }
      const parsed = JSON.parse(raw) as StoredSubmission[];
      setHistory(Array.isArray(parsed) ? parsed : []);
    } catch {
      setHistory([]);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const resetPreview = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setImageBase64(null);
    setMimeType("image/jpeg");
  }, [previewUrl]);

  const processFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        setError("Please choose an image file (JPEG, PNG, GIF, or WebP).");
        return;
      }
      setError(null);
      setSubmitMessage(null);
      resetPreview();
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setMimeType(file.type || "image/jpeg");
      try {
        const b64 = await fileToBase64(file);
        setImageBase64(b64);
      } catch {
        setError("Could not read the image.");
      }
    },
    [resetPreview]
  );

  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current += 1;
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragging(false);
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      dragCounter.current = 0;
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) void processFile(file);
    },
    [processFile]
  );

  const extract = useCallback(async () => {
    if (!imageBase64) {
      setError("Upload a receipt image first.");
      return;
    }
    setLoading(true);
    setError(null);
    setSubmitMessage(null);
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, mimeType }),
      });
      const json = (await res.json()) as {
        data?: ReceiptFormData;
        model?: string;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(json.error ?? "Extraction failed");
      }
      if (json.data) {
        setForm(json.data);
        setLastModel(json.model ?? null);
        setFormAnimKey((k) => k + 1);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Extraction failed");
    } finally {
      setLoading(false);
    }
  }, [imageBase64, mimeType]);

  const updateField = (key: keyof ReceiptFormData, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const submitForm = useCallback(async () => {
    setSubmitMessage(null);
    setError(null);
    const entry: StoredSubmission = {
      ...form,
      submittedAt: new Date().toISOString(),
    };

    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? "Submit failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
      return;
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const prev: StoredSubmission[] = raw ? JSON.parse(raw) : [];
      const next = [entry, ...(Array.isArray(prev) ? prev : [])].slice(0, 50);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setHistory(next);
      setSubmitMessage("Saved locally and acknowledged by the server.");
    } catch {
      setSubmitMessage("Saved on server; local storage unavailable.");
    }
  }, [form]);

  const clearForm = () => {
    setForm(emptyReceiptForm());
    setLastModel(null);
  };

  return (
    <>
      <div className="app-bg" aria-hidden>
        <div className="app-bg__mesh" />
        <div className="app-bg__grid" />
        <div className="app-bg__noise" />
      </div>

      <motion.div
        className="relative z-10 mx-auto max-w-5xl px-4 pb-16 pt-12 sm:px-6 lg:px-8 lg:pb-24 lg:pt-16"
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springConfig}
      >
        <motion.header
          className="mb-12 text-center lg:mb-14"
          variants={listVariants}
          initial="hidden"
          animate="show"
        >
          <motion.div variants={itemVariants}>
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border-strong)] bg-[var(--card-solid)] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)] shadow-glow-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent)] opacity-40" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--accent)]" />
              </span>
              Vision extraction
            </span>
          </motion.div>

          <motion.h1
            variants={itemVariants}
            className="font-display mt-6 bg-gradient-to-br from-[var(--foreground)] via-[var(--foreground)] to-[var(--muted)] bg-clip-text text-4xl font-semibold tracking-tight text-transparent sm:text-5xl sm:leading-[1.1]"
          >
            Receipt to form,
            <br />
            <span className="italic text-[var(--foreground)] opacity-90">
              instantly refined.
            </span>
          </motion.h1>

          <motion.p
            variants={itemVariants}
            className="mx-auto mt-5 max-w-lg text-pretty text-base leading-relaxed text-[var(--muted)]"
          >
            Drop a photo. Our model reads the slip—you steer the final numbers
            before they are saved.
          </motion.p>
        </motion.header>

        <div className="grid gap-6 lg:grid-cols-2 lg:gap-8 lg:items-start">
          {/* Upload */}
          <motion.section
            layout
            className="glass-panel relative overflow-hidden rounded-3xl p-6 sm:p-8"
            initial={reduceMotion ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={springConfig}
          >
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[var(--accent-soft)] blur-3xl" />
            <div className="relative flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]">
                  Step 01
                </p>
                <h2 className="font-display mt-1 text-xl font-semibold tracking-tight">
                  Capture receipt
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                  Drag in or browse. High contrast photos work best.
                </p>
              </div>
            </div>

            <motion.div
              layout
              className="relative mt-6"
              whileHover={
                reduceMotion ? undefined : { scale: imageBase64 ? 1 : 1.01 }
              }
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
            >
              <motion.div
                role="button"
                tabIndex={0}
                layout
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ")
                    inputRef.current?.click();
                }}
                onDragEnter={onDragEnter}
                onDragLeave={onDragLeave}
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDrop}
                animate={{
                  borderColor: isDragging
                    ? "var(--accent)"
                    : "var(--border-strong)",
                  boxShadow: isDragging
                    ? "0 0 0 3px var(--accent-soft), 0 20px 40px -20px var(--accent-glow)"
                    : "0 1px 0 0 var(--border)",
                }}
                transition={{ duration: 0.25 }}
                className="relative flex min-h-[220px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed bg-[var(--card-inner)] px-4 py-10"
                onClick={() => inputRef.current?.click()}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void processFile(f);
                  }}
                />

                <AnimatePresence mode="wait">
                  {previewUrl ? (
                    <motion.div
                      key="preview"
                      initial={
                        reduceMotion ? false : { opacity: 0, scale: 0.96 }
                      }
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={springConfig}
                      className="relative w-full max-w-sm"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- user blob URL */}
                      <img
                        src={previewUrl}
                        alt="Receipt preview"
                        className="max-h-60 w-full rounded-xl object-contain shadow-lg ring-1 ring-black/5"
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="empty"
                      initial={reduceMotion ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex flex-col items-center text-center"
                    >
                      <motion.div
                        animate={
                          reduceMotion
                            ? {}
                            : { y: [0, -4, 0] }
                        }
                        transition={{
                          duration: 3,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                      >
                        <svg
                          className="h-16 w-16 text-[var(--accent)]"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1}
                          aria-hidden
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                          />
                        </svg>
                      </motion.div>
                      <p className="mt-4 text-sm font-semibold text-[var(--foreground)]">
                        Drop an image here or tap to browse
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        JPEG · PNG · GIF · WebP
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {loading && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 flex items-center justify-center bg-[var(--card-solid)]/85 backdrop-blur-sm"
                    >
                      <div className="relative h-full w-full overflow-hidden rounded-xl">
                        <div className="scan-overlay__beam absolute left-[12%] right-[12%] h-0.5 rounded-full bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent shadow-glow" />
                        <p className="absolute bottom-6 left-0 right-0 text-center text-xs font-medium uppercase tracking-widest text-[var(--accent)]">
                          Reading receipt…
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </motion.div>

            <div className="relative mt-6 flex flex-wrap gap-3">
              <motion.button
                type="button"
                whileHover={reduceMotion ? {} : { scale: 1.02 }}
                whileTap={reduceMotion ? {} : { scale: 0.98 }}
                onClick={(e) => {
                  e.stopPropagation();
                  void extract();
                }}
                disabled={!imageBase64 || loading}
                className="group relative inline-flex items-center justify-center overflow-hidden rounded-xl bg-[var(--foreground)] px-6 py-3 text-sm font-semibold text-[var(--background)] shadow-lg transition disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="relative z-10 flex items-center gap-2">
                  {loading ? (
                    <>
                      <Spinner />
                      Extracting
                    </>
                  ) : (
                    <>
                      <SparkIcon />
                      Extract with AI
                    </>
                  )}
                </span>
                {!loading && !reduceMotion && (
                  <motion.span
                    className="absolute inset-0 bg-gradient-to-r from-[var(--accent)] to-emerald-400 opacity-0 transition-opacity group-hover:opacity-20"
                    aria-hidden
                  />
                )}
              </motion.button>

              <AnimatePresence>
                {previewUrl && (
                  <motion.button
                    type="button"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    whileHover={reduceMotion ? {} : { scale: 1.02 }}
                    whileTap={reduceMotion ? {} : { scale: 0.98 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      resetPreview();
                      setForm(emptyReceiptForm());
                      setLastModel(null);
                      if (inputRef.current) inputRef.current.value = "";
                    }}
                    className="rounded-xl border border-[var(--border-strong)] bg-[var(--card-solid)] px-5 py-3 text-sm font-medium text-[var(--foreground)] backdrop-blur-sm hover:bg-[var(--card-inner)]"
                  >
                    Clear
                  </motion.button>
                )}
              </AnimatePresence>
            </div>

            <AnimatePresence>
              {lastModel && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0 }}
                  className="mt-4 text-xs text-[var(--muted)]"
                >
                  Model{" "}
                  <code className="rounded-md bg-[var(--card-inner)] px-2 py-0.5 font-mono text-[11px] text-[var(--foreground)]">
                    {lastModel}
                  </code>
                </motion.p>
              )}
            </AnimatePresence>
          </motion.section>

          {/* Form */}
          <motion.section
            layout
            className="glass-panel relative overflow-hidden rounded-3xl p-6 sm:p-8"
            initial={reduceMotion ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ ...springConfig, delay: reduceMotion ? 0 : 0.06 }}
          >
            <div className="pointer-events-none absolute -left-12 bottom-0 h-40 w-40 rounded-full bg-purple-500/10 blur-3xl" />

            <div className="relative">
              <p className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]">
                Step 02
              </p>
              <h2 className="font-display mt-1 text-xl font-semibold tracking-tight">
                Review & commit
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                Edit anything—these values are yours before submission.
              </p>
            </div>

            <form
              key={formAnimKey}
              className="relative mt-8 space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                void submitForm();
              }}
            >
              <motion.div
                className="space-y-5"
                variants={listVariants}
                initial="hidden"
                animate="show"
              >
                <motion.div variants={itemVariants} className="group">
                  <label
                    htmlFor="merchantName"
                    className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--muted)]"
                  >
                    Merchant
                    <FieldUnderline />
                  </label>
                  <input
                    id="merchantName"
                    type="text"
                    value={form.merchantName}
                    onChange={(e) =>
                      updateField("merchantName", e.target.value)
                    }
                    className="input-focus-ring mt-2 w-full rounded-xl border border-[var(--border-strong)] bg-[var(--input-bg)] px-4 py-3 text-[var(--foreground)] placeholder:text-[var(--muted)]/60 transition-shadow"
                    placeholder="Store or restaurant name"
                    autoComplete="organization"
                  />
                </motion.div>

                <motion.div variants={itemVariants} className="group">
                  <label
                    htmlFor="date"
                    className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--muted)]"
                  >
                    Date
                    <FieldUnderline />
                  </label>
                  <input
                    id="date"
                    type="text"
                    value={form.date}
                    onChange={(e) => updateField("date", e.target.value)}
                    className="input-focus-ring mt-2 w-full rounded-xl border border-[var(--border-strong)] bg-[var(--input-bg)] px-4 py-3 text-[var(--foreground)] placeholder:text-[var(--muted)]/60"
                    placeholder="YYYY-MM-DD"
                  />
                </motion.div>

                <motion.div
                  variants={itemVariants}
                  className="grid grid-cols-2 gap-4"
                >
                  <div className="group">
                    <label
                      htmlFor="totalAmount"
                      className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--muted)]"
                    >
                      Total
                      <FieldUnderline />
                    </label>
                    <input
                      id="totalAmount"
                      type="text"
                      inputMode="decimal"
                      value={form.totalAmount}
                      onChange={(e) =>
                        updateField("totalAmount", e.target.value)
                      }
                      className="input-focus-ring mt-2 w-full rounded-xl border border-[var(--border-strong)] bg-[var(--input-bg)] px-4 py-3 text-[var(--foreground)] tabular-nums placeholder:text-[var(--muted)]/60"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="group">
                    <label
                      htmlFor="currency"
                      className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--muted)]"
                    >
                      Currency
                      <FieldUnderline />
                    </label>
                    <input
                      id="currency"
                      type="text"
                      value={form.currency}
                      onChange={(e) =>
                        updateField("currency", e.target.value.toUpperCase())
                      }
                      className="input-focus-ring mt-2 w-full rounded-xl border border-[var(--border-strong)] bg-[var(--input-bg)] px-4 py-3 font-semibold uppercase tracking-wider text-[var(--foreground)] placeholder:text-[var(--muted)]/60"
                      placeholder="USD"
                      maxLength={3}
                    />
                  </div>
                </motion.div>
              </motion.div>

              <motion.div
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: reduceMotion ? 0 : 0.35 }}
                className="flex flex-wrap gap-3 pt-2"
              >
                <motion.button
                  type="submit"
                  whileHover={reduceMotion ? {} : { scale: 1.02 }}
                  whileTap={reduceMotion ? {} : { scale: 0.98 }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--accent)] to-teal-600 px-6 py-3 text-sm font-semibold text-white shadow-glow"
                >
                  <CheckIcon />
                  Submit
                </motion.button>
                <motion.button
                  type="button"
                  whileHover={reduceMotion ? {} : { scale: 1.02 }}
                  whileTap={reduceMotion ? {} : { scale: 0.98 }}
                  onClick={clearForm}
                  className="rounded-xl border border-[var(--border-strong)] px-5 py-3 text-sm font-medium text-[var(--muted)] hover:bg-[var(--card-inner)] hover:text-[var(--foreground)]"
                >
                  Reset fields
                </motion.button>
              </motion.div>
            </form>

            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  key="err"
                  role="alert"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="mt-5 rounded-xl border border-red-500/25 bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
              {submitMessage && (
                <motion.div
                  key="ok"
                  role="status"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-5 rounded-xl border border-emerald-500/25 bg-[var(--success-soft)] px-4 py-3 text-sm text-[var(--success)]"
                >
                  {submitMessage}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.section>
        </div>

        <AnimatePresence>
          {history.length > 0 && (
            <motion.section
              layout
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={springConfig}
              className="glass-panel relative mt-10 overflow-hidden rounded-3xl p-6 sm:p-8"
            >
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="font-display text-lg font-semibold">
                    Recent submissions
                  </h2>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Stored in this browser only (
                    <code className="rounded bg-[var(--card-inner)] px-1.5 py-0.5 text-xs">
                      localStorage
                    </code>
                    ).
                  </p>
                </div>
              </div>
              <motion.ul
                className="mt-6 divide-y divide-[var(--border)]"
                variants={listVariants}
                initial="hidden"
                animate="show"
              >
                {history.slice(0, 8).map((h) => (
                  <motion.li
                    key={h.submittedAt}
                    variants={itemVariants}
                    className="flex flex-col gap-1 py-4 text-sm first:pt-0 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="font-medium text-[var(--foreground)]">
                      {h.merchantName || "—"}
                      <span className="ml-2 font-normal text-[var(--muted)]">
                        {h.totalAmount} {h.currency}
                      </span>
                    </span>
                    <time
                      className="text-xs tabular-nums text-[var(--muted)]"
                      dateTime={h.submittedAt}
                    >
                      {new Date(h.submittedAt).toLocaleString()}
                    </time>
                  </motion.li>
                ))}
              </motion.ul>
            </motion.section>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  );
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg
      className="h-4 w-4 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function FieldUnderline() {
  return (
    <span
      className="h-px flex-1 bg-gradient-to-r from-[var(--accent)]/40 to-transparent opacity-0 transition-opacity group-focus-within:opacity-100"
      aria-hidden
    />
  );
}
