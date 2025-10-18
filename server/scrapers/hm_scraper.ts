// server/scrapers/hm_scraper.ts
import {
    BaseScraper,
    PriceInfo,
    SizeInfo,
    ColorInfo,
    ScrapedProduct,
} from "./base_scraper";
import { Page } from "puppeteer";
import * as cheerio from "cheerio"; // Import cheerio explicitly if needed for JSON parsing
import json5 from "json5"; // Use json5 for potentially malformed JSON

export class HmScraper extends BaseScraper {
    // Store the Puppeteer page instance.
    protected page: Page;
    private schemaData: any | null = null; // To store parsed schema

    constructor(html: string, url: string, puppeteerPage: Page | null) {
        super(html, url, puppeteerPage);
        if (!puppeteerPage) {
            throw new Error("H&M scraper requires a Puppeteer page instance.");
        }
        this.page = puppeteerPage;
        this.schemaData = this.parseSchema(); // Try parsing schema on initialization
    }

    // Helper to parse the JSON-LD schema
    private parseSchema(): any | null {
        try {
            // Your analysis: script id="product-schema"
            const schemaText = this.$("script#product-schema").html();
            if (schemaText) {
                // Use json5 to handle potential syntax variations
                const data = json5.parse(schemaText);
                // Ensure it's a Product schema
                if (data && data["@type"] === "Product") {
                    console.log(
                        "[HmScraper] Successfully parsed product schema.",
                    );
                    return data;
                }
            }
        } catch (e: any) {
            console.warn(
                `[HmScraper] Error parsing JSON-LD schema: ${e.message}`,
            );
        }
        console.log("[HmScraper] Product schema not found or invalid.");
        return null;
    }

    // --- Override the main scrape method ---
    public async scrape(): Promise<ScrapedProduct> {
        console.log("[HmScraper] Starting scrape method...");

        // 1. Get initial data from schema or static HTML
        const name = this.getName();
        const priceInfo = this.getPrice();
        const images = this.getImages();
        const description = this.getDescription();

        // 2. Get dynamic data (Sizes, potentially Colors) using Puppeteer
        console.log("[HmScraper] Evaluating page for dynamic content...");
        // Although your analysis points to static selectors for colors/sizes,
        // H&M often loads availability dynamically. We use Puppeteer.
        const dynamicData = await this.page.evaluate(() => {
            const sizes: SizeInfo[] = [];
            // Your analysis: div[data-testid="size-selector"] ul[data-testid="grid"] div[role="radio"]
            document
                .querySelectorAll(
                    'div[data-testid="size-selector"] ul[data-testid="grid"] div[role="radio"]',
                )
                .forEach((el) => {
                    const nameElement = el.querySelector("div"); // Inner div for text
                    const name = nameElement?.textContent
                        ?.trim()
                        .replace(/\s+/g, " "); // Clean text
                    // Availability from aria-label (e.g., "M - Out of stock") or check for disabled state
                    const ariaLabel = el.getAttribute("aria-label") || "";
                    const isDisabled =
                        el.getAttribute("aria-disabled") === "true" ||
                        ariaLabel.toLowerCase().includes("out of stock");
                    if (name) {
                        sizes.push({ name, inStock: !isDisabled });
                    }
                });

            const colors: ColorInfo[] = [];
            // Your analysis: div[data-testid="color-selector-wrapper"] a[role="radio"]
            document
                .querySelectorAll(
                    'div[data-testid="color-selector-wrapper"] a[role="radio"]',
                )
                .forEach((el) => {
                    const name = el.getAttribute("title")?.trim();
                    const swatchImg = (
                        el.querySelector("img") as HTMLImageElement
                    )?.src;
                    // const link = (el as HTMLAnchorElement)?.href; // Link might be useful
                    if (name) {
                        colors.push({
                            name,
                            swatchUrl: swatchImg || undefined,
                        });
                    }
                });

            // Simple In Stock check (e.g., presence of Add button)
            const inStockButton = document.querySelector(
                'button[data-testid="add-to-bag-button"]',
            );
            const overallInStock =
                !!inStockButton &&
                !(inStockButton as HTMLButtonElement).disabled;

            return { sizes, colors, overallInStock };
        });
        console.log("[HmScraper] Page evaluation complete.");

        // Determine final stock status
        const inStock =
            dynamicData.overallInStock ||
            (dynamicData.sizes.length > 0 &&
                dynamicData.sizes.some((s) => s.inStock));

        // 3. Combine and return
        return {
            name: name || "Untitled Product",
            priceInfo: priceInfo,
            availableSizes: dynamicData.sizes,
            availableColors: dynamicData.colors,
            images: images, // Already resolved in getImages
            inStock: inStock,
            description: description,
        };
    }

    // --- Implement base methods using schema first, then fallbacks ---

    getName(): string | null {
        // Try schema first
        if (this.schemaData?.name) return this.schemaData.name;
        // Fallback to h1 (Your analysis)
        return this.getText("h1") || null;
    }

    getPrice(): PriceInfo | null {
        // Try schema first
        try {
            if (this.schemaData?.offers) {
                const offer = Array.isArray(this.schemaData.offers)
                    ? this.schemaData.offers[0]
                    : this.schemaData.offers;
                if (offer?.price && offer?.priceCurrency) {
                    const price = parseFloat(offer.price);
                    if (!isNaN(price)) {
                        return {
                            price: Math.round(price * 100),
                            currency: offer.priceCurrency,
                        };
                    }
                }
            }
        } catch (e: any) {
            console.warn(
                `[HmScraper] Error reading price from schema: ${e.message}`,
            );
        }

        // Fallback to span[translate="no"] (Your analysis)
        const priceText = this.getText('span[translate="no"]');
        return this.parsePriceString(priceText);
    }

    getSizes(): SizeInfo[] {
        // Sizes are dynamic, rely on Puppeteer in scrape(). Return empty here.
        return [];
    }

    getColors(): ColorInfo[] {
        // Colors might load dynamically, rely on Puppeteer in scrape(). Return empty here.
        return [];
    }

    getImages(): string[] {
        // Try schema first (Your analysis)
        if (this.schemaData?.image) {
            const schemaImages = Array.isArray(this.schemaData.image)
                ? this.schemaData.image
                : [this.schemaData.image];
            if (schemaImages.length > 0) {
                // H&M schema images might need URL resolving/cleaning
                return schemaImages
                    .map((img) =>
                        this.resolveUrl(
                            typeof img === "string" ? img : img?.url,
                        ),
                    )
                    .filter(Boolean) as string[];
            }
        }
        // Fallback: Look for gallery images if schema fails
        const images: string[] = [];
        this.$("figure img[src]").each((i, el) => {
            // Adjust selector based on actual H&M gallery structure
            const src = this.$(el).attr("src");
            if (src) images.push(src);
        });
        return images.map((src) => this.resolveUrl(src));
    }

    getInStock(): boolean {
        // Rely on Puppeteer check in scrape(). Provide a basic static fallback.
        return (
            this.$('button[data-testid="add-to-bag-button"]:not(:disabled)')
                .length > 0
        );
    }

    getDescription(): string | null {
        // Try schema first
        if (this.schemaData?.description) return this.schemaData.description;
        // Fallback to meta tags
        return (
            this.getAttr('meta[property="og:description"]', "content") ||
            this.getAttr('meta[name="description"]', "content") ||
            null
        );
    }
}
