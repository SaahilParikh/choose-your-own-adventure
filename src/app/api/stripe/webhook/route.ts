import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { stripe } from "@/lib/stripe";
import { addFunds, DuplicateStripeSessionError } from "@/lib/tokens";

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) return new Response("Missing signature", { status: 400 });

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("[api/stripe/webhook] signature verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId = session.metadata?.userId;
    const amountCentsFromMetadata = parseInt(session.metadata?.amountCents ?? "0", 10);
    const amountTotal = session.amount_total ?? 0;

    // Defense in depth: the amount we credit must match what Stripe actually
    // charged. Metadata is server-controlled at checkout creation, but this
    // guards against any future bug that lets client-controlled data through.
    if (amountCentsFromMetadata !== amountTotal) {
      console.error(
        `[api/stripe/webhook] amount mismatch: metadata=${amountCentsFromMetadata} total=${amountTotal} session=${session.id}`,
      );
      return new Response("Amount mismatch", { status: 400 });
    }

    if (!userId || amountTotal <= 0) {
      return NextResponse.json({ received: true, ignored: true });
    }

    const reason = `stripe:${session.id}`;
    try {
      await addFunds(userId, amountTotal, reason, session.id);
    } catch (err) {
      if (err instanceof DuplicateStripeSessionError) {
        return NextResponse.json({ alreadyProcessed: true });
      }
      throw err;
    }
  }

  return NextResponse.json({ received: true });
}
