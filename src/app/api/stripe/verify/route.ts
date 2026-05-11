import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getUserFromRequest } from "@/lib/auth-helpers";
import { stripe } from "@/lib/stripe";
import { addFunds } from "@/lib/tokens";
import { db } from "@/db";
import { tokenTransactions } from "@/db/schema";
import { formatBalance } from "@/lib/pricing";

export async function POST(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { sessionId } = await request.json();
  if (!sessionId) return new Response("Missing session ID", { status: 400 });

  // Retrieve the checkout session from Stripe to verify payment.
  const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);

  if (checkoutSession.payment_status !== "paid") {
    return new Response("Payment not completed", { status: 400 });
  }

  // Check we haven't already processed this session (idempotency).
  const [existing] = await db
    .select()
    .from(tokenTransactions)
    .where(and(eq(tokenTransactions.reason, `stripe:${sessionId}`)));

  if (existing) {
    return NextResponse.json({ alreadyProcessed: true });
  }

  const userId = checkoutSession.metadata?.userId;
  const amountCents = parseInt(checkoutSession.metadata?.amountCents ?? "0", 10);

  if (userId !== user.id) {
    return new Response("User mismatch", { status: 403 });
  }

  if (amountCents > 0) {
    await addFunds(userId, amountCents, `stripe:${sessionId}`);
  }

  return NextResponse.json({ granted: amountCents, grantedFormatted: formatBalance(amountCents) });
}
