import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { RECEIPT_EXTRACTION_INSTRUCTIONS } from "@/lib/extraction-prompt";
import type { ReceiptFormData } from "@/lib/receipt-types";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Order: newer flash first; 2.0-flash free tier is often exhausted (429) separately
 * from 2.5 / 1.5, so we do not start on 2.0 only.
 */
const MODEL_FALLBACK_CHAIN = [
  "gemini-2.5-flash",
  "gemini-1.5-flash-002",
  "gemini-2.0-flash",
] as const;

const RETRIES_PER_MODEL = 3;

function isModelNotFoundError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  const m = e.message;
  return /\b404\b/.test(m) && /not found|is not found|not supported/i.test(m);
}

function isRateLimitError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  const m = e.message;
  return (
    /\b429\b/.test(m) ||
    /Too Many Requests|quota exceeded|resource_exhausted/i.test(m)
  );
}

function retryDelayMs(e: unknown, attemptIndex: number): number {
  if (!(e instanceof Error)) return 2000 * (attemptIndex + 1);
  const parsed = e.message.match(/retry in ([\d.]+)\s*s/i);
  const base = parsed ? parseFloat(parsed[1]) * 1000 : 2000;
  const jitter = 250 + Math.random() * 400;
  return Math.min(20_000, Math.max(1500, base + jitter + attemptIndex * 800));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseJsonObject(content: string): Record<string, unknown> {
  const trimmed = content.trim();
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/m);
  const jsonStr = fence ? fence[1].trim() : trimmed;
  return JSON.parse(jsonStr) as Record<string, unknown>;
}

function normalizeExtracted(raw: Record<string, unknown>): ReceiptFormData {
  const merchantName =
    typeof raw.merchantName === "string" ? raw.merchantName.trim() : "";
  const date = typeof raw.date === "string" ? raw.date.trim() : "";
  let totalAmount = "";
  if (typeof raw.totalAmount === "number" && Number.isFinite(raw.totalAmount)) {
    totalAmount = String(raw.totalAmount);
  } else if (typeof raw.totalAmount === "string") {
    const n = parseFloat(raw.totalAmount.replace(/,/g, ""));
    totalAmount = Number.isFinite(n) ? String(n) : "";
  }
  const currency =
    typeof raw.currency === "string" ? raw.currency.trim().toUpperCase() : "";

  return { merchantName, date, totalAmount, currency };
}

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Missing GEMINI_API_KEY. Get a free key at https://aistudio.google.com/apikey and add it to .env.local (see README).",
      },
      { status: 500 }
    );
  }

  let body: { imageBase64?: string; mimeType?: string };
  try {
    body = (await req.json()) as { imageBase64?: string; mimeType?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { imageBase64, mimeType } = body;
  if (!imageBase64 || typeof imageBase64 !== "string") {
    return NextResponse.json({ error: "imageBase64 is required" }, { status: 400 });
  }

  const mime =
    mimeType && /^image\/(jpeg|png|gif|webp)$/i.test(mimeType)
      ? mimeType
      : "image/jpeg";

  const envModel = process.env.GEMINI_MODEL?.trim();
  const modelCandidates = envModel
    ? [envModel]
    : [...MODEL_FALLBACK_CHAIN];

  const genAI = new GoogleGenerativeAI(apiKey);

  const parts = [
    RECEIPT_EXTRACTION_INSTRUCTIONS,
    {
      inlineData: {
        mimeType: mime,
        data: imageBase64,
      },
    },
  ] as const;

  let lastError: unknown;

  for (let mi = 0; mi < modelCandidates.length; mi++) {
    const modelName = modelCandidates[mi];
    const hasNextModel = mi < modelCandidates.length - 1;

    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    for (let attempt = 0; attempt < RETRIES_PER_MODEL; attempt++) {
      try {
        const result = await model.generateContent([...parts]);

        const text = result.response.text();
        if (!text) {
          return NextResponse.json(
            { error: "No content from model" },
            { status: 502 }
          );
        }

        const parsed = parseJsonObject(text);
        const data = normalizeExtracted(parsed);

        return NextResponse.json({
          data,
          model: modelName,
        });
      } catch (e) {
        lastError = e;

        if (isModelNotFoundError(e) && hasNextModel) {
          console.warn(`[extract] model ${modelName} not found, trying next`);
          break;
        }

        if (isRateLimitError(e)) {
          if (attempt < RETRIES_PER_MODEL - 1) {
            const wait = retryDelayMs(e, attempt);
            console.warn(
              `[extract] rate limited on ${modelName}, retry in ${Math.round(wait)}ms (attempt ${attempt + 1})`
            );
            await sleep(wait);
            continue;
          }
          if (hasNextModel) {
            console.warn(
              `[extract] rate limited on ${modelName}, trying next model`
            );
            break;
          }
        }

        const message = e instanceof Error ? e.message : "Extraction failed";
        console.error("[extract]", e);
        return NextResponse.json({ error: message }, { status: 502 });
      }
    }
  }

  const message =
    lastError instanceof Error ? lastError.message : "Extraction failed";
  return NextResponse.json({ error: message }, { status: 502 });
}
