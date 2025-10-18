import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  timestamp,
  boolean,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core"; // Import pgEnum
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Define an enum for the scraping status
export const itemStatusEnum = pgEnum("item_status", [
  "pending",
  "processed",
  "failed",
  "link_dead",
]);

// Wishlist Items
export const items = pgTable("items", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name"), // Allow null initially for pending items
  url: text("url").notNull(),
  shortUrl: text("short_url"),
  images: jsonb("images")
    .$type<string[]>()
    .default(sql`'[]'::jsonb`), // Removed notNull(), allow empty on pending
  price: integer("price"), // Allow null initially for pending items (stored in cents)
  currency: text("currency").default("USD"), // Allow null initially
  size: text("size"), // User selected size
  availableSizes: jsonb("available_sizes")
    .$type<string[]>()
    .default(sql`'[]'::jsonb`),
  availableColors: jsonb("available_colors")
    .$type<string[]>()
    .default(sql`'[]'::jsonb`),
  inStock: boolean("in_stock").default(true), // Removed notNull(), default might be better as false or null if unknown initially
  lists: jsonb("lists")
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`), // array of list IDs
  description: text("description"), // <<< ADDED: Scraped description (nullable)

  // --- Worker Tracking Fields ---
  status: itemStatusEnum("status").default("pending"), // <<< ADDED: Use the enum, default to pending
  lastCheckedAt: timestamp("last_checked_at"), // <<< ADDED: Timestamp of the last check (nullable)
  lastCheckError: text("last_check_error"), // <<< ADDED: Error message from last failed check (nullable)
  // --- End Worker Tracking Fields ---

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Price History
export const priceHistory = pgTable("price_history", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  itemId: varchar("item_id")
    .notNull()
    .references(() => items.id, { onDelete: "cascade" }),
  price: integer("price").notNull(), // in cents
  currency: text("currency").notNull(),
  inStock: boolean("in_stock").notNull(),
  checkedAt: timestamp("checked_at").notNull().defaultNow(),
});

// Custom Lists
export const lists = pgTable("lists", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  icon: text("icon"), // lucide icon name
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Goals
export const goals = pgTable("goals", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  targetAmount: integer("target_amount").notNull(), // in cents
  currentAmount: integer("current_amount").notNull().default(0),
  currency: text("currency").notNull().default("USD"),
  deadline: timestamp("deadline"),
  itemIds: jsonb("item_ids")
    .$type<string[]>()
    .default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Insert Schemas
// Make fields optional that the worker will fill in later
export const insertItemSchema = createInsertSchema(items, {
  name: z.string().optional(),
  images: z.array(z.string()).optional().default([]),
  price: z.number().int().optional(),
  currency: z.string().optional(),
  availableSizes: z.array(z.string()).optional().default([]),
  availableColors: z.array(z.string()).optional().default([]),
  inStock: z.boolean().optional(),
  description: z.string().optional(),
  status: z.enum(itemStatusEnum.enumValues).optional().default("pending"), // Use enum values
  lastCheckedAt: z.date().optional(),
  lastCheckError: z.string().optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPriceHistorySchema = createInsertSchema(priceHistory).omit({
  id: true,
  checkedAt: true,
});

export const insertListSchema = createInsertSchema(lists).omit({
  id: true,
  createdAt: true,
});

export const insertGoalSchema = createInsertSchema(goals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types (These update automatically based on the table definitions)
export type Item = typeof items.$inferSelect;
export type InsertItem = z.infer<typeof insertItemSchema>;
export type PriceHistory = typeof priceHistory.$inferSelect;
export type InsertPriceHistory = z.infer<typeof insertPriceHistorySchema>;
export type List = typeof lists.$inferSelect;
export type InsertList = z.infer<typeof insertListSchema>;
export type Goal = typeof goals.$inferSelect;
export type InsertGoal = z.infer<typeof insertGoalSchema>;

// Activity type for frontend (remains the same)
export type Activity = {
  id: string;
  itemId: string;
  itemName: string;
  itemImage: string;
  oldPrice: number;
  newPrice: number;
  currency: string;
  changeType: "increase" | "decrease";
  timestamp: Date;
};
