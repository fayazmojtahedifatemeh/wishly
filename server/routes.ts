// In file: server/src/routes.ts (REPLACE THE WHOLE FILE - Added Debug Logs)

import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { categorizeProduct, findProductsFromImage } from "./gemini";
import { scrapeProductFromUrl } from "./scraper";
import { z } from "zod";
import cron from "node-cron";
import multer from "multer";
import { parse } from "csv-parse/sync";

// Schemas remain the same
const previewItemSchema = z.object({ url: z.string().url() });
const createItemSchema = z.object({
  url: z.string().url(),
  selectedSize: z.string().optional(),
  selectedLists: z.array(z.string()).min(1),
});
const updateItemSchema = z.object({
  size: z.string().optional(),
  lists: z.array(z.string()).optional(),
});
const createListSchema = z.object({ name: z.string().min(1) });
const createGoalSchema = z.object({
  title: z.string().min(1),
  targetAmount: z.number().int().positive(),
  deadline: z.string().optional(),
});

const upload = multer({ storage: multer.memoryStorage() });

export async function registerRoutes(app: Express): Promise<Server> {
  // --- HELPER FUNCTION for Price Checking (Defined INSIDE registerRoutes) ---
  async function checkAllPrices() {
    console.log("Running checkAllPrices...");
    let successCount = 0;
    let failCount = 0;
    try {
      const items = await storage.getItems();
      console.log(`[checkAllPrices] Checking ${items.length} total items...`); // Added log
      for (const item of items) {
        // @ts-ignore
        if (item.status === "link_dead") continue;
        try {
          const product = await scrapeProductFromUrl(item.url);
          await storage.updateItem(item.id, {
            price: product.price,
            inStock: product.inStock,
            images: product.images,
            availableSizes: product.availableSizes,
            availableColors: product.availableColors,
          });
          successCount++;
        } catch (error: any) {
          failCount++;
          console.error(
            `[checkAllPrices] Error for ${item.name}:`,
            error.message,
          ); // Added log
          if (error.message.includes("Product not found (404)")) {
            // @ts-ignore
            await storage.updateItem(item.id, {
              inStock: false /*, status: 'link_dead'*/,
            });
          } else {
            console.warn(
              `[checkAllPrices] Keeping previous stock for ${item.name} due to error.`,
            ); // Added log
          }
        }
      }
      console.log(
        `[checkAllPrices] Completed: ${successCount} success, ${failCount} fails.`,
      ); // Added log
      return { successCount, failCount };
    } catch (error) {
      console.error("[checkAllPrices] Error fetching items:", error); // Added log
      return { successCount, failCount, error: true };
    }
  }
  // --- END OF HELPER FUNCTION ---

  // Items Routes (Remain the same)
  app.get("/api/items", async (req, res) => {
    /* ... */
  });
  app.get("/api/items/:id", async (req, res) => {
    /* ... */
  });
  app.post("/api/items/preview", async (req, res) => {
    /* ... */
  });
  app.post("/api/items", async (req, res) => {
    /* ... */
  });
  app.patch("/api/items/:id", async (req, res) => {
    /* ... */
  });
  app.delete("/api/items/:id", async (req, res) => {
    /* ... */
  });
  app.post(
    "/api/items/analyze-image",
    upload.single("image"),
    async (req, res) => {
      /* ... */
    },
  );
  app.post("/api/items/import-csv", upload.single("file"), async (req, res) => {
    /* ... */
  });

  // Price History Routes (Remain the same)
  app.get("/api/price-history/:itemId", async (req, res) => {
    /* ... */
  });

  // Activity Routes (Remain the same)
  app.get("/api/activity", async (req, res) => {
    /* ... */
  });

  // Lists Routes (Remain the same)
  app.get("/api/lists", async (req, res) => {
    /* ... */
  });
  app.get("/api/lists/:id", async (req, res) => {
    /* ... */
  });
  app.post("/api/lists", async (req, res) => {
    /* ... */
  });
  app.delete("/api/lists/:id", async (req, res) => {
    /* ... */
  });

  // --- Route for checking prices within a specific list (ADDED DEBUG LOGS) ---
  app.post("/api/lists/:id/check-prices", async (req, res) => {
    const listId = req.params.id;
    // --- ADDED Log: Check received listId ---
    console.log(`[checkListPrices] Received request for list ID: ${listId}`);
    let successCount = 0;
    let failCount = 0;

    try {
      const allItems = await storage.getItems();
      // --- ADDED Log: Check total items fetched ---
      console.log(`[checkListPrices] Fetched ${allItems.length} total items.`);

      const itemsToCheck = allItems.filter((item) => {
        // @ts-ignore
        const itemLists = Array.isArray(item.lists) ? item.lists : [];
        // --- ADDED Log: Check item's lists during filtering ---
        // console.log(`[checkListPrices] Filtering item ${item.id}. Lists: [${itemLists.join(', ')}]. Checking against listId: ${listId}`);
        return listId === "all" || itemLists.includes(listId);
      });

      // --- ADDED Log: Check how many items were filtered ---
      console.log(
        `[checkListPrices] Found ${itemsToCheck.length} items in list ${listId} to check.`,
      );

      for (const item of itemsToCheck) {
        // @ts-ignore
        if (item.status === "link_dead") {
          console.log(
            `[checkListPrices] Skipping dead link item: ${item.name}`,
          ); // Added log
          continue;
        }
        try {
          // --- ADDED Log: Check which item is being scraped ---
          console.log(
            `[checkListPrices] Scraping item: ${item.name} (${item.url})`,
          );
          const product = await scrapeProductFromUrl(item.url);
          await storage.updateItem(item.id, {
            price: product.price,
            inStock: product.inStock,
            images: product.images,
            availableSizes: product.availableSizes,
            availableColors: product.availableColors,
          });
          successCount++;
          // --- ADDED Log: Scrape success ---
          console.log(`[checkListPrices] Successfully updated: ${item.name}`);
        } catch (error: any) {
          failCount++;
          // --- ADDED Log: Scrape failure ---
          console.error(
            `[checkListPrices] Error for ${item.name} in list ${listId}:`,
            error.message,
          );
          if (error.message.includes("Product not found (404)")) {
            // @ts-ignore
            await storage.updateItem(item.id, {
              inStock: false /*, status: 'link_dead'*/,
            });
            console.log(`[checkListPrices] Marked ${item.name} as 404/OOS.`); // Added log
          } else {
            console.warn(
              `[checkListPrices] Keeping previous stock for ${item.name} due to error.`,
            ); // Added log
          }
        }
      }
      console.log(
        `[checkListPrices] List ${listId} completed: ${successCount} success, ${failCount} fails.`,
      ); // Added log
      res.json({ successCount, failCount });
    } catch (error: any) {
      console.error(
        `[checkListPrices] General error for list ${listId}:`,
        error,
      ); // Added log
      res.status(500).json({
        error: `Failed to run price check for list ${listId}`,
        details: error.message,
      });
    }
  });
  // --- END OF ROUTE ---

  // Goals Routes (Remain the same)
  app.get("/api/goals", async (req, res) => {
    /* ... */
  });
  app.post("/api/goals", async (req, res) => {
    /* ... */
  });
  app.delete("/api/goals/:id", async (req, res) => {
    /* ... */
  });

  // Reverse image search (Remains the same)
  app.post("/api/items/:id/reverse-image", async (req, res) => {
    /* ... */
  });

  // Manual price check for a SPECIFIC item (Remains the same)
  app.post("/api/items/:id/check-price", async (req, res) => {
    /* ... */
  });

  // Price checking cron job (Calls helper - Correct)
  cron.schedule("0 */6 * * *", () => {
    console.log("Running scheduled 6-hour price check...");
    checkAllPrices();
  });

  // Manual "Update Now" for ALL items route (Calls helper - Correct)
  app.post("/api/items/check-all-prices", async (req, res) => {
    try {
      const result = await checkAllPrices();
      res.json(result);
    } catch (error: any) {
      res
        .status(500)
        .json({ error: "Failed to run price check", details: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// (Ensure all /* ... */ placeholders are filled correctly)
