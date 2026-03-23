import { readFileSync } from "fs";
import { resolve } from "path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { eq, sql } from "drizzle-orm";

// Load .env.local
const envPath = resolve(__dirname, "../.env.local");
const envContent = readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const match = line.match(/^\s*([\w]+)\s*=\s*(.+)\s*$/);
  if (match) process.env[match[1]] = match[2];
}

// Inline schema (no @/ aliases in standalone scripts)
const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  tokenBalance: integer("token_balance").notNull().default(100),
});

const tokenTransactions = pgTable("token_transactions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull(),
  amount: integer("amount").notNull(),
  reason: text("reason").notNull(),
  gameId: text("game_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

async function main() {
  const [email, amountStr] = process.argv.slice(2);
  if (!email || !amountStr) {
    console.error("Usage: npx tsx scripts/grant-tokens.ts <email> <amount_in_cents>");
    process.exit(1);
  }

  const amount = parseInt(amountStr, 10);
  if (isNaN(amount) || amount <= 0) {
    console.error("Amount must be a positive integer (in cents)");
    process.exit(1);
  }

  const client = postgres(process.env.DATABASE_URL!);
  const db = drizzle(client);

  try {
    const [found] = await db
      .select({ id: user.id, email: user.email, tokenBalance: user.tokenBalance })
      .from(user)
      .where(eq(user.email, email));

    if (!found) {
      console.error(`No user found with email: ${email}`);
      process.exit(1);
    }

    await db.transaction(async (tx) => {
      await tx
        .update(user)
        .set({ tokenBalance: sql`${user.tokenBalance} + ${amount}` })
        .where(eq(user.id, found.id));
      await tx.insert(tokenTransactions).values({
        userId: found.id,
        amount,
        reason: "admin_grant",
      });
    });

    console.log(`Granted ${amount} cents ($${(amount / 100).toFixed(2)}) to ${email} (was ${found.tokenBalance} cents, now ${found.tokenBalance + amount} cents)`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
