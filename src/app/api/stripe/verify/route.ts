import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-helpers";
import { stripe } from "@/lib/stripe";
import { addFunds, DuplicateStripeSessionError } from "@/lib/tokens";
import { formatBalance } from "@/lib/pricing";

export async function POST(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { sessionId } = await request.json();
  if (!sessionId || typeof sessionId !== "string") {
    return new Response("Missing session ID", { status: 400 });
  }

  // Retrieve the checkout session from Stripe to verify payment.
  const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);

  if (checkoutSession.payment_status !== "paid") {
    return new Response("Payment not completed", { status: 400 });
  }

  const userId = checkoutSession.metadata?.userId;
  const amountCentsFromMetadata = parseInt(checkoutSession.metadata?.amountCents ?? "0", 10);
  const amountTotal = checkoutSession.amount_total ?? 0;

  if (userId !== user.id) {
    console.warn(`[api/stripe/verify] user mismatch: session=${sessionId} expected=${user.id} got=${userId}`);
    return new Response("User mismatch", { status: 403 });
  }

  // Cross-check metadata against Stripe's ground truth amount (defense in depth).
  if (amountCentsFromMetadata !== amountTotal) {
    console.error(
      `[api/stripe/verify] amount mismatch: metadata=${amountCentsFromMetadata} total=${amountTotal} session=${sessionId}`,
    );
    return new Response("Amount mismatch", { status: 400 });
  }

  if (amountTotal <= 0) {
    return NextResponse.json({ granted: 0, grantedFormatted: formatBalance(0) });
  }

  // Attempt to credit the user. The unique constraint on stripe_session_id means
  // the webhook may have already credited this session — in that common, benign
  // case we still return the granted amount so the client can show a unified
  // "funds added" confirmation rather than a scary "already processed" warning.
  let alreadyProcessed = false;
  try {
    await addFunds(userId, amountTotal, `stripe:${sessionId}`, sessionId);
  } catch (err) {
    if (err instanceof DuplicateStripeSessionError) {
      alreadyProcessed = true;
    } else {
      throw err;
    }
  }

  return NextResponse.json({
    granted: amountTotal,
    grantedFormatted: formatBalance(amountTotal),
    alreadyProcessed,
  });
}
