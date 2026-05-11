import OpenAI from "openai";
import { NextResponse } from "next/server";
import { RECEIPT_EXTRACTION_INSTRUCTIONS } from "@/lib/extraction-prompt";
import type { ReceiptFormData } from "@/lib/receipt-types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = process.env.OPENAI_VISION_MODEL ?? "gpt-4o-mini";

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
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Missing OPENAI_API_KEY. Add it to .env.local (see README).",
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

  const openai = new OpenAI({ apiKey });

  try {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: RECEIPT_EXTRACTION_INSTRUCTIONS },
            {
              type: "image_url",
              image_url: {
                url: `data:${mime};base64,${imageBase64}`,
                detail: "high",
              },
            },
          ],
        },
      ],
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: "No content from model" },
        { status: 502 }
      );
    }

    const parsed = parseJsonObject(content);
    const data = normalizeExtracted(parsed);

    return NextResponse.json({
      data,
      model: MODEL,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Extraction failed";
    console.error("[extract]", e);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
