import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage"; // Your MemStorage instance
import { categorizeProduct, findProductsFromImage } from "./gemini";
import { routeAndScrape } from "./scraper"; // <<<--- IMPORT THE NEW ROUTER
import { z } from "zod";
// import cron from "node-cron"; // <<<--- REMOVE CRON
import multer from "multer";
import { parse } from "csv-parse/sync";
import puppeteer from "puppeteer-extra"; // <<<--- Need Puppeteer for manual check
import StealthPlugin from "puppeteer-extra-plugin-stealth"; // <<<--- Need Puppeteer Stealth
import type { Browser } from "puppeteer"; // <<<--- Type for browser instance

// --- Import Schema types ---
import type {
  Item,
  InsertItem,
  InsertPriceHistory,
  List,
} from "@shared/schema"; // Ensure correct path to schema types

// --- Zod schemas remain the same ---
const previewItemSchema = z.object({ url: z.string().url() });
const createItemSchema = z.object({
  url: z.string().url(),
  selectedSize: z.string().optional(),
  selectedLists: z.array(z.string()).min(1),
});
const updateItemSchema = z.object({
  size: z.string().optional(),
  lists: z.array(z.string()).optional(),
  // Add other fields users might update manually if needed
});
const createListSchema = z.object({ name: z.string().min(1) });
const createGoalSchema = z.object({
  title: z.string().min(1),
  targetAmount: z.number().int().positive(),
  deadline: z.string().optional(),
});

const upload = multer({ storage: multer.memoryStorage() });
puppeteer.use(StealthPlugin()); // Apply stealth plugin

