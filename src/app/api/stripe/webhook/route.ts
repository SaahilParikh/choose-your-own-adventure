import { stripe } from "@/lib/stripe";
import { addFunds } from "@/lib/tokens";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  console.log("[Stripe Webhook] Received event, signature present:", !!signature);

  if (!signature) return new Response("Missing signature", { status: 400 });

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    console.error("[Stripe Webhook] Signature verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  console.log("[Stripe Webhook] Event type:", event.type);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId = session.metadata?.userId;
    const amountCents = parseInt(session.metadata?.amountCents ?? "0", 10);

    console.log("[Stripe Webhook] Payment completed. userId:", userId, "amountCents:", amountCents);

    if (userId && amountCents > 0) {
      await addFunds(userId, amountCents, "stripe_purchase");
      console.log("[Stripe Webhook] Funds added successfully");
    }
  }

  return NextResponse.json({ received: true });
}
