// server/scrapers/farfetch_scraper.ts
import {
    BaseScraper,
    PriceInfo,
    SizeInfo,
    ColorInfo,
    ScrapedProduct,
} from "./base_scraper";
import { Page } from "puppeteer";

export class FarfetchScraper extends BaseScraper {
    // Farfetch requires Puppeteer for sizes
    protected page: Page;

    constructor(html: string, url: string, puppeteerPage: Page | null) {
        super(html, url, puppeteerPage);
        if (!puppeteerPage) {
            throw new Error(
                "Farfetch scraper requires a Puppeteer page instance.",
            );
        }
        this.page = puppeteerPage;
    }

    // --- Override the main scrape method ---
    public async scrape(): Promise<ScrapedProduct> {
        console.log("[FarfetchScraper] Starting scrape method...");

        // 1. Get initial data using Cheerio/Puppeteer evaluate
        const initialData = await this.page.evaluate(() => {
            // Name & Brand (Your analysis)
            const brand = (
                document.querySelector(
                    'h1[class*="ltr-"] a[class*="ltr-"]',
                ) as HTMLElement
            )?.innerText?.trim();
            const name = (
                document.querySelector(
                    'p[data-testid="product-short-description"]',
                ) as HTMLElement
            )?.innerText?.trim();

            // Price (Your analysis)
            const priceText = (
                document.querySelector(
                    'p[data-component="PriceLarge"]',
                ) as HTMLElement
            )?.innerText?.trim();

            // Colors (Your analysis: None in snippet, check alt text?)
            // Let's grab the single color mentioned if possible
            const singleColor = (
                document.querySelector(
                    'p[data-testid="data-product-colour"]',
                ) as HTMLElement
            )?.innerText?.trim(); // Check for a dedicated color element

            // Images (Your analysis)
            const images: string[] = [];
            document
                .querySelectorAll(
                    'div[class*="ltr-1kklpjs"] button[class*="ltr-"] img',
                )
                .forEach((el) => {
                    const img = el as HTMLImageElement;
                    const src = img.src; // Main image src
                    // Prioritize higher-res if available via data attribute or modifying URL
                    // Example: src might end in _480.jpg, try replacing with _1000.jpg
                    const hiresSrc = src.replace(
                        /_\d+\.(jpg|jpeg|png|webp)$/i,
                        "_1000.$1",
                    );
                    if (hiresSrc && hiresSrc !== src) images.push(hiresSrc); // Add hires if modification worked
                    if (src && !images.includes(src)) images.push(src); // Add original src
                });

            // Description (Try meta tags first within evaluate)
            let description =
                (
                    document.querySelector(
                        'meta[property="og:description"]',
                    ) as HTMLMetaElement
                )?.content ||
                (
                    document.querySelector(
                        'meta[name="description"]',
                    ) as HTMLMetaElement
                )?.content ||
                null;
            // Fallback: Look for description section
            if (!description) {
                description = (
                    document.querySelector(
                        '[data-testid="product-description"]',
                    ) as HTMLElement
                )?.innerText?.trim();
            }

            // Basic In Stock Check (Look for 'Add To Bag' button)
            const addToBagButton = document.querySelector(
                '[data-testid="addToBag"]',
            );
            const overallInStock = !!addToBagButton; // Simple check

            return {
                brand,
                name,
                priceText,
                singleColor,
                images: [...new Set(images)],
                description,
                overallInStock,
            };
        });
        console.log("[FarfetchScraper] Initial page evaluation complete.");

        // 2. Get Sizes using Puppeteer interaction
        console.log("[FarfetchScraper] Attempting to get sizes...");
        const sizes = await this.getPuppeteerSizes();

        // 3. Process collected data
        const fullName =
            initialData.brand && initialData.name
                ? `${initialData.brand} - ${initialData.name}`
                : initialData.name || initialData.brand || null;
        const priceInfo = this.parsePriceString(initialData.priceText);
        const colors = initialData.singleColor
            ? [{ name: initialData.singleColor, swatchUrl: undefined }]
            : []; // Use the single color if found
        const inStock =
            initialData.overallInStock &&
            (sizes.length === 0 || sizes.some((s) => s.inStock)); // Check button AND size availability

        // 4. Combine and return
        return {
            name: fullName || "Untitled Product",
            priceInfo: priceInfo,
            availableSizes: sizes,
            availableColors: colors,
            images: initialData.images.map((src) => this.resolveUrl(src)), // Resolve URLs
            inStock: inStock,
            description: initialData.description,
        };
    }

