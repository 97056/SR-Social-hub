import { createHmac } from "crypto";

export type RazorpayOrder = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  receipt?: string;
};

export async function createRazorpayOrder(input: {
  keyId: string;
  keySecret: string;
  amountInr: number;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<RazorpayOrder> {
  const amountPaise = Math.round(input.amountInr * 100);
  if (amountPaise < 100) {
    throw new Error("Razorpay minimum amount is ₹1");
  }
  const auth = Buffer.from(`${input.keyId}:${input.keySecret}`).toString("base64");
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: amountPaise,
      currency: "INR",
      receipt: input.receipt.slice(0, 40),
      notes: input.notes ?? {},
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Razorpay order failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return JSON.parse(text) as RazorpayOrder;
}

export function verifyRazorpaySignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
  keySecret: string;
}): boolean {
  const payload = `${input.orderId}|${input.paymentId}`;
  const expected = createHmac("sha256", input.keySecret).update(payload).digest("hex");
  return expected === input.signature;
}
