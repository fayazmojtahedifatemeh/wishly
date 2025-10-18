// server/scrapers/ralph_lauren_scraper.ts
import {
    BaseScraper,
    PriceInfo,
    SizeInfo,
    ColorInfo,
    ScrapedProduct,
} from "./base_scraper";
import { Page } from "puppeteer"; // Needs Puppeteer for reliable JSON schema access
import json5 from "json5"; // Use json5 for parsing

export class RalphLaurenScraper extends BaseScraper {
    // Needs Puppeteer because the schema JSON might be dynamically loaded/rendered
    protected page: Page;
    private schemaData: any | null = null;

    constructor(html: string, url: string, puppeteerPage: Page | null) {
        super(html, url, puppeteerPage);
        if (!puppeteerPage) {
            throw new Error(
                "Ralph Lauren scraper requires a Puppeteer page instance.",
            );
        }
        this.page = puppeteerPage;
        // Schema parsing will happen in the async scrape() method using Puppeteer
    }

    // --- Override the main scrape method ---
    public async scrape(): Promise<ScrapedProduct> {
        console.log("[RalphLaurenScraper] Starting scrape method...");

        // 1. Attempt to parse schema JSON using Puppeteer
        this.schemaData = await this.parseSchemaWithPuppeteer();

        // 2. Extract data primarily from schema, using HTML fallbacks
        const name = this.getName();
        const priceInfo = this.getPrice();
        const sizes = this.getSizes(); // Tries schema first, then HTML
        const colors = this.getColors(); // Tries schema first, then HTML
        const images = this.getImages(); // Tries schema first, then HTML
        const description = this.getDescription();
        const inStock = this.getInStock(); // Tries schema first

        return {
            name: name || "Untitled Product",
            priceInfo: priceInfo,
            availableSizes: sizes,
            availableColors: colors,
            images: images,
            inStock: inStock,
            description: description,
        };
    }

    // Helper to parse schema using Puppeteer
    private async parseSchemaWithPuppeteer(): Promise<any | null> {
        console.log(
            "[RalphLaurenScraper] Attempting to parse schema with Puppeteer...",
        );
        try {
            // Your analysis: div#pdp-schema-objects[schema-productgroup]
            const schemaAttributeContent = await this.page.$eval(
                "div#pdp-schema-objects",
                (div) => div.getAttribute("schema-productgroup"),
            );

            if (schemaAttributeContent) {
                console.log(
                    "[RalphLaurenScraper] Found schema-productgroup attribute.",
                );
                // Use json5 for robustness
                const data = json5.parse(schemaAttributeContent);
                // The structure might be nested, find the actual Product group
                // Inspect the JSON structure on a real page to confirm the path
                console.log(
                    "[RalphLaurenScraper] Successfully parsed schema JSON.",
                );
                return data?.productGroup || data; // Adjust based on actual structure
            }
        } catch (e: any) {
            console.warn(
                `[RalphLaurenScraper] Error parsing schema JSON via Puppeteer: ${e.message}`,
            );
        }
        console.log(
            "[RalphLaurenScraper] Schema JSON not found or failed to parse via Puppeteer.",
        );
        return null;
    }

    // --- Implement base methods: Schema first, HTML fallback ---

    getName(): string | null {
        // Try schema
        if (this.schemaData?.name) return this.schemaData.name;
        // HTML Fallback (Your analysis: h1.product-name)
        return this.getText("h1.product-name") || null;
    }

    getPrice(): PriceInfo | null {
        // Try schema (Your analysis: offers.price)
        try {
            if (this.schemaData?.offers) {
                const offer = Array.isArray(this.schemaData.offers)
                    ? this.schemaData.offers[0]
                    : this.schemaData.offers;
                if (offer?.price && offer?.priceCurrency) {
                    const price = parseFloat(offer.price);
                    if (!isNaN(price)) {
                        // Determine currency code from symbol if needed
                        let currencyCode = offer.priceCurrency;
                        if (currencyCode.length === 1) {
                            // If it's just a symbol
                            const map: { [key: string]: string } = {
                                $: "USD",
                                "£": "GBP",
                                "€": "EUR",
                            };
                            currencyCode = map[currencyCode] || "USD";
                        }
                        return {
                            price: Math.round(price * 100),
                            currency: currencyCode,
                        };
                    }
                }
            }
        } catch (e: any) {
            console.warn(
                `[RalphLaurenScraper] Error reading price from schema: ${e.message}`,
            );
        }

        // HTML Fallback (Your analysis: span.price-sales)
        const priceText = this.getText("span.price-sales");
        return this.parsePriceString(priceText);
    }

    getSizes(): SizeInfo[] {
        // Try schema (Your analysis: hasVariant array)
        if (this.schemaData?.hasVariant) {
            try {
                const sizeSet = new Set<string>();
                this.schemaData.hasVariant.forEach((variant: any) => {
                    // Size might be under 'size', 'name', 'sku', 'additionalProperty', etc. Inspect the JSON!
                    const sizeAttribute = variant.additionalProperty?.find(
                        (p: any) => p.name === "size",
                    );
                    if (sizeAttribute?.value) sizeSet.add(sizeAttribute.value);
                    else if (variant.size) sizeSet.add(variant.size);
                    // Add more potential size properties based on JSON structure
                });
                if (sizeSet.size > 0) {
                    // Note: Schema often doesn't have live stock per size easily accessible
                    // Assume in stock unless availability says otherwise globally
                    const globalInStock =
                        this.schemaData?.offers?.availability?.includes(
                            "InStock",
                        ) ?? true;
                    return Array.from(sizeSet).map((name) => ({
                        name,
                        inStock: globalInStock,
                    }));
                }
            } catch (e: any) {
                console.warn(
                    `[RalphLaurenScraper] Error reading sizes from schema variants: ${e.message}`,
                );
            }
        }

        // HTML Fallback (Your analysis: ul.size-swatches li.variations-attribute)
        const sizes: SizeInfo[] = [];
        this.$("ul.size-swatches li.variations-attribute").each((i, el) => {
            const element = this.$(el);
            // Get text from bdi tag (Your analysis)
            const name = element.find("bdi").text().trim();
            // Check div.nis-tooltip for unavailable (Your analysis), or input disabled/class 'unavailable'
            const inStock =
                element.find("div.nis-tooltip").length === 0 &&
                !element.hasClass("unavailable") &&
                !element.find("input").prop("disabled");
            if (name) {
                sizes.push({ name, inStock });
            }
        });
        return sizes;
    }

