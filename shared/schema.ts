import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Wishlist Items
export const items = pgTable("items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  url: text("url").notNull(),
  shortUrl: text("short_url"),
  images: jsonb("images").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  price: integer("price").notNull(), // stored in cents
  currency: text("currency").notNull().default('USD'),
  size: text("size"),
  availableSizes: jsonb("available_sizes").$type<string[]>().default(sql`'[]'::jsonb`),
  availableColors: jsonb("available_colors").$type<string[]>().default(sql`'[]'::jsonb`),
  inStock: boolean("in_stock").notNull().default(true),
  lists: jsonb("lists").$type<string[]>().notNull().default(sql`'[]'::jsonb`), // array of list IDs
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Price History
export const priceHistory = pgTable("price_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  itemId: varchar("item_id").notNull().references(() => items.id, { onDelete: 'cascade' }),
  price: integer("price").notNull(),
  currency: text("currency").notNull(),
  inStock: boolean("in_stock").notNull(),
  checkedAt: timestamp("checked_at").notNull().defaultNow(),
});

// Custom Lists
export const lists = pgTable("lists", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  icon: text("icon"), // lucide icon name
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Goals
export const goals = pgTable("goals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  targetAmount: integer("target_amount").notNull(), // in cents
  currentAmount: integer("current_amount").notNull().default(0),
  currency: text("currency").notNull().default('USD'),
  deadline: timestamp("deadline"),
  itemIds: jsonb("item_ids").$type<string[]>().default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Insert Schemas
export const insertItemSchema = createInsertSchema(items).omit({
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

// Types
export type Item = typeof items.$inferSelect;
export type InsertItem = z.infer<typeof insertItemSchema>;
export type PriceHistory = typeof priceHistory.$inferSelect;
export type InsertPriceHistory = z.infer<typeof insertPriceHistorySchema>;
export type List = typeof lists.$inferSelect;
export type InsertList = z.infer<typeof insertListSchema>;
export type Goal = typeof goals.$inferSelect;
export type InsertGoal = z.infer<typeof insertGoalSchema>;

// Activity type for frontend
export type Activity = {
  id: string;
  itemId: string;
  itemName: string;
  itemImage: string;
  oldPrice: number;
  newPrice: number;
  currency: string;
  changeType: 'increase' | 'decrease';
  timestamp: Date;
};
