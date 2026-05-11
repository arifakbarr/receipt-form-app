# Receipt-to-form auto-fill

A small Next.js app that uploads a receipt image, calls **Google Gemini** (vision + JSON) on the server to extract structured fields, shows an editable form, and saves submissions to **localStorage** (plus an optional in-memory record on the server).

Extraction uses the **Google AI Studio free tier** ([Gemini API](https://ai.google.dev/pricing)): add `GEMINI_API_KEY` locally and in Vercel—no paid OpenAI/Anthropic account required for typical assignment usage.

## Assignment checklist

| Requirement | How this repo satisfies it |
|-------------|----------------------------|
| Upload a receipt image | Drag-and-drop or file picker (`ReceiptApp.tsx`). |
| Generative AI API (Claude / GPT-4o / Gemini) | **Gemini** (`gemini-1.5-flash` default; set `GEMINI_MODEL=gemini-2.0-flash` if you prefer). |
| Form pre-filled, user can review & edit | All four fields are populated from `/api/extract` and remain editable. |
| Submit (DB optional) | `POST /api/submit` (in-memory) + **localStorage** history in the browser. |
| Vercel deploy (optional) | Add `GEMINI_API_KEY` in Vercel → Environment Variables, then redeploy. |
| Fields: merchant, date, total, currency | `ReceiptFormData` + extraction prompt JSON schema. |

**Your deliverables (not in repo):** 1–2 min demo video, public GitHub URL after you push, live Vercel URL after you deploy.

## Features

- Drag-and-drop or file picker for receipt images (JPEG, PNG, GIF, WebP).
- Server-side extraction via `/api/extract` so the API key never ships to the browser.
- Fields: **merchant name**, **date**, **total amount**, **currency**.
- Review and edit before submit; recent submissions listed from local storage.

## Prerequisites

- Node.js 18+
- A **free** [Gemini API key](https://aistudio.google.com/apikey) from Google AI Studio (same key works for the free-tier quotas described on [Google AI pricing](https://ai.google.dev/pricing)).

## Setup

```bash
cp .env.example .env.local
# Edit .env.local: set GEMINI_API_KEY (from AI Studio)
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Model and prompt

- **Default model:** `gemini-1.5-flash` (override with `GEMINI_MODEL` in `.env.local`, e.g. `gemini-2.0-flash` when available on your key).
- **Prompt:** `src/lib/extraction-prompt.ts` — asks for a single JSON object with `merchantName`, `date`, `totalAmount`, and `currency`.

API logic: `src/app/api/extract/route.ts` (`@google/generative-ai`).

### Using OpenAI or Claude instead

1. Add the provider SDK and branch in `extract/route.ts` (e.g. `AI_PROVIDER=openai|gemini`).
2. Reuse the same prompt text and `ReceiptFormData` normalization.

## Deploy on Vercel

1. Push the project to GitHub.
2. Import the repo in [Vercel](https://vercel.com).
3. **Settings → Environment Variables:** add **`GEMINI_API_KEY`** (and optionally **`GEMINI_MODEL`**), then **Redeploy**.

## Demo video (1–2 minutes)

Record a short screen capture showing:

1. Open the app (local or deployed URL).
2. Upload a sample receipt image.
3. Click **Extract with AI** and show the form filling in.
4. Edit a field, click **Submit**, and show the success message and **Recent submissions** list.

Tools: OBS, Windows Snipping Tool + Clipchamp, Loom, etc.

## Troubleshooting: “missing required error components, refreshing…”

Usually **not** a missing `error.tsx` file. Typical causes:

1. **Two dev servers** on the same project — stop every `node`/`next` for this app, delete `.next`, run **one** `npm run dev`.
2. **Deleting `.next` while dev is running** — stop the server, remove `.next`, start dev again.

This repo includes `src/app/error.tsx` and `src/app/global-error.tsx`.

## Scripts

| Command        | Description           |
| -------------- | --------------------- |
| `npm run dev`  | Development server    |
| `npm run build`| Production build      |
| `npm start`    | Run production build  |
| `npm run lint` | ESLint                |

## License

MIT
