import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { RECEIPT_EXTRACTION_INSTRUCTIONS } from "@/lib/extraction-prompt";
import type { ReceiptFormData } from "@/lib/receipt-types";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Unversioned `gemini-1.5-flash` often 404s on v1beta; try current IDs in order. */
const MODEL_FALLBACK_CHAIN = [
  "gemini-2.0-flash",
  "gemini-2.5-flash",
  "gemini-1.5-flash-002",
] as const;

function isModelNotFoundError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  const m = e.message;
  return /\b404\b/.test(m) && /not found|is not found|not supported/i.test(m);
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

  let lastError: unknown;
  for (const modelName of modelCandidates) {
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    try {
      const result = await model.generateContent([
        RECEIPT_EXTRACTION_INSTRUCTIONS,
        {
          inlineData: {
            mimeType: mime,
            data: imageBase64,
          },
        },
      ]);

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
      if (
        modelCandidates.length > 1 &&
        isModelNotFoundError(e) &&
        modelName !== modelCandidates[modelCandidates.length - 1]
      ) {
        console.warn(`[extract] model ${modelName} unavailable, trying next`);
        continue;
      }
      const message = e instanceof Error ? e.message : "Extraction failed";
      console.error("[extract]", e);
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  const message =
    lastError instanceof Error ? lastError.message : "Extraction failed";
  return NextResponse.json({ error: message }, { status: 502 });
}
