// server/scrapers/coachoutlet_scraper.ts
import { BaseScraper, PriceInfo, SizeInfo, ColorInfo } from "./base_scraper";
import json5 from "json5"; // For parsing data-lgimg JSON

export class CoachOutletScraper extends BaseScraper {
    getName(): string | null {
        // Your analysis: h1[data-qa="pdp_txt_pdt_title"]
        return this.getText('h1[data-qa="pdp_txt_pdt_title"]') || null;
    }

    getPrice(): PriceInfo | null {
        // Your analysis: p[data-qa="cm_txt_pdt_price"]
        const priceText = this.getText('p[data-qa="cm_txt_pdt_price"]');
        // Consider also p[data-qa="txt_comparable_value_price"] if needed
        return this.parsePriceString(priceText);
    }

    getSizes(): SizeInfo[] {
        // Your analysis: div.product-size-controls button.variation-size
        const sizes: SizeInfo[] = [];
        this.$(
            "div.product-size-controls div.controls-btn-wrapper button.variation-size",
        ).each((i, el) => {
            const element = this.$(el);
            const name = element.text().trim();
            // Check aria-disabled="true" (Your analysis)
            const inStock = element.attr("aria-disabled") !== "true";
            if (name) {
                sizes.push({ name, inStock });
            }
        });
        return sizes;
    }

    getColors(): ColorInfo[] {
        // Your analysis: div.color-images-swatches button.variant-image-swatch
        const colors: ColorInfo[] = [];
        this.$("div.color-images-swatches button.variant-image-swatch").each(
            (i, el) => {
                const element = this.$(el);
                const name = element.attr("title")?.trim(); // Name from title attribute
                const swatchUrl = element.find("img").attr("src"); // Swatch from img src
                // Check for activeColorSwatch class for selected (Your analysis) - not needed for listing all
                if (name) {
                    colors.push({
                        name,
                        swatchUrl: this.resolveUrl(swatchUrl),
                    });
                }
            },
        );
        return colors;
    }

    getImages(): string[] {
        // Your analysis: Modify thumbnail URL OR parse data-lgimg JSON
        const images: string[] = [];

        // Attempt 1: Parse data-lgimg JSON from thumbnails
        this.$("ul.splide__list li > div > img[data-lgimg]").each((i, el) => {
            const lgimgData = this.$(el).attr("data-lgimg");
            if (lgimgData) {
                try {
                    // Example data-lgimg: {"src":"//images.coach.com/.../$desktopProduct$","alt":...}
                    const imgObj = json5.parse(lgimgData);
                    if (imgObj.src) images.push(imgObj.src);
                } catch (e: any) {
                    console.warn(
                        `[CoachOutletScraper] Failed to parse data-lgimg JSON: ${e.message}`,
                    );
                }
            }
        });

        // Attempt 2: Modify thumbnail URL if JSON parsing failed or wasn't present
        if (images.length === 0) {
            this.$("ul.splide__list li > div > img[src]").each((i, el) => {
                const thumbSrc = this.$(el).attr("src");
                // Your analysis: Replace $desktopThumbnail$ -> $desktopProduct$
                if (thumbSrc && thumbSrc.includes("$desktopThumbnail$")) {
                    const mainSrc = thumbSrc.replace(
                        "$desktopThumbnail$",
                        "$desktopProduct$",
                    );
                    images.push(mainSrc);
                } else if (thumbSrc) {
                    images.push(thumbSrc); // Add thumbnail as fallback if pattern doesn't match
                }
            });
        }

        return [...new Set(images)].map((src) => this.resolveUrl(src)); // Deduplicate and resolve
    }

    getInStock(): boolean {
        // Check if any size is in stock, or if size selector doesn't exist (implying one size and check add to cart)
        const sizes = this.getSizes();
        if (sizes.length > 0) {
            return sizes.some((s) => s.inStock);
        }
        // Fallback: Check for an enabled "Add To Bag" button if no sizes listed
        return (
            this.$('button[data-qa="btn_add_to_bag"]:not(:disabled)').length > 0
        );
    }

    getDescription(): string | null {
        // Try meta tags first
        let description =
            this.getAttr('meta[property="og:description"]', "content") ||
            this.getAttr('meta[name="description"]', "content");
        if (description) return description;

        // Fallback: Look for a product description section
        // Inspect Coach Outlet page to find the selector for the main description text/HTML
        // Example (likely needs adjustment):
        description = this.$("div.product-description-content").text().trim();
        return description || null;
    }
}
