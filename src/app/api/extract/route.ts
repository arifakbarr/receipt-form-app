import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { RECEIPT_EXTRACTION_INSTRUCTIONS } from "@/lib/extraction-prompt";
import type { ReceiptFormData } from "@/lib/receipt-types";

export const runtime = "nodejs";
export const maxDuration = 60;

const DEFAULT_MODEL = "gemini-1.5-flash";

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

  const modelName = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;

  const genAI = new GoogleGenerativeAI(apiKey);
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
    const message = e instanceof Error ? e.message : "Extraction failed";
    console.error("[extract]", e);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
