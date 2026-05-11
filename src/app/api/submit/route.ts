import { NextResponse } from "next/server";
import type { ReceiptFormData } from "@/lib/receipt-types";

/** In-memory demo store (resets on cold start in serverless). */
const submissions: Array<ReceiptFormData & { submittedAt: string }> = [];

export const runtime = "nodejs";

function isReceiptFormData(value: unknown): value is ReceiptFormData {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  return (
    typeof o.merchantName === "string" &&
    typeof o.date === "string" &&
    typeof o.totalAmount === "string" &&
    typeof o.currency === "string"
  );
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isReceiptFormData(body)) {
    return NextResponse.json(
      { error: "Expected merchantName, date, totalAmount, currency as strings" },
      { status: 400 }
    );
  }

  const row = {
    ...body,
    submittedAt: new Date().toISOString(),
  };
  submissions.unshift(row);
  if (submissions.length > 100) submissions.pop();

  return NextResponse.json({
    ok: true,
    id: row.submittedAt,
    serverSubmissionCount: submissions.length,
  });
}

export async function GET() {
  return NextResponse.json({
    count: submissions.length,
    recent: submissions.slice(0, 10),
  });
}