    // --- Helper specifically for Farfetch sizes using Puppeteer ---
    private async getPuppeteerSizes(): Promise<SizeInfo[]> {
        try {
            // Your analysis: Click div.ltr-1aksjyr inside div[data-testid="ScaledSizeSelector"]
            const dropdownTriggerSelector =
                'div[data-testid="ScaledSizeSelector"] div[class*="ltr-"]'; // Use partial class match
            const sizeOptionSelector = 'ul[role="listbox"] li button'; // Options within the dropdown listbox

            console.log("[FarfetchScraper] Clicking size dropdown trigger...");
            await this.page.click(dropdownTriggerSelector);

            console.log("[FarfetchScraper] Waiting for size options...");
            await this.page.waitForSelector(sizeOptionSelector, {
                timeout: 7000,
                visible: true,
            });

            console.log("[FarfetchScraper] Evaluating size options...");
            const sizes = await this.page.evaluate((optionSelector) => {
                const sizeInfo: SizeInfo[] = [];
                document.querySelectorAll(optionSelector).forEach((el) => {
                    const button = el as HTMLButtonElement;
                    const name = button.textContent?.trim();
                    // Check if the button itself or its parent li is disabled or marked unavailable
                    const isUnavailable =
                        button.disabled ||
                        button.closest("li")?.getAttribute("aria-disabled") ===
                            "true";
                    if (name) {
                        sizeInfo.push({ name, inStock: !isUnavailable });
                    }
                });
                return sizeInfo;
            }, sizeOptionSelector);

            console.log(
                `[FarfetchScraper] Found ${sizes.length} sizes. Closing dropdown (optional)...`,
            );
            // Click again to close dropdown (might not be necessary)
            // await this.page.click(dropdownTriggerSelector);

            return sizes;
        } catch (e: any) {
            console.error(
                `[FarfetchScraper] Error getting sizes: ${e.message}`,
            );
            // Check if it's a one-size item (no dropdown trigger?)
            if (e.message.includes("selector")) {
                const selectedSizeText = await this.page
                    .$eval(
                        'div[data-testid="ScaledSizeSelector"]',
                        (el) => (el as HTMLElement).innerText,
                    )
                    .catch(() => null);
                if (selectedSizeText?.toLowerCase().includes("one size")) {
                    console.log("[FarfetchScraper] Detected 'One Size'.");
                    const addToCartVisible = await this.page.evaluate(
                        () =>
                            !!document.querySelector(
                                '[data-testid="addToBag"]',
                            ),
                    );
                    return [{ name: "One Size", inStock: addToCartVisible }];
                } else if (selectedSizeText) {
                    // If there's selected text but dropdown failed, maybe just one size available?
                    console.log(
                        `[FarfetchScraper] Dropdown failed, found selected size: ${selectedSizeText}`,
                    );
                    const addToCartVisible = await this.page.evaluate(
                        () =>
                            !!document.querySelector(
                                '[data-testid="addToBag"]',
                            ),
                    );
                    return [
                        { name: selectedSizeText, inStock: addToCartVisible },
                    ];
                }
            }
            return []; // Return empty if error occurs
        }
    }

    // --- Static methods (less useful as dynamic data is preferred) ---
    getName(): string | null {
        return null;
    } // Rely on Puppeteer
    getPrice(): PriceInfo | null {
        return null;
    } // Rely on Puppeteer
    getSizes(): SizeInfo[] {
        return [];
    } // Rely on Puppeteer
    getColors(): ColorInfo[] {
        return [];
    } // Rely on Puppeteer
    getImages(): string[] {
        return [];
    } // Rely on Puppeteer
    getInStock(): boolean {
        return false;
    } // Rely on Puppeteer
    getDescription(): string | null {
        return null;
    } // Rely on Puppeteer
}
