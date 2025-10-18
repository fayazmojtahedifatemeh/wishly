// server/scrapers/aym_scraper.ts
import { BaseScraper, PriceInfo, SizeInfo, ColorInfo } from "./base_scraper";
import json5 from "json5"; // Use json5 for parsing data attributes

export class AymScraper extends BaseScraper {
    // Assuming AYM uses Shopify

    private productJson: any | null = null;

    constructor(html: string, url: string, puppeteerPage: null = null) {
        super(html, url, puppeteerPage);
        this.productJson = this.extractProductJson();
    }

    // Helper to extract JSON data often embedded in Shopify themes
    private extractProductJson(): any | null {
        try {
            // Look for common Shopify JSON script types/ids
            const scriptSelector =
                'script[type="application/json"][data-product-json], script#ProductJson-product-template';
            const scriptTag = this.$(scriptSelector).first();
            if (scriptTag.length > 0) {
                const jsonData = json5.parse(scriptTag.html() || "{}");
                console.log(
                    "[AymScraper/Shopify] Successfully parsed embedded product JSON.",
                );
                return jsonData;
            }
        } catch (e: any) {
            console.warn(
                `[AymScraper/Shopify] Error parsing embedded product JSON: ${e.message}`,
            );
        }
        console.log("[AymScraper/Shopify] Embedded product JSON not found.");
        return null;
    }

    getName(): string | null {
        // Try JSON first
        if (this.productJson?.title) return this.productJson.title;
        // Fallback to h1.product-title (Your analysis)
        return this.getText("h1.product-title") || null;
    }

    getPrice(): PriceInfo | null {
        // Try JSON first (price is usually in cents)
        if (this.productJson?.price && this.productJson?.variants?.length > 0) {
            const currency =
                this.$('meta[property="og:price:currency"]').attr("content") ||
                "GBP"; // Get currency from meta tag, default GBP for AYM
            return {
                price: this.productJson.price, // Already in cents? Check the JSON output. If not, multiply by 100.
                currency: currency,
            };
        }
        // Fallback to <sale-price> (Your analysis) - needs parsing
        const priceText = this.getText("price-list sale-price"); // Adjust selector as needed
        return this.parsePriceString(priceText); // Use base helper
    }

    getSizes(): SizeInfo[] {
        // Try JSON first (variants often contain size and availability)
        if (this.productJson?.variants?.length > 0) {
            return this.productJson.variants.map((variant: any) => ({
                name: variant.option1 || variant.title, // Adjust based on JSON structure (option1, option2 etc.)
                inStock: variant.available || false,
            }));
        }

        // Fallback to fieldset label.block-swatch (Your analysis)
        const sizes: SizeInfo[] = [];
        this.$('fieldset legend:contains("Size:")')
            .parent()
            .find("label.block-swatch")
            .each((i, el) => {
                const element = this.$(el);
                const name = element.find("span").text().trim();
                // Check label class for is-disabled (Your analysis)
                const inStock = !element.hasClass("is-disabled");
                if (name) {
                    sizes.push({ name, inStock });
                }
            });
        return sizes;
    }

    getColors(): ColorInfo[] {
        // Try JSON first
        if (this.productJson?.options_with_values) {
            const colorOption = this.productJson.options_with_values.find(
                (opt: any) =>
                    opt.name?.toLowerCase() === "colour" ||
                    opt.name?.toLowerCase() === "color",
            );
            if (colorOption?.values) {
                return colorOption.values.map((val: any) => ({
                    name: typeof val === "string" ? val : val.title, // Handle different value structures
                    swatchUrl: undefined, // JSON usually doesn't have swatch URLs directly
                }));
            }
        }

        // Fallback to fieldset label.color-swatch (Your analysis)
        const colors: ColorInfo[] = [];
        this.$('fieldset legend:contains("Colour:")')
            .parent()
            .find("label.color-swatch")
            .each((i, el) => {
                const name = this.$(el).find("span").text().trim();
                // Extract swatch style if needed (background-image or color)
                // const swatchStyle = this.$(el).find('.swatch-element').attr('style');
                if (name) {
                    colors.push({ name, swatchUrl: undefined });
                }
            });
        return colors;
    }

    getImages(): string[] {
        // Try JSON first (often has a media array)
        if (this.productJson?.media?.length > 0) {
            return this.productJson.media
                .filter((m: any) => m.media_type === "image")
                .map((m: any) => this.resolveUrl(m.src))
                .filter(Boolean) as string[];
        }
        // Fallback to scroll-carousel img (Your analysis)
        const images: string[] = [];
        this.$("scroll-carousel div.product-gallery__media img").each(
            (i, el) => {
                // Parse srcset for best URL, fallback to src (Your analysis)
                const srcset = this.$(el).attr("srcset");
                let src = this.$(el).attr("src");
                if (srcset) {
                    const sources = srcset
                        .split(",")
                        .map((s) => s.trim().split(" ")[0]);
                    src = sources.pop() || src; // Get largest from srcset, fallback to src
                }
                if (src) images.push(src);
            },
        );
        return images.map((src) => this.resolveUrl(src));
    }

    getInStock(): boolean {
        // Try JSON first
        if (this.productJson?.available !== undefined)
            return this.productJson.available;
        if (this.productJson?.variants?.length > 0) {
            return this.productJson.variants.some((v: any) => v.available);
        }
        // Fallback: Check if any sizes are in stock from the HTML scrape
        return this.getSizes().some((s) => s.inStock);
    }

    getDescription(): string | null {
        // Try JSON first
        if (this.productJson?.description) {
            // Shopify description is HTML, strip tags for plain text
            return cheerio.load(this.productJson.description).text().trim();
        }
        // Fallback to meta tags
        return (
            this.getAttr('meta[property="og:description"]', "content") ||
            this.getAttr('meta[name="description"]', "content") ||
            null
        );
    }
}
