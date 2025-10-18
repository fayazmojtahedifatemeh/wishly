// server/scrapers/amazon_scraper.ts
import {
    BaseScraper,
    PriceInfo,
    SizeInfo,
    ColorInfo,
    ScrapedProduct,
} from "./base_scraper";
import { Page } from "puppeteer";

export class AmazonScraper extends BaseScraper {
    // Amazon REQUIRES Puppeteer for reliable price/stock/variations
    protected page: Page;

    constructor(html: string, url: string, puppeteerPage: Page | null) {
        super(html, url, puppeteerPage);
        if (!puppeteerPage) {
            throw new Error(
                "Amazon scraper requires a Puppeteer page instance.",
            );
        }
        this.page = puppeteerPage;
    }

    // --- Override the main scrape method ---
    public async scrape(): Promise<ScrapedProduct> {
        console.log("[AmazonScraper] Starting scrape method...");

        // Use Puppeteer to get potentially dynamic data
        console.log("[AmazonScraper] Evaluating page content...");
        const dynamicData = await this.page.evaluate(() => {
            // Name (Your analysis: h1#productTitle)
            const name =
                (
                    document.getElementById("productTitle") as HTMLElement
                )?.innerText?.trim() || null;

            // Price (Your analysis: spans within #corePrice_feature_div or similar)
            let priceText: string | null = null;
            const priceElement = document.querySelector(
                "#corePrice_feature_div .a-price, #price_feature_div .a-price, #priceblock_ourprice, #priceblock_dealprice, span.priceToPay",
            ); // Add more selectors as needed
            if (priceElement) {
                const whole = (
                    priceElement.querySelector(".a-price-whole") as HTMLElement
                )?.innerText
                    ?.trim()
                    .replace(".", ""); // 1,234 -> 1234
                const fraction = (
                    priceElement.querySelector(
                        ".a-price-fraction",
                    ) as HTMLElement
                )?.innerText?.trim();
                const symbol = (
                    priceElement.querySelector(".a-price-symbol") as HTMLElement
                )?.innerText?.trim();
                if (whole && fraction && symbol) {
                    priceText = `${symbol}${whole}.${fraction}`; // Reconstruct e.g., $1234.99
                } else {
                    priceText = priceElement.textContent?.trim() || null; // Fallback to full text
                }
            }

            // Sizes (Your analysis: container labeled for size, often #variation_size_name)
            const sizes: SizeInfo[] = [];
            const sizeList = document.querySelector(
                "#variation_size_name ul, #native_dropdown_selected_size_name",
            ); // ul for buttons, select for dropdown
            if (sizeList?.tagName === "UL") {
                sizeList.querySelectorAll("li[data-asin]").forEach((li) => {
                    const button = li.querySelector("button");
                    const name = button?.textContent?.trim();
                    // Check if button is selected (has 'selected' class) and if it's disabled/out-of-stock
                    const inStock =
                        !li.classList.contains(
                            "swatch-prototype-disabled-asin",
                        ) && !li.classList.contains("variation-unavailable");
                    if (name) {
                        sizes.push({ name, inStock });
                    }
                });
            } else if (sizeList?.tagName === "SELECT") {
                // Dropdown variant
                (sizeList as HTMLSelectElement)
                    .querySelectorAll("option")
                    .forEach((option) => {
                        if (
                            option.value &&
                            option.value !== "-1" &&
                            option.getAttribute("value") !== "0"
                        ) {
                            // Skip placeholder options
                            const name = option.textContent?.trim();
                            const inStock =
                                !option.disabled &&
                                !option.textContent
                                    ?.toLowerCase()
                                    .includes("unavailable");
                            if (name) {
                                sizes.push({ name, inStock });
                            }
                        }
                    });
            }

            // Colors / Styles (Your analysis: #variation_color_name ul li)
            const colors: ColorInfo[] = [];
            const colorList = document.querySelector(
                "#variation_color_name ul",
            );
            if (colorList) {
                colorList.querySelectorAll("li[data-asin]").forEach((li) => {
                    const img = li.querySelector("img");
                    const name = img?.getAttribute("alt")?.trim();
                    const swatchUrl = img?.getAttribute("src");
                    if (name) {
                        // Check if selected (class 'selected') - not strictly needed for listing all
                        colors.push({
                            name,
                            swatchUrl: swatchUrl || undefined,
                        });
                    }
                });
            }

            // Images (Your analysis: #altImages ul li img for thumbnails, #main-image-container img)
            const images: string[] = [];
            // Try high-res from main image data first
            const mainImage = document.querySelector(
                "#main-image-container img.a-dynamic-image, #landingImage",
            ) as HTMLImageElement;
            if (mainImage) {
                const hires =
                    mainImage.getAttribute("data-old-hires") || mainImage.src;
                if (hires) images.push(hires);

                // Attempt to parse dynamic image data if available
                try {
                    const dynamicImagesData = mainImage.getAttribute(
                        "data-a-dynamic-image",
                    );
                    if (dynamicImagesData) {
                        const dynamicImages = JSON.parse(dynamicImagesData);
                        Object.keys(dynamicImages).forEach((imgUrl) =>
                            images.push(imgUrl),
                        );
                    }
                } catch (e) {
                    /* ignore parse error */
                }
            }
            // Add thumbnails as fallback/additional images
            document
                .querySelectorAll("#altImages ul li.imageThumbnail img")
                .forEach((img) => {
                    const src = (img as HTMLImageElement).src;
                    // Thumbnails often have size constraints in URL, try to remove/replace for larger
                    const largeSrc = src.replace(
                        /\._[A-Z0-9]+_\./,
                        "._UL1500_.",
                    ); // Example replacement
                    if (largeSrc && !images.includes(largeSrc))
                        images.push(largeSrc);
                    if (!images.includes(src)) images.push(src); // Add original thumb too
                });

            // Description (Try #productDescription first)
            let description =
                (
                    document.getElementById("productDescription") as HTMLElement
                )?.innerText?.trim() || null;
            // Fallback to feature bullets
            if (!description) {
                const bullets = Array.from(
                    document.querySelectorAll(
                        "#feature-bullets ul li span.a-list-item",
                    ),
                ).map((el) => (el as HTMLElement).innerText.trim());
                if (bullets.length > 0) description = bullets.join("\n");
            }

            // In Stock Check (Look for "Add to Cart" button, "Currently unavailable", etc.)
            const addToCartButton =
                document.getElementById("add-to-cart-button");
            const unavailableText = document
                .querySelector("#availability span.a-color-price")
                ?.textContent?.toLowerCase()
                .includes("unavailable");
            const overallInStock = !!addToCartButton && !unavailableText;

            return {
                name,
                priceText,
                sizes,
                colors,
                images: [...new Set(images)],
                description,
                overallInStock,
            };
        });
        console.log("[AmazonScraper] Page evaluation complete.");

        // Parse price
        const priceInfo = this.parsePriceString(dynamicData.priceText);

        // Determine stock
        const inStock =
            dynamicData.overallInStock ||
            (dynamicData.sizes.length > 0 &&
                dynamicData.sizes.some((s) => s.inStock));

        // Combine and return
        return {
            name: dynamicData.name || "Untitled Product",
            priceInfo: priceInfo,
            availableSizes: dynamicData.sizes,
            availableColors: dynamicData.colors.map((c) => ({
                ...c,
                swatchUrl: this.resolveUrl(c.swatchUrl),
            })), // Resolve swatch URLs
            images: dynamicData.images.map((src) => this.resolveUrl(src)), // Resolve main image URLs
            inStock: inStock,
            description: dynamicData.description,
        };
    }

    // --- Static methods (less useful for Amazon, but needed for BaseScraper) ---
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
