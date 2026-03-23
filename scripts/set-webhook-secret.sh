#!/bin/bash
read -p "Paste your Stripe webhook secret (whsec_...): " secret
sed -i '' "s/^STRIPE_WEBHOOK_SECRET=.*/STRIPE_WEBHOOK_SECRET=$secret/" .env.local
echo "Updated. Restart your dev server."