    getColors(): ColorInfo[] {
        // Try schema (Your analysis: hasVariant array)
        if (this.schemaData?.hasVariant) {
            try {
                const colorMap = new Map<string, ColorInfo>();
                this.schemaData.hasVariant.forEach((variant: any) => {
                    // Color might be under 'color', 'name', 'additionalProperty', etc. Inspect the JSON!
                    const colorAttribute = variant.additionalProperty?.find(
                        (p: any) => p.name === "color",
                    );
                    let name: string | undefined = undefined;
                    if (colorAttribute?.value) name = colorAttribute.value;
                    else if (variant.color) name = variant.color;
                    // Add more potential color properties based on JSON structure

                    if (name && !colorMap.has(name)) {
                        // Schema might have swatch image URL somewhere? e.g., variant.image
                        let swatchUrl = variant.image; // Guessing, inspect JSON! Could be nested.
                        if (typeof swatchUrl === "object" && swatchUrl?.url)
                            swatchUrl = swatchUrl.url; // Handle nested image objects
                        colorMap.set(name, {
                            name,
                            swatchUrl: this.resolveUrl(swatchUrl),
                        });
                    }
                });
                if (colorMap.size > 0) {
                    return Array.from(colorMap.values());
                }
            } catch (e: any) {
                console.warn(
                    `[RalphLaurenScraper] Error reading colors from schema variants: ${e.message}`,
                );
            }
        }

        // HTML Fallback (Your analysis: ul.color-swatches li.variations-attribute)
        const colors: ColorInfo[] = [];
        this.$("ul.color-swatches li.variations-attribute").each((i, el) => {
            const element = this.$(el);
            const swatchLink = element.find("a.swatch");
            // Get data-color (Your analysis) or title
            const name =
                swatchLink.attr("data-color") || swatchLink.attr("title") || "";
            const swatchUrl = swatchLink.find("img").attr("src");
            // Check li.selected for current selection (Your analysis) - not needed for listing all
            if (name.trim()) {
                colors.push({
                    name: name.trim(),
                    swatchUrl: this.resolveUrl(swatchUrl),
                });
            }
        });
        return colors;
    }

    getImages(): string[] {
        // Try schema (Your analysis: image array)
        if (this.schemaData?.image) {
            const schemaImages = Array.isArray(this.schemaData.image)
                ? this.schemaData.image
                : [this.schemaData.image];
            if (schemaImages.length > 0) {
                // Images might be objects with 'url' or just strings
                return schemaImages
                    .map((img) =>
                        this.resolveUrl(
                            typeof img === "string" ? img : img?.url,
                        ),
                    )
                    .filter(Boolean) as string[];
            }
        }

        // HTML Fallback (Your analysis: div.swiper-wrapper img/source data-img/srcset)
        const images: string[] = [];
        this.$(
            "div.pdp-media-container div.swiper-wrapper div.swiper-slide",
        ).each((i, el) => {
            const element = this.$(el);
            const img = element.find("img");
            const source = element.find("source");
            // Prioritize data-img, then srcset, then src
            let src = img.attr("data-img") || source.attr("data-img");
            if (!src) {
                const srcset =
                    img.attr("srcset") ||
                    source.attr("srcset") ||
                    img.attr("data-srcset") ||
                    source.attr("data-srcset");
                if (srcset) {
                    const sources = srcset
                        .split(",")
                        .map((s) => s.trim().split(" ")[0]);
                    src = sources.pop() || sources[0]; // Get largest or first
                } else {
                    src = img.attr("src") || img.attr("data-src");
                }
            }
            if (src) images.push(src);
        });

        // Deduplicate and resolve
        return [...new Set(images)].map((src) => this.resolveUrl(src));
    }

    getInStock(): boolean {
        // Try schema availability
        try {
            if (this.schemaData?.offers?.availability) {
                return this.schemaData.offers.availability.includes("InStock");
            }
        } catch (e) {
            /* ignore */
        }

        // Fallback: Check if any sizes are in stock from HTML scrape
        const sizes = this.getSizes(); // Note: this uses HTML fallback if schema failed
        if (sizes.length > 0) {
            return sizes.some((s) => s.inStock);
        }
        // Fallback: Look for Add to Bag button
        return this.$('button[data-zta="addtobagCTA"]').length > 0;
    }

    getDescription(): string | null {
        // Try schema
        if (this.schemaData?.description) return this.schemaData.description;
        // HTML Fallback (Try meta tags first)
        let description =
            this.getAttr('meta[property="og:description"]', "content") ||
            this.getAttr('meta[name="description"]', "content");
        if (description) return description;
        // Fallback: Look for description section (inspect page for selector)
        description = this.$(".pdp-description-content").text().trim(); // Example selector
        return description || null;
    }
}
