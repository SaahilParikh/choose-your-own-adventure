# Security Policy

## Reporting a vulnerability

**Please do not open a public GitHub issue for security problems.**

If you believe you've found a security vulnerability in this project, report it privately:

- Use GitHub's [private vulnerability reporting](https://github.com/SaahilParikh/choose-your-own-adventure/security/advisories/new) form, or
- Contact the maintainer through the email listed on their GitHub profile.

Please include:

- A description of the issue and its impact.
- Steps to reproduce, or a proof-of-concept.
- The affected version or commit SHA.
- Any mitigations or workarounds you've identified.

## What to expect

- **Acknowledgement** within 72 hours.
- **Initial assessment** within 7 days, including severity and a proposed fix timeline.
- **Fix + disclosure**: for confirmed issues, we'll coordinate a release and a public advisory. Credit is given to reporters unless anonymity is requested.

## Scope

In scope:

- The code in this repository (Next.js app, AI pipeline, API routes, database layer).
- The `.env.example`, CI workflows, and other repository configuration.

Out of scope:

- Third-party services (AWS Bedrock, Polly, Stripe, better-auth) — report directly to the vendor.
- Self-hosted deployments misconfigured by the operator (e.g., running with debug mode on in production, leaking `.env` files).
- Social engineering or physical attacks against contributors.

## Hardening recommendations for operators

If you deploy this project publicly:

- Rotate `BETTER_AUTH_SECRET` regularly and use a random string of at least 32 characters.
- Run behind a reverse proxy (nginx, Caddy) that terminates TLS and adds standard security headers.
- Restrict database network access to the app instance.
- Keep AWS IAM credentials scoped to only the Bedrock/Polly actions you need.
- Monitor Stripe webhook deliveries and treat signature verification failures as alerts.
