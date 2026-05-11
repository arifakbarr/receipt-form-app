/**
 * System instructions sent with the receipt image. Documented in README for reproducibility.
 */
export const RECEIPT_EXTRACTION_INSTRUCTIONS = `You are an expert at reading retail and restaurant receipts.

Analyze the receipt image and extract these fields:
- merchantName: The store or business name as printed (not the payment processor unless no merchant name appears).
- date: The transaction date in ISO format YYYY-MM-DD when readable; otherwise best-effort text from the receipt.
- totalAmount: The final total paid by the customer as a number only (no currency symbol). Use dot as decimal separator.
- currency: ISO 4217 code (e.g. USD, EUR, GBP). Infer from symbols or text when possible.

Respond with a single JSON object only, no markdown, no explanation:
{"merchantName":"string","date":"string","totalAmount":number,"currency":"string"}

If a field cannot be determined, use empty string for text fields, 0 for totalAmount, and best guess or "USD" for currency only when the receipt clearly implies US dollars.`;
