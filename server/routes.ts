import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { categorizeProduct, findProductsFromImage } from "./gemini";
import { scrapeProductFromUrl } from "./scraper";
import { z } from "zod";
import cron from "node-cron";
import multer from "multer";
import { parse } from "csv-parse/sync";

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
  async function checkAllPrices() {
    console.log("Running checkAllPrices...");
    let successCount = 0;
    let failCount = 0;
    try {
      const items = await storage.getItems();
      console.log(`[checkAllPrices] Checking ${items.length} total items...`);
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
          });
          successCount++;
        } catch (error: any) {
          failCount++;
          console.error(`[checkAllPrices] Error for ${item.name}:`, error.message);
          if (error.message.includes("Product not found (404)")) {
            // @ts-ignore
            await storage.updateItem(item.id, { inStock: false });
          } else {
            console.warn(`[checkAllPrices] Keeping previous stock for ${item.name} due to error.`);
          }
        }
      }
      console.log(`[checkAllPrices] Completed: ${successCount} success, ${failCount} fails.`);
      return { successCount, failCount };
    } catch (error) {
      console.error("[checkAllPrices] Error fetching items:", error);
      return { successCount, failCount, error: true };
    }
  }

  // Items Routes
  app.get("/api/items", async (req, res) => {
    try {
      const items = await storage.getItems();
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch items", details: error.message });
    }
  });

  app.get("/api/items/:id", async (req, res) => {
    try {
      const item = await storage.getItem(req.params.id);
      if (!item) {
        return res.status(404).json({ error: "Item not found" });
      }
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch item", details: error.message });
    }
  });

  app.post("/api/items/preview", async (req, res) => {
    try {
      const { url } = previewItemSchema.parse(req.body);
      
      const product = await scrapeProductFromUrl(url);
      
      let suggestedLists: string[] = [];
      try {
        const categorization = await categorizeProduct(product.name);
        const allLists = await storage.getLists();
        suggestedLists = allLists
          .filter(list => categorization.suggestedCategories.includes(list.name))
          .map(list => list.id);
      } catch (error) {
        console.error("Error categorizing product:", error);
      }

      if (suggestedLists.length === 0) {
        suggestedLists = ["all-items"];
      }

      res.json({
        name: product.name,
        price: product.price,
        currency: product.currency,
        images: product.images,
        availableSizes: product.availableSizes,
        availableColors: product.availableColors,
        inStock: product.inStock,
        suggestedLists,
      });
    } catch (error: any) {
      console.error("Error in preview:", error);
      res.status(500).json({ error: "Failed to fetch product preview", details: error.message });
    }
  });

  app.post("/api/items", async (req, res) => {
    try {
      const { url, selectedSize, selectedLists } = createItemSchema.parse(req.body);
      
      const product = await scrapeProductFromUrl(url);
      
      const item = await storage.createItem({
        name: product.name,
        url,
        images: product.images,
        price: product.price,
        currency: product.currency,
        size: selectedSize,
        availableSizes: product.availableSizes,
        inStock: product.inStock,
        lists: selectedLists,
      });

      res.json(item);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid request data", details: error.errors });
      } else {
        console.error("Error creating item:", error);
        res.status(500).json({ error: "Failed to create item", details: error.message });
      }
    }
  });

  app.patch("/api/items/:id", async (req, res) => {
    try {
      const updates = updateItemSchema.parse(req.body);
      const item = await storage.updateItem(req.params.id, updates);
      
      if (!item) {
        return res.status(404).json({ error: "Item not found" });
      }

      res.json(item);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid request data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to update item", details: error.message });
      }
    }
  });

  app.delete("/api/items/:id", async (req, res) => {
    try {
      const success = await storage.deleteItem(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Item not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to delete item", details: error.message });
    }
  });

  app.post("/api/items/analyze-image", upload.single("image"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image file provided" });
      }

      const products = await findProductsFromImage(req.file.buffer);
      res.json({ products });
    } catch (error: any) {
      console.error("Error analyzing image:", error);
      res.status(500).json({ error: "Failed to analyze image", details: error.message });
    }
  });

  app.post("/api/items/import-csv", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file provided" });
      }

      const csvContent = req.file.buffer.toString("utf-8");
      const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
      }) as Array<{ url?: string; category?: string; size?: string }>;

      let imported = 0;
      let failed = 0;

      for (const record of records) {
        try {
          if (!record.url) {
            failed++;
            continue;
          }

          const product = await scrapeProductFromUrl(record.url);
          
          let lists = ["all-items"];
          if (record.category && record.category.trim()) {
            const allLists = await storage.getLists();
            const matchedList = allLists.find(
              l => l.name.toLowerCase() === record.category!.toLowerCase()
            );
            if (matchedList) {
              lists = [matchedList.id];
            }
          }

          await storage.createItem({
            name: product.name,
            url: record.url,
            images: product.images,
            price: product.price,
            currency: product.currency,
            size: record.size,
            availableSizes: product.availableSizes,
            inStock: product.inStock,
            lists,
          });

          imported++;
        } catch (error) {
          console.error("Error importing row:", error);
          failed++;
        }
      }

      res.json({ imported, failed });
    } catch (error: any) {
      console.error("Error importing CSV:", error);
      res.status(500).json({ error: "Failed to import CSV", details: error.message });
    }
  });

  // Price History Routes
  app.get("/api/price-history/:itemId", async (req, res) => {
    try {
      const history = await storage.getPriceHistory(req.params.itemId);
      res.json(history);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch price history", details: error.message });
    }
  });

  // Activity Routes
  app.get("/api/activity", async (req, res) => {
    try {
      const activities = await storage.getRecentPriceChanges(20);
      res.json(activities);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch activity", details: error.message });
    }
  });

  // Lists Routes
  app.get("/api/lists", async (req, res) => {
    try {
      const lists = await storage.getLists();
      res.json(lists);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch lists", details: error.message });
    }
  });

  app.get("/api/lists/:id", async (req, res) => {
    try {
      const list = await storage.getList(req.params.id);
      if (!list) {
        return res.status(404).json({ error: "List not found" });
      }
      res.json(list);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch list", details: error.message });
    }
  });

  app.post("/api/lists", async (req, res) => {
    try {
      const { name } = createListSchema.parse(req.body);
      const list = await storage.createList({ name, isDefault: false });
      res.json(list);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid request data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create list", details: error.message });
      }
    }
  });

  app.delete("/api/lists/:id", async (req, res) => {
    try {
      const success = await storage.deleteList(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "List not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to delete list", details: error.message });
    }
  });

  app.post("/api/lists/:id/check-prices", async (req, res) => {
    const listId = req.params.id;
    console.log(`[checkListPrices] Received request for list ID: ${listId}`);
    let successCount = 0;
    let failCount = 0;

    try {
      const allItems = await storage.getItems();
      console.log(`[checkListPrices] Fetched ${allItems.length} total items.`);

      const itemsToCheck = allItems.filter((item) => {
        // @ts-ignore
        const itemLists = Array.isArray(item.lists) ? item.lists : [];
        return listId === "all" || itemLists.includes(listId);
      });

      console.log(`[checkListPrices] Found ${itemsToCheck.length} items in list ${listId} to check.`);

      for (const item of itemsToCheck) {
        // @ts-ignore
        if (item.status === "link_dead") {
          console.log(`[checkListPrices] Skipping dead link item: ${item.name}`);
          continue;
        }
        try {
          console.log(`[checkListPrices] Scraping item: ${item.name} (${item.url})`);
          const product = await scrapeProductFromUrl(item.url);
          await storage.updateItem(item.id, {
            price: product.price,
            inStock: product.inStock,
            images: product.images,
            availableSizes: product.availableSizes,
          });
          successCount++;
          console.log(`[checkListPrices] Successfully updated: ${item.name}`);
        } catch (error: any) {
          failCount++;
          console.error(`[checkListPrices] Error for ${item.name} in list ${listId}:`, error.message);
          if (error.message.includes("Product not found (404)")) {
            // @ts-ignore
            await storage.updateItem(item.id, { inStock: false });
            console.log(`[checkListPrices] Marked ${item.name} as 404/OOS.`);
          } else {
            console.warn(`[checkListPrices] Keeping previous stock for ${item.name} due to error.`);
          }
        }
      }
      console.log(`[checkListPrices] List ${listId} completed: ${successCount} success, ${failCount} fails.`);
      res.json({ successCount, failCount });
    } catch (error: any) {
      console.error(`[checkListPrices] General error for list ${listId}:`, error);
      res.status(500).json({
        error: `Failed to run price check for list ${listId}`,
        details: error.message,
      });
    }
  });

  // Goals Routes
  app.get("/api/goals", async (req, res) => {
    try {
      const goals = await storage.getGoals();
      res.json(goals);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch goals", details: error.message });
    }
  });

  app.post("/api/goals", async (req, res) => {
    try {
      const data = createGoalSchema.parse(req.body);
      const goal = await storage.createGoal({
        ...data,
        currentAmount: 0,
        itemIds: [],
        deadline: data.deadline ? new Date(data.deadline) : undefined,
      });
      res.json(goal);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid request data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create goal", details: error.message });
      }
    }
  });

  app.delete("/api/goals/:id", async (req, res) => {
    try {
      const success = await storage.deleteGoal(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Goal not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to delete goal", details: error.message });
    }
  });

  // Google Lens search using Gemini Vision API
  app.post("/api/items/:id/google-lens", async (req, res) => {
    try {
      const item = await storage.getItem(req.params.id);
      if (!item) {
        return res.status(404).json({ error: "Item not found" });
      }

      const imageUrl = item.images[0];
      if (!imageUrl) {
        return res.status(400).json({ error: "No image available for this item" });
      }

      const imageResponse = await fetch(imageUrl);
      const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
      
      const products = await findProductsFromImage(imageBuffer);
      res.json({ products });
    } catch (error: any) {
      console.error("Error with Google Lens search:", error);
      res.status(500).json({ error: "Failed to search with Google Lens", details: error.message });
    }
  });

  // Manual price check for a SPECIFIC item
  app.post("/api/items/:id/check-price", async (req, res) => {
    try {
      const item = await storage.getItem(req.params.id);
      if (!item) {
        return res.status(404).json({ error: "Item not found" });
      }

      const product = await scrapeProductFromUrl(item.url);
      const updatedItem = await storage.updateItem(item.id, {
        price: product.price,
        inStock: product.inStock,
        images: product.images,
        availableSizes: product.availableSizes,
      });

      res.json(updatedItem);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to check price", details: error.message });
    }
  });

  // Price checking cron job
  cron.schedule("0 */6 * * *", () => {
    console.log("Running scheduled 6-hour price check...");
    checkAllPrices();
  });

  // Manual "Update Now" for ALL items route
  app.post("/api/items/check-all-prices", async (req, res) => {
    try {
      const result = await checkAllPrices();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to run price check", details: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
