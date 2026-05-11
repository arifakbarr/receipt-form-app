# Receipt-to-form auto-fill

A small Next.js app that uploads a receipt image, calls **OpenAI GPT-4o-mini** (vision + JSON) to extract structured fields, shows an editable form, and saves submissions to **localStorage** (plus an optional in-memory record on the server).

## Assignment checklist

| Requirement | How this repo satisfies it |
|-------------|----------------------------|
| Upload a receipt image | Drag-and-drop or file picker (`ReceiptApp.tsx`). |
| Generative AI API (Claude / GPT-4o / Gemini) | **OpenAI** (`gpt-4o-mini` default, `gpt-4o` optional). README notes how to swap to Claude/Gemini. |
| Form pre-filled, user can review & edit | All four fields are populated from `/api/extract` and remain editable. |
| Submit (DB optional) | `POST /api/submit` (in-memory) + **localStorage** history in the browser. |
| Vercel deploy (optional) | Steps below; needs your GitHub + Vercel account. |
| Fields: merchant, date, total, currency | `ReceiptFormData` + extraction prompt JSON schema. |

**Your deliverables (not in repo):** 1–2 min demo video, public GitHub URL after you push, live Vercel URL after you deploy.

## Features

- Drag-and-drop or file picker for receipt images (JPEG, PNG, GIF, WebP).
- Server-side extraction via `/api/extract` so your API key stays off the client.
- Fields: **merchant name**, **date**, **total amount**, **currency**.
- Review and edit before submit; recent submissions listed from local storage.

## Prerequisites

- Node.js 18+
- An [OpenAI API key](https://platform.openai.com/api-keys) with access to vision-capable models (`gpt-4o-mini` or `gpt-4o`).

## Setup

```bash
# Windows (PowerShell): Copy-Item .env.example .env.local
cp .env.example .env.local
# Edit .env.local and set OPENAI_API_KEY
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Model and prompt

- **Default model:** `gpt-4o-mini` (override with `OPENAI_VISION_MODEL` in `.env.local`).
- **Prompt:** Defined in `src/lib/extraction-prompt.ts` as `RECEIPT_EXTRACTION_INSTRUCTIONS`. It asks for a single JSON object with `merchantName`, `date`, `totalAmount`, and `currency`, with ISO date and ISO 4217 currency when possible.

API logic lives in `src/app/api/extract/route.ts`.

### Using other providers (Claude / Gemini)

This repo is wired for OpenAI out of the box. To use Anthropic or Google:

1. Add the respective SDK and API route (or branch inside `extract` on an env var like `AI_PROVIDER`).
2. Send the receipt image as base64 and reuse the same JSON schema and prompt text from `extraction-prompt.ts`.

## Deploy on Vercel

Production URL (after you set env vars): **https://receipt-form-app.vercel.app**

1. Push the project to GitHub.
2. Import the repo in [Vercel](https://vercel.com) (this repo is already linked if you deployed via CLI).
3. In the Vercel project → **Settings → Environment Variables**, add **`OPENAI_API_KEY`** (and optionally **`OPENAI_VISION_MODEL`**), then **Redeploy** so extraction works in production.
4. Deploy.

## Demo video (1–2 minutes)

Record a short screen capture showing:

1. Open the app (local or deployed URL).
2. Upload a sample receipt image.
3. Click **Extract with AI** and show the form filling in.
4. Edit a field, click **Submit**, and show the success message and **Recent submissions** list.

Tools: OBS, Windows Snipping Tool + Clipchamp, Loom, etc.

## Troubleshooting: “missing required error components, refreshing…”

Usually **not** a missing `error.tsx` file. Typical causes:

1. **Two dev servers** on the same project (e.g. port 3000 and 3001 both running `next dev`) — stop every `node`/`next` for this app, delete `.next`, run **one** `npm run dev`.
2. **Deleting `.next` while dev is running** or **running `npm run build` while `npm run dev` is still running** — stop the server, remove the `.next` folder, start dev again.

This repo includes `src/app/error.tsx` and `src/app/global-error.tsx` so runtime errors show a proper recovery UI instead of a broken overlay.

## Scripts

| Command        | Description           |
| -------------- | --------------------- |
| `npm run dev`  | Development server    |
| `npm run build`| Production build      |
| `npm start`    | Run production build  |
| `npm run lint` | ESLint                |

## License

MIT
