// server/scrapers/charles_tyrhitt_scraper.ts
import { BaseScraper, PriceInfo, SizeInfo, ColorInfo } from "./base_scraper";
import json5 from "json5"; // For parsing data-lgimg JSON

export class CharlesTyrhittScraper extends BaseScraper {
    getName(): string | null {
        // Your analysis: h1.product-name
        return this.getText("h1.product-name") || null;
    }

    getPrice(): PriceInfo | null {
        // Your analysis: span.js-thumb-now-price span[aria-hidden="true"]
        const priceText = this.getText(
            'span.js-thumb-now-price span[aria-hidden="true"]',
        );
        // Note also span.js-thumb-was-price for original price
        return this.parsePriceString(priceText);
    }

    getSizes(): SizeInfo[] {
        // Your analysis: ul[data-variation-attr-id="jacketSize"] (or similar) li.js-attribute-swatch
        const sizes: SizeInfo[] = [];
        // Try common variation IDs, jacketSize, collarSize, shoeSize etc.
        const sizeContainer = this.$(
            'ul[data-variation-attr-id*="Size"]',
        ).first();

        if (sizeContainer.length > 0) {
            sizeContainer.find("li.js-attribute-swatch").each((i, el) => {
                const element = this.$(el);
                // Get text from div.swatchanchor (Your analysis)
                const name = element.find("div.swatchanchor").text().trim();
                // Check li class for attribute__swatch--available (Your analysis)
                const inStock = element.hasClass(
                    "attribute__swatch--available",
                );
                if (name) {
                    sizes.push({ name, inStock });
                }
            });
        } else {
            console.log(
                "[CharlesTyrhittScraper] Size container not found using standard selectors.",
            );
            // Add fallbacks if necessary, e.g., for dropdowns
        }
        return sizes;
    }

    getColors(): ColorInfo[] {
        // Your analysis: div.colour-swatching a.js-pdpcolourswatch
        const colors: ColorInfo[] = [];
        this.$("div.colour-swatching a.js-pdpcolourswatch").each((i, el) => {
            const element = this.$(el);
            const img = element.find("img");
            // Get data-colour or alt (Your analysis)
            const name = element.attr("data-colour") || img.attr("alt") || "";
            const swatchUrl = img.attr("src");
            // Check for img.colourSwitch--selected for currently selected
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
        // Your analysis: Parse data-lgimg JSON from thumbnails
        const images: string[] = [];
        // Target ul.slick-track with button.pdpimage__item > li > div > button > img
        this.$("ul.slick-track button.pdpimage__item")
            .closest("li")
            .find("img[data-lgimg]")
            .each((i, el) => {
                const lgimgData = this.$(el).attr("data-lgimg");
                if (lgimgData) {
                    try {
                        // Example: {"url":"//www.charlestyrwhitt.com/.../image.jpg","alt":...}
                        const imgObj = json5.parse(lgimgData);
                        if (imgObj.url) images.push(imgObj.url);
                    } catch (e: any) {
                        console.warn(
                            `[CharlesTyrhittScraper] Failed to parse data-lgimg JSON: ${e.message}`,
                        );
                        // Fallback: try getting src/data-src if JSON fails
                        const fallbackSrc =
                            this.$(el).attr("src") ||
                            this.$(el).attr("data-src");
                        if (fallbackSrc) images.push(fallbackSrc);
                    }
                } else {
                    // Fallback if no data-lgimg: try getting src/data-src directly
                    const fallbackSrc =
                        this.$(el).attr("src") || this.$(el).attr("data-src");
                    if (fallbackSrc) images.push(fallbackSrc);
                }
            });

        // Deduplicate and resolve URLs (ensure https: is prepended if needed)
        return [...new Set(images)].map((src) => this.resolveUrl(src));
    }

    getInStock(): boolean {
        // Check if any sizes are available
        const sizes = this.getSizes();
        if (sizes.length > 0) {
            return sizes.some((s) => s.inStock);
        }
        // Fallback: Check for general stock message or Add to Bag button
        const oosMessage = this.$(".out-of-stock-msg").length > 0;
        const cartButton = this.$("button#add-to-cart").length > 0; // Check specific button ID/class
        return cartButton && !oosMessage;
    }

    getDescription(): string | null {
        // Try meta tags first
        let description =
            this.getAttr('meta[property="og:description"]', "content") ||
            this.getAttr('meta[name="description"]', "content");
        if (description) return description;

        // Fallback: Look for product description section (inspect page for specific selector)
        description = this.$("div.product-description").first().text().trim();
        return description || null;
    }
}
