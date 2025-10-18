// server/scrapers/jcrew_scraper.ts
import {
    BaseScraper,
    PriceInfo,
    SizeInfo,
    ColorInfo,
    ScrapedProduct,
} from "./base_scraper";
import { Page } from "puppeteer";

export class JCrewScraper extends BaseScraper {
    // J.Crew requires Puppeteer for sizes
    protected page: Page;

    constructor(html: string, url: string, puppeteerPage: Page | null) {
        super(html, url, puppeteerPage);
        if (!puppeteerPage) {
            throw new Error(
                "J.Crew scraper requires a Puppeteer page instance.",
            );
        }
        this.page = puppeteerPage;
    }

    // --- Override the main scrape method ---
    public async scrape(): Promise<ScrapedProduct> {
        console.log("[JCrewScraper] Starting scrape method...");

        // 1. Get static data first using Cheerio
        const name = this.getName(); // Uses Cheerio
        const priceInfo = this.getPrice(); // Uses Cheerio
        const images = this.getImages(); // Uses Cheerio
        const description = this.getDescription(); // Uses Cheerio

        // 2. Get dynamic data (Sizes, Colors, Stock) using Puppeteer
        console.log("[JCrewScraper] Evaluating page for dynamic content...");
        const dynamicData = await this.page.evaluate(() => {
            const sizes: SizeInfo[] = [];
            // Sizes require interaction. This needs to be done *outside* evaluate.
            // We will call a separate Puppeteer method for sizes.

            const colors: ColorInfo[] = [];
            // Your analysis: div[data-qaid="pdpProductPriceColorsGroupListWrapper-0"] div[data-qaid^="pdpProductPriceColorsGroupListItem-"]
            document
                .querySelectorAll(
                    'div[data-qaid="pdpProductPriceColorsGroupListWrapper-0"] div[data-qaid^="pdpProductPriceColorsGroupListItem-"]',
                )
                .forEach((el) => {
                    const name = el.getAttribute("data-name")?.trim();
                    const swatchImg = (
                        el.querySelector("img") as HTMLImageElement
                    )?.src;
                    // Check for availability class (Your analysis)
                    const isUnavailable =
                        el.querySelector('[class*="is-unavailable"]') !== null;
                    // const isSelected = el.querySelector('[class*="is-selected"]') !== null; // Not needed for listing all

                    if (name) {
                        colors.push({
                            name,
                            swatchUrl: swatchImg || undefined,
                        });
                        // Note: Availability check here is per *color*, not size yet.
                    }
                });

            // Overall stock check - Look for "Add to Bag" button state
            const addToBagButton = document.querySelector(
                'button[data-qaid="pdpAddToBagButton"]',
            );
            const overallInStock =
                !!addToBagButton &&
                !(addToBagButton as HTMLButtonElement).disabled;

            return { colors, overallInStock }; // Sizes will be fetched separately
        });
        console.log("[JCrewScraper] Page evaluation for colors complete.");

        // 3. Get Sizes using Puppeteer interaction
        console.log("[JCrewScraper] Attempting to get sizes...");
        const sizes = await this.getPuppeteerSizes();

        // 4. Determine final stock status
        // Use overall stock AND check if at least one size is available
        const inStock =
            dynamicData.overallInStock &&
            (sizes.length === 0 || sizes.some((s) => s.inStock)); // If sizes list is empty, rely on overall button

        // 5. Combine and return
        return {
            name: name || "Untitled Product",
            priceInfo: priceInfo,
            availableSizes: sizes,
            availableColors: dynamicData.colors.map((c) => ({
                ...c,
                swatchUrl: this.resolveUrl(c.swatchUrl),
            })), // Resolve URLs
            images: images, // Already resolved
            inStock: inStock,
            description: description,
        };
    }

