// server/scrapers/etsy_scraper.ts
import { BaseScraper, PriceInfo, SizeInfo, ColorInfo } from "./base_scraper";

export class EtsyScraper extends BaseScraper {
    getName(): string | null {
        // Your analysis: h1[data-buy-box-listing-title="true"]
        return this.getText('h1[data-buy-box-listing-title="true"]') || null;
    }

    getPrice(): PriceInfo | null {
        // Your analysis: div[data-selector="price-only"] p.wt-text-title-larger
        // Note: This might only get the current price, ignoring variations.
        const priceText = this.getText(
            'div[data-selector="price-only"] p.wt-text-title-larger',
        );
        // Original price: span.wt-text-strikethrough

        // Currency often needs separate extraction on Etsy, check meta tags or around price
        let currencySymbol = priceText.match(/[$£€¥₽]/)?.[0] || "$"; // Basic symbol check
        const currencyMeta =
            this.getAttr('meta[property="og:price:currency"]', "content") ||
            this.getAttr('meta[property="product:price:currency"]', "content");

        // Attempt to parse using the base helper
        const parsed = this.parsePriceString(priceText);
        if (parsed) {
            if (currencyMeta) parsed.currency = currencyMeta; // Prefer meta tag currency
            return parsed;
        }
        // Fallback if base helper fails
        const priceMatch = priceText.replace(/[^\d.,]/g, "").match(/([\d,.]+)/);
        const price = priceMatch
            ? parseFloat(priceMatch[1].replace(",", "."))
            : NaN; // Handle comma as decimal separator
        if (!isNaN(price)) {
            return {
                price: Math.round(price * 100),
                currency: currencyMeta || "USD",
            }; // Use meta currency or default
        }

        return null;
    }

    // --- Variations (Sizes/Colors) ---
    // Etsy variations are complex and often require selection to see price/stock.
    // This static approach reads options from <select> dropdowns found.
    private getVariations(): { type: string; options: SizeInfo[] }[] {
        const variations: { type: string; options: SizeInfo[] }[] = [];
        // Your analysis: div[data-selector="listing-page-variation"]
        this.$('div[data-selector="listing-page-variation"]').each((i, el) => {
            const variationElement = this.$(el);
            // Get variation type (e.g., "Size", "Color") from label span[data-label]
            const variationType = variationElement
                .find("label span[data-label]")
                .text()
                .trim();
            const selectElement = variationElement.find("select");
            const options: SizeInfo[] = [];

            if (selectElement.length > 0 && variationType) {
                selectElement.find("option").each((idx, optEl) => {
                    const option = this.$(optEl);
                    const value = option.attr("value");
                    const text = option.text().trim();

                    // Skip placeholder options like "Select an option"
                    if (
                        value &&
                        value !== "" &&
                        value !== "0" &&
                        !text.toLowerCase().includes("select")
                    ) {
                        // Extract name and potentially price difference
                        const name = text.split("(")[0].trim(); // Get text before price adjustment like "(+ $2.00)"
                        // Availability: Assume in stock unless option is disabled or text indicates otherwise
                        const inStock =
                            !option.prop("disabled") &&
                            !text.toLowerCase().includes("sold out") &&
                            !text.toLowerCase().includes("unavailable");
                        if (name) {
                            options.push({ name, inStock });
                        }
                    }
                });
                if (options.length > 0) {
                    variations.push({ type: variationType, options });
                }
            }
        });
        return variations;
    }

    getSizes(): SizeInfo[] {
        const variations = this.getVariations();
        // Find variation likely related to size
        const sizeVariation = variations.find(
            (v) =>
                v.type.toLowerCase().includes("size") ||
                v.type.toLowerCase().includes("dimension"),
        );
        return sizeVariation ? sizeVariation.options : [];
    }

    getColors(): ColorInfo[] {
        // Your analysis: Often part of "Personalization" - difficult to scrape statically.
        // Try finding a variation dropdown for color.
        const variations = this.getVariations();
        const colorVariation = variations.find(
            (v) =>
                v.type.toLowerCase().includes("color") ||
                v.type.toLowerCase().includes("colour") ||
                v.type.toLowerCase().includes("style"),
        );
        // Convert SizeInfo structure to ColorInfo (no swatch available here)
        return colorVariation
            ? colorVariation.options.map((opt) => ({
                  name: opt.name,
                  swatchUrl: undefined,
              }))
            : [];

        // TODO: Could also parse div[data-instructions-container] text if needed for personalization details.
    }

    getImages(): string[] {
        // Your analysis: ul[data-carousel-pane-list] li[data-carousel-pane] img
        const images: string[] = [];
        this.$("ul[data-carousel-pane-list] li[data-carousel-pane] img").each(
            (i, el) => {
                const img = this.$(el);
                // Prioritize srcset for higher resolution (Your analysis)
                const srcset = img.attr("srcset");
                let src = img.attr("src"); // Fallback
                if (srcset) {
                    // Get the last URL from srcset (usually highest res)
                    const sources = srcset
                        .split(",")
                        .map((s) => s.trim().split(" ")[0]);
                    src = sources.pop() || src;
                }
                if (src && !images.includes(src)) {
                    // Avoid duplicates
                    images.push(src);
                }
            },
        );
        return images.map((src) => this.resolveUrl(src));
    }

    getInStock(): boolean {
        // Check if variations exist and if any are in stock
        const variations = this.getVariations();
        if (variations.length > 0) {
            return variations.some((v) => v.options.some((opt) => opt.inStock));
        }
        // Fallback: Check for general out-of-stock messages or add-to-cart button absence
        const oosMessage =
            this.$('div[data-appears-component-name*="unavailable"]').length >
                0 ||
            this.$('p:contains("Sorry, this item is unavailable.")').length > 0;
        const cartButton = this.$("button[data-add-to-cart-button]").length > 0;
        return cartButton && !oosMessage;
    }

    getDescription(): string | null {
        // Try meta tags first
        let description =
            this.getAttr('meta[property="og:description"]', "content") ||
            this.getAttr('meta[name="description"]', "content");
        if (description) return description;

        // Fallback: Look for description section, often with an ID like 'listing-page-description'
        description = this.$("#listing-page-description p")
            .first()
            .text()
            .trim(); // Get first paragraph
        // Could also try div[data-id="description-text"]
        return description || null;
    }
}
