// server/scrapers/the_fold_scraper.ts
import { BaseScraper, PriceInfo, SizeInfo, ColorInfo } from "./base_scraper";

export class TheFoldScraper extends BaseScraper {
    // Assuming BigCommerce structure

    getName(): string | null {
        // Your analysis: h1.productView-title
        return this.getText("h1.productView-title") || null;
    }

    getPrice(): PriceInfo | null {
        // Your analysis: span[data-product-price-with-tax]
        // BigCommerce often embeds price data in other elements too
        let priceText = this.getText("span[data-product-price-with-tax]");
        if (!priceText) {
            // Fallback for non-sale price
            priceText = this.getText(".price--non-sale");
        }
        if (!priceText) {
            // Fallback for sale price
            priceText = this.getText(".price--main .price");
        }
        return this.parsePriceString(priceText);
    }

    getSizes(): SizeInfo[] {
        // Your analysis: div[data-product-attribute="set-rectangle"] div.form-option-wrapper
        const sizes: SizeInfo[] = [];
        // Target divs for size attributes, often 'set-rectangle' for swatches
        this.$('div[data-product-attribute="set-rectangle"]')
            .filter((i, el) => {
                // Filter further if needed, e.g., based on label text containing 'Size'
                return this.$(el)
                    .find(".form-field-title")
                    .text()
                    .toLowerCase()
                    .includes("size");
            })
            .find("div.form-option-wrapper")
            .each((i, el) => {
                const element = this.$(el);
                // Get text from span.form-option-variant (Your analysis)
                const name = element
                    .find("span.form-option-variant")
                    .text()
                    .trim();
                // Check label class for unavailable (Your analysis) - Or input disabled state
                const inStock =
                    !element.find("label").hasClass("unavailable") &&
                    !element.find("input").prop("disabled");
                if (name) {
                    sizes.push({ name, inStock });
                }
            });

        // Handle dropdowns if present (common BigCommerce fallback)
        if (sizes.length === 0) {
            this.$('select[id*="attribute_select"]')
                .filter((i, el) => {
                    return this.$(el)
                        .parent()
                        .find("label")
                        .text()
                        .toLowerCase()
                        .includes("size");
                })
                .find("option")
                .each((i, el) => {
                    const option = this.$(el);
                    const name = option.text().trim();
                    const value = option.attr("value");
                    // Skip placeholders like "Choose Options"
                    if (
                        value &&
                        value !== "" &&
                        !name.toLowerCase().includes("choose")
                    ) {
                        // Availability might be in text like " (Out of stock)"
                        const inStock = !name
                            .toLowerCase()
                            .includes("out of stock");
                        sizes.push({
                            name: name.replace(/\s*\(.*\)\s*$/, ""),
                            inStock,
                        }); // Remove stock text from name
                    }
                });
        }

        return sizes;
    }

    getColors(): ColorInfo[] {
        // Your analysis: div.color-products-section > ul li.color-product
        const colors: ColorInfo[] = [];
        this.$("div.color-products-section > ul li.color-product").each(
            (i, el) => {
                const element = this.$(el);
                // Get data-product-name (Your analysis)
                const name = element.attr("data-product-name")?.trim();
                const swatchImg = element.find("img");
                const swatchUrl =
                    swatchImg.attr("src") || swatchImg.attr("data-src");
                // Check li class active for selected (Your analysis) - not needed for listing all
                if (name) {
                    colors.push({
                        name,
                        swatchUrl: this.resolveUrl(swatchUrl),
                    });
                }
            },
        );

        // Fallback for simple color swatches (set-rectangle or set-radio)
        if (colors.length === 0) {
            this.$(
                'div[data-product-attribute="set-rectangle"], div[data-product-attribute="set-radio"]',
            )
                .filter((i, el) => {
                    return (
                        this.$(el)
                            .find(".form-field-title")
                            .text()
                            .toLowerCase()
                            .includes("color") ||
                        this.$(el)
                            .find(".form-field-title")
                            .text()
                            .toLowerCase()
                            .includes("colour")
                    );
                })
                .find("label.form-option")
                .each((i, el) => {
                    const element = this.$(el);
                    const name =
                        element
                            .find("span.form-option-variant")
                            .attr("title")
                            ?.trim() ||
                        element.find("span.form-option-variant").text().trim();
                    const swatchStyle = element
                        .find('[style*="background"]')
                        .attr("style"); // Check for background color/image
                    let swatchUrl: string | undefined = undefined;
                    if (swatchStyle?.includes("background-image")) {
                        swatchUrl = swatchStyle.match(
                            /url\(['"]?(.*?)['"]?\)/,
                        )?.[1];
                    }
                    if (name) {
                        colors.push({
                            name,
                            swatchUrl: this.resolveUrl(swatchUrl),
                        });
                    }
                });
        }

        return colors;
    }

    getImages(): string[] {
        // Your analysis: div.slick-track inside div.productView-img-container div.productView-img img[data-srcset]
        const images: string[] = [];
        this.$(
            "div.productView-img-container div.slick-track div.productView-img img",
        ).each((i, el) => {
            const img = this.$(el);
            // Parse data-srcset first (Your analysis)
            const srcset = img.attr("data-srcset");
            let src = img.attr("src") || img.attr("data-src"); // Fallback to src/data-src

            if (srcset) {
                // Get the largest URL from srcset (often the last one listed)
                const sources = srcset
                    .split(",")
                    .map((s) => s.trim().split(" ")[0]);
                src = sources.pop() || src; // Use largest from srcset, fallback to src
            }
            if (src) images.push(src);
        });

        // Deduplicate and resolve URLs
        return [...new Set(images)].map((src) => this.resolveUrl(src));
    }

    getInStock(): boolean {
        // Check schema.org availability first
        const availability = this.getAttr(
            'meta[itemprop="availability"]',
            "content",
        );
        if (availability) {
            return availability.toLowerCase().includes("instock");
        }
        // Check if any sizes are in stock
        const sizes = this.getSizes();
        if (sizes.length > 0) {
            return sizes.some((s) => s.inStock);
        }
        // Fallback: Look for "Add to Cart" button vs "Out of Stock" text
        const oosText =
            this.$(".productView-soldOut").length > 0 ||
            this.$('input[value*="Out of stock"]').length > 0;
        const cartButton = this.$("#form-action-addToCart").length > 0;
        return cartButton && !oosText;
    }

    getDescription(): string | null {
        // Try meta tags first
        let description =
            this.getAttr('meta[property="og:description"]', "content") ||
            this.getAttr('meta[name="description"]', "content");
        if (description) return description;

        // Fallback: Look for description tabs/sections (common in BigCommerce)
        description = this.$("#tab-description").text().trim();
        return description || null;
    }
}
