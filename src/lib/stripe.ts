import Stripe from "stripe";

const globalForStripe = globalThis as unknown as { stripe?: Stripe };

if (!globalForStripe.stripe) {
  globalForStripe.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2026-02-25.clover",
  });
}

export const stripe = globalForStripe.stripe;

export const FUND_PACKAGES = [
  { id: "funds_5", name: "$5 Balance", amountCents: 500, priceInCents: 500 },
  { id: "funds_10", name: "$10 Balance", amountCents: 1000, priceInCents: 1000 },
  { id: "funds_20", name: "$20 Balance", amountCents: 2000, priceInCents: 2000 },
] as const;
