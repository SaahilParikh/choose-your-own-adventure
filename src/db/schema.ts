import { pgTable, text, boolean, timestamp, integer, jsonb } from "drizzle-orm/pg-core";

// ── Types ────────────────────────────────────────────────
export type WorldState = {
  location: string;
  inventory: string[];
  npcs: { name: string; disposition: string; location: string }[];
  questProgress: Record<string, string>;
  flags: Record<string, boolean>;
  progress: number; // 0-100, starts at 10
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
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Token Tracking ───────────────────────────────────────
export const tokenTransactions = pgTable("token_transactions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  reason: text("reason").notNull(),
  gameId: text("game_id").references(() => games.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
