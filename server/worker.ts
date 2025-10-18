// worker.ts
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { existsSync } from "fs";

// --- Import your NEW Router ---
import { routeAndScrape } from "./scraper";

// --- Import your MemStorage ---
// storage.ts seems to export an instance named 'storage'
import { storage } from "./storage";

// --- Import Schema types ---
// Needed for type safety when updating items/history
import { Item, InsertItem, InsertPriceHistory } from "@shared/schema";

puppeteer.use(StealthPlugin());

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function getChromiumExecutablePath(): string | undefined {
  const possiblePaths = [
    "/nix/store/biqk69p9jn429lygshhy0zig86kw8gip-chromium-141.0.7390.73/bin/chromium",
    "/nix/store/biqk69p9jn429lygshhy0zig86kw8gip-chromium-141.0.7390.73/bin/chromium-browser",
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.env.CHROME_BIN,
  ];

  for (const path of possiblePaths) {
    if (path && existsSync(path)) {
      console.log(`[Worker] Found Chromium executable at: ${path}`);
      return path;
    }
  }

  console.warn("[Worker] Could not find Chromium executable, using default");
  return undefined;
}

// Helper to get the next item needing scraping using MemStorage
async function getNextItemToScrape(): Promise<Item | null> {
    try {
        const allItems = await storage.getItems();
        // Find the first item with status 'pending'
        // Add more logic here if you want to retry 'failed' items after some time
        const pendingItem = allItems.find(
            (item) => (item as any).status === "pending",
        ); // Type assertion needed if status isn't in Item type yet
        return pendingItem || null;
    } catch (error) {
        console.error("[Worker] Error fetching next item:", error);
        return null;
    }
}

// Helper to update item after scraping using MemStorage
async function updateScrapedItem(
    id: string,
    scrapedData: any, // Data returned from routeAndScrape
    status: "processed" | "failed" | "link_dead",
    errorMessage?: string,
) {
    try {
        let updates: Partial<
            InsertItem & {
                status: string;
                lastCheckedAt: Date;
                lastCheckError?: string;
            }
        > = {
            status,
            lastCheckedAt: new Date(),
        };

        if (status === "processed") {
            updates = {
                ...updates,
                name: scrapedData.name,
                price: scrapedData.priceInfo?.price,
                currency: scrapedData.priceInfo?.currency,
                images: scrapedData.images,
                // --- Adjust these based on your actual ScrapedProduct structure ---
                availableSizes:
                    scrapedData.availableSizes?.map((s: any) => s.name) || [], // Assuming routeAndScrape returns { name, inStock }[]
                // availableColors: scrapedData.availableColors?.map((c: any) => c.name) || [], // Assuming routeAndScrape returns { name, swatchUrl }[]
                inStock: scrapedData.inStock,
                description: scrapedData.description,
            };

            // Add price history record using MemStorage method
            if (updates.price !== undefined) {
                const historyEntry: InsertPriceHistory = {
                    itemId: id,
                    price: updates.price,
                    currency: updates.currency!, // Assume currency is present if price is
                    inStock: updates.inStock!, // Assume inStock is present
                };
                await storage.addPriceHistory(historyEntry);
            }
        } else if (status === "failed") {
            updates.lastCheckError = errorMessage;
        } else if (status === "link_dead") {
            updates.inStock = false; // Mark as out of stock
            updates.lastCheckError = "Product not found (404)";
        }

        // Call MemStorage update method
        await storage.updateItem(id, updates);
    } catch (error) {
        console.error(
            `[Worker] Error updating item ${id} in MemStorage:`,
            error,
        );
    }
}

async function main() {
    console.log("[Worker] Starting...");
    const chromiumPath = getChromiumExecutablePath();
    const browser = await puppeteer.launch({
        headless: true,
        executablePath: chromiumPath,
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
        ],
    });

    console.log("[Worker] Browser launched.");

    while (true) {
        const item = await getNextItemToScrape();

        if (item) {
            console.log(`[Worker] Processing ${item.url} (ID: ${item.id})...`);
            try {
                // Call the Scraper Router
                const scrapedData = await routeAndScrape(item.url, browser);

                await updateScrapedItem(item.id, scrapedData, "processed");
                console.log(`[Worker] ✓ Successfully processed ${item.url}`);
            } catch (e: any) {
                console.error(
                    `[Worker] ✗ Failed for ${item.url}: ${e.message}`,
                );
                if (
                    e.message.includes("404") ||
                    e.message.toLowerCase().includes("not found")
                ) {
                    await updateScrapedItem(
                        item.id,
                        {},
                        "link_dead",
                        e.message,
                    );
                } else {
                    await updateScrapedItem(item.id, {}, "failed", e.message);
                }
            }

            const delay = 10000 + Math.random() * 5000; // Wait 10-15 seconds
            console.log(
                `[Worker] Sleeping for ${Math.round(delay / 1000)} seconds...`,
            );
            await sleep(delay);
        } else {
            console.log("[Worker] No pending jobs. Sleeping for 60 seconds.");
            await sleep(60000);
        }
    }
}

main().catch((error) => {
    console.error("[Worker] Fatal error:", error);
    process.exit(1);
});
