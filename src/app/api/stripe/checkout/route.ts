import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getUserFromRequest } from "@/lib/auth-helpers";
import { stripe, FUND_PACKAGES } from "@/lib/stripe";

export async function POST(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { packageId } = await request.json();
  const pkg = FUND_PACKAGES.find((p) => p.id === packageId);
  if (!pkg) return new Response("Invalid package", { status: 400 });

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: { name: pkg.name },
          unit_amount: pkg.priceInCents,
        },
        quantity: 1,
      },
    ],
    metadata: {
      userId: user.id,
      packageId: pkg.id,
      amountCents: pkg.amountCents.toString(),
    },
    success_url: `${env.BETTER_AUTH_URL}/game?payment=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.BETTER_AUTH_URL}/game?payment=cancelled`,
  });

  return NextResponse.json({ url: checkoutSession.url });
}