    // --- Helper specifically for J.Crew sizes using Puppeteer ---
    private async getPuppeteerSizes(): Promise<SizeInfo[]> {
        const sizes: SizeInfo[] = [];
        try {
            // J.Crew sizes might be in buttons or a dropdown that needs clicking
            const sizeContainerSelector = '[class*="ProductSizes__list"]'; // Adjust selector based on inspection
            const sizeButtonSelector = `${sizeContainerSelector} button`; // Buttons within the list
            const sizeDropdownButtonSelector =
                '[class*="ProductSizesDropdown__select-button"]'; // Dropdown trigger button
            const sizeDropdownOptionSelector = 'ul[role="listbox"] li button'; // Options in the dropdown

            // Check if it's a dropdown first
            const isDropdown = await this.page.$(sizeDropdownButtonSelector);

            if (isDropdown) {
                console.log("[JCrewScraper] Found size dropdown, clicking...");
                await this.page.click(sizeDropdownButtonSelector);
                await this.page.waitForSelector(sizeDropdownOptionSelector, {
                    timeout: 5000,
                    visible: true,
                });
                console.log("[JCrewScraper] Evaluating dropdown options...");

                const dropdownSizes = await this.page.evaluate(
                    (optionSelector) => {
                        const sizeInfo: SizeInfo[] = [];
                        document
                            .querySelectorAll(optionSelector)
                            .forEach((el) => {
                                const name = (
                                    el as HTMLElement
                                ).innerText?.trim();
                                const isDisabled = (el as HTMLButtonElement)
                                    .disabled;
                                if (name) {
                                    sizeInfo.push({
                                        name,
                                        inStock: !isDisabled,
                                    });
                                }
                            });
                        return sizeInfo;
                    },
                    sizeDropdownOptionSelector,
                );
                sizes.push(...dropdownSizes);

                // Click again to close dropdown (optional, depends on site behavior)
                // await this.page.click(sizeDropdownButtonSelector);
            } else {
                // Assume it's a list of buttons
                console.log("[JCrewScraper] Evaluating size buttons...");
                const buttonSizes = await this.page.evaluate(
                    (buttonSelector) => {
                        const sizeInfo: SizeInfo[] = [];
                        document
                            .querySelectorAll(buttonSelector)
                            .forEach((el) => {
                                const name = (
                                    el as HTMLElement
                                ).innerText?.trim();
                                const isDisabled = (el as HTMLButtonElement)
                                    .disabled;
                                if (name) {
                                    sizeInfo.push({
                                        name,
                                        inStock: !isDisabled,
                                    });
                                }
                            });
                        return sizeInfo;
                    },
                    sizeButtonSelector,
                );
                sizes.push(...buttonSizes);
            }
            console.log(`[JCrewScraper] Found ${sizes.length} sizes.`);
            return sizes;
        } catch (e: any) {
            console.error(`[JCrewScraper] Error getting sizes: ${e.message}`);
            // Check if the error indicates no size selector exists (maybe one size?)
            if (e.message.includes("selector")) {
                console.log(
                    "[JCrewScraper] Size selector not found, assuming 'One Size' if possible.",
                );
                const addToCartVisible = await this.page.evaluate(
                    () =>
                        !!document.querySelector(
                            'button[data-qaid="pdpAddToBagButton"]:not(:disabled)',
                        ),
                );
                return [{ name: "One Size", inStock: addToCartVisible }];
            }
            return []; // Return empty if error occurs
        }
    }

    // --- Implement base methods using Cheerio for static/fallback data ---

    getName(): string | null {
        // Your analysis: h1[data-qaid="pdpProductName"]
        return this.getText('h1[data-qaid="pdpProductName"]') || null;
    }

    getPrice(): PriceInfo | null {
        // Your analysis: div[data-qaid="pdpProductPrice"] span[data-qaid="pdpProductPriceSale"] (or Regular)
        let priceText = this.getText(
            'div[data-qaid="pdpProductPrice"] span[data-qaid="pdpProductPriceSale"]',
        );
        if (!priceText) {
            priceText = this.getText(
                'div[data-qaid="pdpProductPrice"] span[data-qaid="pdpProductPriceRegular"]',
            );
        }
        // Might need specific parsing if format is complex (e.g., "$100.00 $50.00")
        // Find the last price listed
        const prices = priceText.match(/[$£€]?[\d,.]+/g);
        const lastPrice = prices ? prices[prices.length - 1] : priceText;

        return this.parsePriceString(lastPrice);
    }

    getSizes(): SizeInfo[] {
        return [];
    } // Rely on Puppeteer

    getColors(): ColorInfo[] {
        return [];
    } // Rely on Puppeteer

    getImages(): string[] {
        // Your analysis: div#productRevampedScroll figure img.RevampedZoomImage__unscaled-image___l7huD
        const images: string[] = [];
        this.$(
            'div#productRevampedScroll figure img[class*="unscaled-image"]',
        ).each((i, el) => {
            const img = this.$(el);
            const srcset = img.attr("srcset");
            let src = img.attr("src"); // Fallback
            if (srcset) {
                // Get highest resolution URL from srcset
                const sources = srcset
                    .split(",")
                    .map((s) => {
                        const parts = s.trim().split(" ");
                        return {
                            url: parts[0],
                            width:
                                parseInt(parts[1]?.replace("w", ""), 10) || 0,
                        };
                    })
                    .sort((a, b) => b.width - a.width); // Sort descending by width
                src = sources[0]?.url || src; // Pick the widest one
            }
            if (src) images.push(src);
        });
        return [...new Set(images)].map((src) => this.resolveUrl(src)); // Deduplicate and resolve
    }

    getInStock(): boolean {
        return false;
    } // Rely on Puppeteer

    getDescription(): string | null {
        // Try meta tags
        let description =
            this.getAttr('meta[property="og:description"]', "content") ||
            this.getAttr('meta[name="description"]', "content");
        if (description) return description;
        // Fallback: Inspect page for description section, e.g.,
        description = this.$('[data-qaid="pdpProductInfoDetails"]')
            .text()
            .trim();
        return description || null;
    }
}