export async function registerRoutes(app: Express): Promise<Server> {
  // --- Launch Puppeteer Browser Instance for Manual Checks ---
  // Note: Managing this instance lifecycle correctly is important.
  // This simple approach launches it once when the server starts.
  let browserInstance: Browser | null = null;
  try {
    console.log("[Server] Launching shared Puppeteer browser instance...");
    browserInstance = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });
    console.log("[Server] Puppeteer browser launched successfully.");
  } catch (err) {
    console.error("[Server] FATAL: Failed to launch Puppeteer browser:", err);
    // Decide how to handle this - maybe exit, maybe run without manual check?
    // For now, manual checks will fail if browserInstance is null.
  }

  // --- REMOVED checkAllPrices function ---
  // --- REMOVED cron job ---

  // --- Items Routes ---
  app.get("/api/items", async (req, res) => {
    try {
      // Fetch items including the new 'status' field etc.
      const items = await storage.getItems();
      res.json(items);
    } catch (error: any) {
      res
        .status(500)
        .json({ error: "Failed to fetch items", details: error.message });
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
      res
        .status(500)
        .json({ error: "Failed to fetch item", details: error.message });
    }
  });

  // Preview remains mostly the same, but calls the NEW router
  app.post("/api/items/preview", async (req, res) => {
    try {
      const { url } = previewItemSchema.parse(req.body);

      if (!browserInstance) {
        throw new Error("Browser not available for preview.");
      }

      // Use the NEW router for preview
      const product = await routeAndScrape(url, browserInstance);

      let suggestedLists: string[] = [];
      try {
        // --- Keep AI Categorization Logic ---
        // Ensure categorizeProduct takes description if available
        const categorization = await categorizeProduct(
          product.name,
          product.description,
        );
        const allLists: List[] = await storage.getLists(); // Explicitly type if needed
        suggestedLists = allLists
          .filter((list) =>
            categorization.suggestedCategories.includes(list.name),
          )
          .map((list) => list.id);
      } catch (error) {
        console.error("[Preview] Error categorizing product:", error);
      }

      // Default list if categorization fails or returns nothing
      if (suggestedLists.length === 0) {
        const allItemsList = (await storage.getLists()).find(
          (l) => l.name === "All Items",
        );
        suggestedLists = allItemsList ? [allItemsList.id] : [];
      }

      res.json({
        // Map data from ScrapedProduct structure
        name: product.name,
        price: product.priceInfo?.price,
        currency: product.priceInfo?.currency,
        images: product.images,
        availableSizes: product.availableSizes.map((s) => s.name), // Extract names
        availableColors: product.availableColors.map((c) => c.name), // Extract names
        inStock: product.inStock,
        suggestedLists,
      });
    } catch (error: any) {
      console.error("[Preview] Error in preview:", error);
      res
        .status(500)
        .json({
          error: "Failed to fetch product preview",
          details: error.message,
        });
    }
  });

  // MODIFIED: Create Item - NO SCRAPING, just add to queue
  app.post("/api/items", async (req, res) => {
    try {
      const { url, selectedSize, selectedLists } = createItemSchema.parse(
        req.body,
      );

      // --- NO SCRAPING HERE ---

      // Ensure 'all-items' list ID is included if it exists
      const allLists = await storage.getLists();
      const allItemsListId = allLists.find((l) => l.name === "All Items")?.id;
      const finalLists = allItemsListId
        ? [...new Set([...selectedLists, allItemsListId])]
        : [...new Set(selectedLists)];

      // Create item with 'pending' status
      const itemData: InsertItem = {
        url,
        size: selectedSize,
        lists: finalLists,
        status: "pending",
        // Add minimal defaults required by your schema (if any beyond status/url/lists)
        name: "Processing...", // Temporary name
        // price: undefined, // Let DB handle default or null if allowed
        // currency: undefined, // Let DB handle default or null if allowed
        images: [],
        availableSizes: [],
        availableColors: [],
        inStock: true, // Optimistic default, worker will verify
      };

      const newItem = await storage.createItem(itemData);

      // Respond immediately with 202 Accepted
      res.status(202).json(newItem);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res
          .status(400)
          .json({ error: "Invalid request data", details: error.errors });
      } else {
        console.error("Error creating item:", error);
        res
          .status(500)
          .json({ error: "Failed to create item", details: error.message });
      }
    }
  });

  // PATCH Item (Update size/lists) - Remains the same
  app.patch("/api/items/:id", async (req, res) => {
    try {
      const updates = updateItemSchema.parse(req.body);
      // Ensure we only update allowed fields, add updatedAt logic if needed by storage method
      const item = await storage.updateItem(req.params.id, updates);

      if (!item) {
        return res.status(404).json({ error: "Item not found" });
      }

      res.json(item);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res
          .status(400)
          .json({ error: "Invalid request data", details: error.errors });
      } else {
        res
          .status(500)
          .json({ error: "Failed to update item", details: error.message });
      }
    }
  });

  // DELETE Item - Remains the same
  app.delete("/api/items/:id", async (req, res) => {
    try {
      const success = await storage.deleteItem(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Item not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res
        .status(500)
        .json({ error: "Failed to delete item", details: error.message });
    }
  });

  // Analyze Image (Gemini) - Remains the same
  app.post(
    "/api/items/analyze-image",
    upload.single("image"),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: "No image file provided" });
        }
        const mimeType = req.file.mimetype || "image/jpeg";
        const products = await findProductsFromImage(req.file.buffer, mimeType);
        res.json({ products });
      } catch (error: any) {
        console.error("Error analyzing image:", error);
        res
          .status(500)
          .json({ error: "Failed to analyze image", details: error.message });
      }
    },
  );

  // MODIFIED: Import CSV - NO SCRAPING, just add items with 'pending' status
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

      let addedToQueue = 0;
      const errors: { url?: string; message: string }[] = [];
      const allLists = await storage.getLists(); // Get lists once
      const allItemsListId = allLists.find((l) => l.name === "All Items")?.id;

      console.log(
        `[CSV Import] Adding ${records.length} items to the processing queue...`,
      );

      for (const [index, record] of records.entries()) {
        const url = record.url?.trim();
        if (url) {
          try {
            let lists = allItemsListId ? [allItemsListId] : []; // Default to 'All Items'
            const category = record.category?.trim().toLowerCase();

            if (category) {
              const matchedList = allLists.find(
                (l) => l.name.toLowerCase() === category,
              );
              if (matchedList) {
                lists.push(matchedList.id);
                console.log(
                  `[CSV Import] Row ${index + 1}: Matched category "${record.category}" to list "${matchedList.name}" for ${url}`,
                );
              } else {
                console.log(
                  `[CSV Import] Row ${index + 1}: Category "${record.category}" not found for ${url}, using default list(s).`,
                );
              }
            }

            // Create item with 'pending' status
            const itemData: InsertItem = {
              url: url,
              size: record.size?.trim(),
              lists: [...new Set(lists)], // Ensure unique list IDs
              status: "pending",
              name: "Processing...", // Temporary
              // Minimal defaults
              images: [],
              price: 0,
              currency: "USD",
              availableSizes: [],
              inStock: true,
            };

            await storage.createItem(itemData);
            addedToQueue++;
          } catch (dbError: any) {
            console.error(
              `[CSV Import] Row ${index + 1}: Error adding ${url} to DB:`,
              dbError.message,
            );
            errors.push({
              url: url,
              message: `Failed to add to database: ${dbError.message}`,
            });
          }
        } else {
          console.log(
            `[CSV Import] Row ${index + 1}: Skipping - no URL provided.`,
          );
          errors.push({
            message: `Skipped row ${index + 1}: No URL provided.`,
          });
        }
      } // End loop

      console.log(
        `[CSV Import] Added ${addedToQueue} items to queue. ${errors.length} errors/skipped rows.`,
      );
      res.status(202).json({ addedToQueue, errors }); // Respond immediately
    } catch (error: any) {
      console.error("Error importing CSV:", error);
      res
        .status(500)
        .json({ error: "Failed to import CSV", details: error.message });
    }
  });

  // --- Price History / Activity / Lists / Goals Routes ---
  // (These remain largely the same as they don't involve scraping)

  // Price History Route
  app.get("/api/price-history/:itemId", async (req, res) => {
    try {
      // Pass ID directly to storage function
      const history = await storage.getPriceHistory(req.params.itemId);
      res.json(history);
    } catch (error: any) {
      res
        .status(500)
        .json({
          error: "Failed to fetch price history",
          details: error.message,
        });
    }
  });

  // Activity Route
  app.get("/api/activity", async (req, res) => {
    try {
      const activities = await storage.getRecentPriceChanges(20); // Get 20 most recent
      res.json(activities);
    } catch (error: any) {
      res
        .status(500)
        .json({ error: "Failed to fetch activity", details: error.message });
    }
  });

  // Lists Routes
  app.get("/api/lists", async (req, res) => {
    /* Keep original */ try {
      const lists = await storage.getLists();
      res.json(lists);
    } catch (e) {
      res.status(500).json({ e });
    }
  });
  app.get("/api/lists/:id", async (req, res) => {
    /* Keep original */ try {
      const l = await storage.getList(req.params.id);
      res.json(l);
    } catch (e) {
      res.status(500).json({ e });
    }
  });
  app.post("/api/lists", async (req, res) => {
    /* Keep original */ try {
      const { name } = createListSchema.parse(req.body);
      const l = await storage.createList({ name, isDefault: false });
      res.json(l);
    } catch (e) {
      res.status(500).json({ e });
    }
  });
  app.delete("/api/lists/:id", async (req, res) => {
    /* Keep original */ try {
      await storage.deleteList(req.params.id);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ e });
    }
  });

  // Goals Routes
  app.get("/api/goals", async (req, res) => {
    /* Keep original */ try {
      const g = await storage.getGoals();
      res.json(g);
    } catch (e) {
      res.status(500).json({ e });
    }
  });
  app.post("/api/goals", async (req, res) => {
    /* Keep original */ try {
      const d = createGoalSchema.parse(req.body);
      const g = await storage.createGoal({
        ...d,
        currentAmount: 0,
        itemIds: [],
        deadline: d.deadline ? new Date(d.deadline) : undefined,
      });
      res.json(g);
    } catch (e) {
      res.status(500).json({ e });
    }
  });
  app.delete("/api/goals/:id", async (req, res) => {
    /* Keep original */ try {
      await storage.deleteGoal(req.params.id);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ e });
    }
  });

  // Google Lens (Gemini) Search - Remains the same
  app.post("/api/items/:id/google-lens", async (req, res) => {
    /* Keep original */ try {
      const item = await storage.getItem(req.params.id);
      if (!item || !item.images[0]) {
        return res.status(404).json({ error: "Item or image not found" });
      }
      const imgRes = await fetch(item.images[0]);
      const imgBuf = Buffer.from(await imgRes.arrayBuffer());
      const cType = imgRes.headers.get("content-type") || "image/jpeg";
      const prods = await findProductsFromImage(imgBuf, cType);
      res.json({ products: prods });
    } catch (e) {
      console.error(e);
      res.status(500).json({ e });
    }
  });

  // MODIFIED: Manual Price Check (Single Item) - Uses NEW router
  app.post("/api/items/:id/check-price", async (req, res) => {
    try {
      const item = await storage.getItem(req.params.id);
      if (!item) {
        return res.status(404).json({ error: "Item not found" });
      }

      if (!browserInstance) {
        console.error(
          `[API /check-price] Browser not available for item ${item.id}`,
        );
        return res
          .status(503)
          .json({ error: "Scraping service temporarily unavailable" });
      }

      console.log(`[API /check-price] Manual check triggered for ${item.url}`);
      // Call the NEW router directly
      const scrapedData = await routeAndScrape(item.url, browserInstance);

      // Prepare updates based on scraped data structure
      const updates: Partial<
        InsertItem & {
          status: string;
          lastCheckedAt: Date;
          lastCheckError?: string | null;
        }
      > = {
        name: scrapedData.name,
        price: scrapedData.priceInfo?.price,
        currency: scrapedData.priceInfo?.currency,
        images: scrapedData.images,
        availableSizes: scrapedData.availableSizes.map((s) => s.name), // Extract names
        // availableColors: scrapedData.availableColors.map(c => c.name), // Extract names if scraped
        inStock: scrapedData.inStock,
        description: scrapedData.description,
        status: "processed", // Mark as processed after manual check
        lastCheckedAt: new Date(),
        lastCheckError: null, // Clear any previous error
      };

      // Use storage.updateItem
      const updatedItem = await storage.updateItem(item.id, updates);

      // Add price history record
      if (
        updates.price !== undefined &&
        updates.currency &&
        updates.inStock !== undefined
      ) {
        await storage.addPriceHistory({
          itemId: item.id,
          price: updates.price,
          currency: updates.currency,
          inStock: updates.inStock,
        });
      }

      console.log(`[API /check-price] Manual check successful for ${item.url}`);
      res.json(updatedItem);
    } catch (error: any) {
      console.error(
        `[API /check-price] Manual check failed for item ${req.params.id}: ${error.message}`,
      );
      // Update status to failed even on manual check error
      try {
        await storage.updateItem(req.params.id, {
          status: "failed",
          lastCheckedAt: new Date(),
          lastCheckError: error.message,
        });
      } catch (updateError) {
        console.error(
          `[API /check-price] Failed to update item status after error for ${req.params.id}:`,
          updateError,
        );
      }
      res
        .status(500)
        .json({ error: "Failed to check price", details: error.message });
    }
  });

  // MODIFIED: Manual "Update Now" for ALL items route - QUEUES items for worker
  app.post("/api/items/check-all-prices", async (req, res) => {
    try {
      // --- NO SCRAPING HERE ---
      const items = await storage.getItems();
      let queuedCount = 0;
      const updatePromises = [];

      for (const item of items) {
        // Queue items that aren't already pending or dead
        if (item.status !== "pending" && item.status !== "link_dead") {
          // Use storage.updateItem to set status to 'pending'
          updatePromises.push(
            storage.updateItem(item.id, { status: "pending" }),
          );
          queuedCount++;
        }
      }
      await Promise.all(updatePromises); // Update statuses in parallel

      console.log(
        `[API /check-all-prices] Queued ${queuedCount} items for price check.`,
      );
      res.status(202).json({ queuedCount }); // 202 Accepted
    } catch (error: any) {
      console.error(
        "[API /check-all-prices] Error queueing price check:",
        error,
      );
      res
        .status(500)
        .json({ error: "Failed to queue price check", details: error.message });
    }
  });

  // MODIFIED: Manual "Update Now" for specific LIST - QUEUES items for worker
  app.post("/api/lists/:id/check-prices", async (req, res) => {
    const listId = req.params.id;
    console.log(
      `[API /check-prices] Queuing price check for list ID: ${listId}`,
    );
    try {
      // --- NO SCRAPING HERE ---
      const allItems = await storage.getItems();
      let queuedCount = 0;
      const updatePromises = [];

      for (const item of allItems) {
        const itemLists = Array.isArray(item.lists) ? item.lists : [];
        const isInList =
          listId === "all-items" ||
          listId === "all" ||
          itemLists.includes(listId); // Handle 'all-items' list ID

        // Queue items in the list that aren't already pending or dead
        if (
          isInList &&
          item.status !== "pending" &&
          item.status !== "link_dead"
        ) {
          updatePromises.push(
            storage.updateItem(item.id, { status: "pending" }),
          );
          queuedCount++;
        }
      }
      await Promise.all(updatePromises);

      console.log(
        `[API /check-prices] Queued ${queuedCount} items from list ${listId} for price check.`,
      );
      res.status(202).json({ queuedCount }); // 202 Accepted
    } catch (error: any) {
      console.error(
        `[API /check-prices] Error queueing price check for list ${listId}:`,
        error,
      );
      res.status(500).json({
        error: `Failed to queue price check for list ${listId}`,
        details: error.message,
      });
    }
  });

  // --- Server and Cleanup ---
  const httpServer = createServer(app);

  // Graceful shutdown for Puppeteer
  const cleanup = async () => {
    console.log("[Server] Shutting down...");
    if (browserInstance) {
      console.log("[Server] Closing Puppeteer browser instance...");
      await browserInstance.close();
      console.log("[Server] Puppeteer browser closed.");
    }
    process.exit(0);
  };

  process.on("SIGTERM", cleanup);
  process.on("SIGINT", cleanup); // Catch Ctrl+C

  return httpServer;
}
