import { pgTable, text, boolean, timestamp, integer, jsonb } from "drizzle-orm/pg-core";

// ── Types ────────────────────────────────────────────────
export type CharacterSheet = {
  inventory: { name: string; description: string }[];
  knowledge: { topic: string; level: string }[];
  beliefs: string[];
  traits: string[];
};

export type WorldState = {
  location: string;
  inventory: string[];
  npcs: { name: string; disposition: string; location: string }[];
  questProgress: Record<string, string>;
  flags: Record<string, boolean>;
  progress: number; // 0-100, starts at 10
  agents?: import("@/lib/ai/types").WorldAgent[];
  characterSheet?: CharacterSheet;
  forces?: import("@/lib/ai/types").MetaForce[];
  fateHistory?: number[];
};

// ── Better Auth Required Tables ──────────────────────────
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  tokenBalance: integer("token_balance").notNull().default(0), // stores balance in cents (not tokens)
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── Game Tables ──────────────────────────────────────────
export const games = pgTable("games", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  setting: text("setting").notNull(),
  objective: text("objective").notNull(),
  worldState: jsonb("world_state").notNull().$type<WorldState>(),
  status: text("status", { enum: ["active", "won", "lost", "abandoned"] }).notNull().default("active"),
  turnCount: integer("turn_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const gameTurns = pgTable("game_turns", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  gameId: text("game_id").notNull().references(() => games.id, { onDelete: "cascade" }),
  turnNumber: integer("turn_number").notNull(),
  playerAction: text("player_action"),
  narrativeText: text("narrative_text").notNull(),
  imageUrl: text("image_url"),
  worldState: jsonb("world_state").notNull().$type<WorldState>(),
  tokensUsed: integer("tokens_used").notNull().default(0),
  diceResults: jsonb("dice_results").$type<import("@/lib/ai/types").ActionCheck[]>(),
  forceActions: jsonb("force_actions").$type<import("@/lib/ai/types").ForceAction[]>(),
  agentActions: jsonb("agent_actions").$type<import("@/lib/ai/types").WorldAgentAction[]>(),
  fateRoll: jsonb("fate_roll").$type<import("@/lib/ai/types").FateRoll>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Token Tracking ───────────────────────────────────────
// `stripeSessionId` is UNIQUE so that concurrent webhook + verify calls cannot
// both credit the same Stripe session — the second INSERT fails the unique
// constraint and is caught as "already processed" in the caller.
export const tokenTransactions = pgTable("token_transactions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  reason: text("reason").notNull(),
  stripeSessionId: text("stripe_session_id").unique(),
  gameId: text("game_id").references(() => games.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
