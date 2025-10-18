// server/scrapers/yoox_scraper.ts
import { BaseScraper, PriceInfo, SizeInfo, ColorInfo } from "./base_scraper";

export class YooxScraper extends BaseScraper {
    getName(): string | null {
        // Your analysis: h1.ItemInfo_designer__XsNGI a + h2.ItemInfo_microcat__cTaMO a
        const brand = this.getText("h1.ItemInfo_designer__XsNGI a");
        const productName = this.getText("h2.ItemInfo_microcat__cTaMO a");
        if (brand && productName) return `${brand} - ${productName}`;
        return productName || brand || null;
    }

    getPrice(): PriceInfo | null {
        // Your analysis: div.ItemInfo_price___W18c div.price[data-ta="current-price"]
        // Example: "US$ 1.086" (Note: YOOX uses '.' as thousands separator sometimes)
        const priceText = this.getText(
            'div.ItemInfo_price___W18c div.price[data-ta="current-price"]',
        );
        // Original price: span[data-ta="retail-price"]
        // Discount: span.css-6pf3ri

        if (!priceText) return null;

        // Custom parsing for formats like "US$ 1.086"
        const currencySymbol =
            priceText.match(/[$£€¥₽]|US\$|AU\$|CA\$|HK\$/)?.[0] || "$";
        const currencyMap: { [key: string]: string } = {
            $: "USD",
            US$: "USD",
            "£": "GBP",
            "€": "EUR",
            "¥": "JPY",
            "₽": "RUB",
            AU$: "AUD",
            CA$: "CAD",
            HK$: "HKD",
        };
        const currency = currencyMap[currencySymbol] || "USD";

        // Remove symbol, whitespace, treat '.' as thousands separator, ',' as decimal
        const cleanedPrice = priceText
            .replace(/[$£€¥₽A-Z\s]/g, "")
            .replace(/\./g, "")
            .replace(",", ".");
        const price = parseFloat(cleanedPrice);

        if (isNaN(price)) {
            // Fallback using base parser if custom fails
            return this.parsePriceString(priceText);
        }

        return {
            price: Math.round(price * 100), // Convert to cents
            currency: currency,
        };
    }

    getSizes(): SizeInfo[] {
        // Your analysis: div[data-ta="size-picker"] div.SizePicker_size-item__nL4z_
        const sizes: SizeInfo[] = [];
        this.$(
            'div[data-ta="size-picker"] div.SizePicker_size-item__nL4z_',
        ).each((i, el) => {
            const element = this.$(el);
            // Size Name: span.SizePicker_size-title__LucnR
            const name = element
                .find("span.SizePicker_size-title__LucnR")
                .text()
                .trim();
            // Availability: Check for class SizePicker_disabled__ma4Lp
            const inStock = !element.hasClass("SizePicker_disabled__ma4Lp");
            if (name) {
                sizes.push({ name, inStock });
            }
        });
        return sizes;
    }

    getColors(): ColorInfo[] {
        // Your analysis: div.ColorPicker_color-picker__VS_Ec a.ColorPicker_color-elem__KV09t
        const colors: ColorInfo[] = [];
        this.$(
            "div.ColorPicker_color-picker__VS_Ec a.ColorPicker_color-elem__KV09t",
        ).each((i, el) => {
            const element = this.$(el);
            // Name: title attribute from inner div.ColorPicker_color-sample__yS_FM
            const name = element
                .find("div.ColorPicker_color-sample__yS_FM")
                .attr("title")
                ?.trim();
            // Swatch: Could potentially get background-color style if needed
            // Selected: Check for class ColorPicker_selected__Xvhg_
            if (name) {
                colors.push({ name, swatchUrl: undefined });
            }
        });
        return colors;
    }

    getImages(): string[] {
        // Your analysis: div.PicturesSlider_photoSlider__BUjaM div.react-swipeable-view-container img[src]
        const images: string[] = [];
        this.$(
            'div.PicturesSlider_photoSlider__BUjaM div[style*="overflow: hidden;"] > div > span > img',
        ).each((i, el) => {
            const src = this.$(el).attr("src");
            if (src) {
                // Basic check to remove potential placeholder/transparent images
                if (!src.includes("transparent")) {
                    images.push(src);
                }
            }
        });
        // Thumbnails: div.thumbnails_thumb__KgHTX img
        return [...new Set(images)].map((src) => this.resolveUrl(src)); // Deduplicate and resolve
    }

    getInStock(): boolean {
        // Check if any sizes are in stock
        const sizes = this.getSizes();
        if (sizes.length > 0) {
            return sizes.some((s) => s.inStock);
        }
        // Fallback: Check for 'Sold Out' message or presence of 'Add to Shopping Bag' button
        const soldOut = this.$('span:contains("Sold Out")').length > 0; // Check specific text/class
        const cartButton = this.$('div[data-test-id="addToCart"]').length > 0; // Check cart button selector

        return cartButton && !soldOut;
    }

    getDescription(): string | null {
        // Try meta tags first
        let description =
            this.getAttr('meta[property="og:description"]', "content") ||
            this.getAttr('meta[name="description"]', "content");
        if (description) return description;

        // Fallback: Look for description section, often under 'Details' or 'Composition'
        description = this.$('div[data-test-id="productDetailComposition"]')
            .text()
            .trim(); // Example
        if (!description) {
            description = this.$("div.ItemInfo_description__D_D3y")
                .text()
                .trim(); // Another potential selector
        }
        return description || null;
    }
}
