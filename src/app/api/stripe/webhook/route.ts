import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { env } from "@/lib/env";
import { stripe } from "@/lib/stripe";
import { addFunds } from "@/lib/tokens";
import { db } from "@/db";
import { tokenTransactions } from "@/db/schema";

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
    const amountCents = parseInt(session.metadata?.amountCents ?? "0", 10);
    const reason = `stripe:${session.id}`;

    // Idempotency check — skip if already processed.
    const [existing] = await db
      .select()
      .from(tokenTransactions)
      .where(eq(tokenTransactions.reason, reason));
    if (existing) {
      return NextResponse.json({ alreadyProcessed: true });
    }

    if (userId && amountCents > 0) {
      await addFunds(userId, amountCents, reason);
    }
  }

  return NextResponse.json({ received: true });
}
