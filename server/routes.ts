import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { categorizeProduct, analyzeProductImage } from "./gemini";
import { scrapeProductFromUrl } from "./scraper";
import { z } from "zod";
import cron from "node-cron";
import multer from "multer";
import { parse } from "csv-parse/sync";

// Validation schemas
const previewItemSchema = z.object({
  url: z.string().url(),
});

const createItemSchema = z.object({
  url: z.string().url(),
  selectedSize: z.string().optional(),
  selectedLists: z.array(z.string()).min(1),
});

const updateItemSchema = z.object({
  size: z.string().optional(),
  lists: z.array(z.string()).optional(),
});

const createListSchema = z.object({
  name: z.string().min(1),
});

const createGoalSchema = z.object({
  title: z.string().min(1),
  targetAmount: z.number().int().positive(),
  deadline: z.string().optional(),
});

// Configure multer for CSV uploads
const upload = multer({ storage: multer.memoryStorage() });

export async function registerRoutes(app: Express): Promise<Server> {
  // Items Routes
  app.get("/api/items", async (req, res) => {
    try {
      const items = await storage.getItems();
      res.json(items);
    } catch (error) {
      console.error("Error fetching items:", error);
      res.status(500).json({ error: "Failed to fetch items" });
    }
  });

  app.get("/api/items/:id", async (req, res) => {
    try {
      const item = await storage.getItem(req.params.id);
      if (!item) {
        return res.status(404).json({ error: "Item not found" });
      }
      res.json(item);
    } catch (error) {
      console.error("Error fetching item:", error);
      res.status(500).json({ error: "Failed to fetch item" });
    }
  });

  app.post("/api/items/preview", async (req, res) => {
    try {
      const { url } = previewItemSchema.parse(req.body);

      // Scrape product data
      const product = await scrapeProductFromUrl(url);

      // Get AI categorization
      const categorization = await categorizeProduct(product.name, product.description);

      // Find matching list IDs
      const allLists = await storage.getLists();
      const suggestedLists = allLists
        .filter((list) => categorization.suggestedCategories.includes(list.name))
        .map((list) => list.id);

      res.json({
        name: product.name,
        images: product.images,
        price: product.price,
        currency: product.currency,
        availableSizes: product.availableSizes,
        suggestedLists,
      });
    } catch (error) {
      console.error("Error previewing item:", error);
      res.status(500).json({ error: "Failed to fetch product details" });
    }
  });

  app.post("/api/items", async (req, res) => {
    try {
      const { url, selectedSize, selectedLists } = createItemSchema.parse(req.body);

      // Scrape product data again to get fresh data
      const product = await scrapeProductFromUrl(url);

      // Create short URL (simplified)
      const shortUrl = new URL(url).hostname;

      const item = await storage.createItem({
        name: product.name,
        url,
        shortUrl,
        images: product.images,
        price: product.price,
        currency: product.currency,
        size: selectedSize,
        availableSizes: product.availableSizes,
        inStock: true,
        lists: selectedLists,
      });

      res.json(item);
    } catch (error) {
      console.error("Error creating item:", error);
      res.status(500).json({ error: "Failed to create item" });
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
    } catch (error) {
      console.error("Error updating item:", error);
      res.status(500).json({ error: "Failed to update item" });
    }
  });

  app.delete("/api/items/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteItem(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Item not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting item:", error);
      res.status(500).json({ error: "Failed to delete item" });
    }
  });

  // Image Analysis Route
  app.post("/api/items/analyze-image", upload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image uploaded" });
      }

      const description = await analyzeProductImage(req.file.buffer);
      res.json({ description });
    } catch (error) {
      console.error("Error analyzing image:", error);
      res.status(500).json({ error: "Failed to analyze image" });
    }
  });

  // CSV Import Route
  app.post("/api/items/import-csv", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const csvData = req.file.buffer.toString('utf-8');
      const records = parse(csvData, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      });

      const allLists = await storage.getLists();
      const listNameToId = Object.fromEntries(
        allLists.map(list => [list.name.toLowerCase(), list.id])
      );

      const imported = [];
      const failed = [];

      for (const record of records) {
        try {
          // Parse price - remove currency symbols and convert to cents
          const priceStr = record.price?.replace(/[^0-9.,]/g, '') || '0';
          const price = Math.round(parseFloat(priceStr.replace(',', '.')) * 100);

          // Parse lists from comma-separated string
          const listsStr = record.lists || 'All items';
          const listNames = listsStr.split(',').map((l: string) => l.trim().toLowerCase());
          const listIds = listNames
            .map(name => listNameToId[name])
            .filter(Boolean);

          if (listIds.length === 0) {
            // Default to "All Items" if no valid lists found
            const allItemsList = allLists.find(l => l.name === 'All Items');
            if (allItemsList) listIds.push(allItemsList.id);
          }

          // Create item
          const item = await storage.createItem({
            name: record.title || 'Untitled Item',
            url: record.url,
            shortUrl: record.merchant || new URL(record.url).hostname,
            images: record.image_url ? [record.image_url] : [],
            price,
            currency: record.currency || 'USD',
            size: record.selected_option,
            availableSizes: record.selected_option ? [record.selected_option] : [],
            inStock: record.status !== 'out_of_stock',
            lists: listIds,
          });

          imported.push(item);
        } catch (error) {
          console.error('Failed to import item:', record, error);
          failed.push({ url: record.url, error: String(error) });
        }
      }

      res.json({ 
        success: true, 
        imported: imported.length, 
        failed: failed.length,
        failedItems: failed
      });
    } catch (error) {
      console.error("Error importing CSV:", error);
      res.status(500).json({ error: "Failed to import CSV" });
    }
  });

  // Price History Routes
  app.get("/api/price-history/:itemId", async (req, res) => {
    try {
      const history = await storage.getPriceHistory(req.params.itemId);
      res.json(history);
    } catch (error) {
      console.error("Error fetching price history:", error);
      res.status(500).json({ error: "Failed to fetch price history" });
    }
  });

  // Activity Routes
  app.get("/api/activity", async (req, res) => {
    try {
      const activities = await storage.getRecentPriceChanges(10);
      res.json(activities);
    } catch (error) {
      console.error("Error fetching activity:", error);
      res.status(500).json({ error: "Failed to fetch activity" });
    }
  });

  // Lists Routes
  app.get("/api/lists", async (req, res) => {
    try {
      const lists = await storage.getLists();
      res.json(lists);
    } catch (error) {
      console.error("Error fetching lists:", error);
      res.status(500).json({ error: "Failed to fetch lists" });
    }
  });

  app.get("/api/lists/:id", async (req, res) => {
    try {
      const list = await storage.getList(req.params.id);
      if (!list) {
        return res.status(404).json({ error: "List not found" });
      }
      res.json(list);
    } catch (error) {
      console.error("Error fetching list:", error);
      res.status(500).json({ error: "Failed to fetch list" });
    }
  });

  app.post("/api/lists", async (req, res) => {
    try {
      const { name } = createListSchema.parse(req.body);
      const list = await storage.createList({ name, icon: null });
      res.json(list);
    } catch (error) {
      console.error("Error creating list:", error);
      res.status(500).json({ error: "Failed to create list" });
    }
  });

  app.delete("/api/lists/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteList(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "List not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting list:", error);
      res.status(500).json({ error: "Failed to delete list" });
    }
  });

  // Goals Routes
  app.get("/api/goals", async (req, res) => {
    try {
      const goals = await storage.getGoals();
      res.json(goals);
    } catch (error) {
      console.error("Error fetching goals:", error);
      res.status(500).json({ error: "Failed to fetch goals" });
    }
  });

  app.post("/api/goals", async (req, res) => {
    try {
      const data = createGoalSchema.parse(req.body);
      const goal = await storage.createGoal({
        ...data,
        currentAmount: 0,
        currency: "USD",
        deadline: data.deadline ? new Date(data.deadline) : undefined,
        itemIds: [],
      });
      res.json(goal);
    } catch (error) {
      console.error("Error creating goal:", error);
      res.status(500).json({ error: "Failed to create goal" });
    }
  });

  app.delete("/api/goals/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteGoal(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Goal not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting goal:", error);
      res.status(500).json({ error: "Failed to delete goal" });
    }
  });

  // Reverse image search
  app.post("/api/items/:id/reverse-image", async (req, res) => {
    try {
      const item = await storage.getItem(req.params.id);
      if (!item) {
        return res.status(404).json({ error: "Item not found" });
      }

      const images = Array.isArray(item.images) ? item.images : [];
      if (images.length === 0) {
        return res.status(400).json({ error: "No images available" });
      }

      // Return Google reverse image search URL
      const searchUrl = `https://www.google.com/searchbyimage?image_url=${encodeURIComponent(images[0])}`;
      res.json({ searchUrl });
    } catch (error) {
      console.error("Error creating reverse image search:", error);
      res.status(500).json({ error: "Failed to create reverse image search" });
    }
  });

  // Manual price check for a specific item
  app.post("/api/items/:id/check-price", async (req, res) => {
    try {
      const item = await storage.getItem(req.params.id);
      if (!item) {
        return res.status(404).json({ error: "Item not found" });
      }

      const product = await scrapeProductFromUrl(item.url);
      
      const priceChanged = product.price !== item.price;
      const stockChanged = (product.price > 0) !== item.inStock;

      await storage.updateItem(item.id, {
        price: product.price,
        inStock: product.price > 0,
        images: product.images,
        availableSizes: product.availableSizes,
      });

      res.json({
        priceChanged,
        stockChanged,
        oldPrice: item.price,
        newPrice: product.price,
        inStock: product.price > 0,
      });
    } catch (error) {
      console.error("Error checking price:", error);
      // Mark as out of stock if scraping fails
      await storage.updateItem(req.params.id, { inStock: false });
      res.status(500).json({ error: "Failed to check price" });
    }
  });

  // Price checking cron job (every 6 hours)
  cron.schedule("0 */6 * * *", async () => {
    console.log("Running scheduled price check...");
    try {
      const items = await storage.getItems();

      for (const item of items) {
        try {
          const product = await scrapeProductFromUrl(item.url);

          // Update item with new data
          await storage.updateItem(item.id, {
            price: product.price,
            inStock: product.price > 0,
            images: product.images,
            availableSizes: product.availableSizes,
          });

          console.log(`Checked ${item.name}: ${item.price/100} -> ${product.price/100} ${item.currency}`);
        } catch (error) {
          console.error(`Error checking price for ${item.name}:`, error);
          // Mark as out of stock if scraping fails
          await storage.updateItem(item.id, { inStock: false });
        }
      }

      console.log("Price check completed");
    } catch (error) {
      console.error("Error in price check cron:", error);
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
