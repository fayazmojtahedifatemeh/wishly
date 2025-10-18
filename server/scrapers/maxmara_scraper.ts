// server/scrapers/maxmara_scraper.ts
import { BaseScraper, PriceInfo, SizeInfo, ColorInfo } from "./base_scraper";

export class MaxMaraScraper extends BaseScraper {
  getName(): string | null {
    // Your analysis: span.product-labels__label.--uppercase + h1
    const brand = this.getText("span.product-labels__label.--uppercase");
    const productName = this.getText("div.pdp__info__header__name h1");
    if (brand && productName) return `${brand} - ${productName}`;
    return productName || brand || null;
  }

  getPrice(): PriceInfo | null {
    // Your analysis: span.prices__full
    const priceText = this.getText("span.prices__full");
    return this.parsePriceString(priceText);
  }

  getSizes(): SizeInfo[] {
    // Your analysis: div.pdp__info__header__sizes__selectors div...selector label
    const sizes: SizeInfo[] = [];
    this.$(
      "div.pdp__info__header__sizes__selectors div.pdp__info__header__sizes__selectors__selector",
    ).each((i, el) => {
      const element = this.$(el);
      const name = element.find("label").text().trim();
      // Check input for data-unavailable attribute (Your analysis)
      const inStock =
        element.find("input[data-unavailable]").length === 0 &&
        !element.find("input").prop("disabled");
      if (name) {
        sizes.push({ name, inStock });
      }
    });
    return sizes;
  }

  getColors(): ColorInfo[] {
    // Your analysis: div.pdp-colors__swatches a.pdp-colors__swatches__color
    const colors: ColorInfo[] = [];
    this.$("div.pdp-colors__swatches a.pdp-colors__swatches__color").each(
      (i, el) => {
        const element = this.$(el);
        const img = element.find("img");
        // Get alt from img (Your analysis)
        const name = img.attr("alt")?.trim();
        const swatchUrl = img.attr("src");
        // Check a tag class --selected (Your analysis) - not needed for listing all
        if (name) {
          colors.push({ name, swatchUrl: this.resolveUrl(swatchUrl) });
        }
      },
    );
    return colors;
  }

  getImages(): string[] {
    // Your analysis: div.pdp__images__wrapper div.slick-track div.slick-slide:not(.slick-cloned) img[data-lazy or data-src]
    const images: string[] = [];
    this.$(
      "div.pdp__images__wrapper div.slick-track div.slick-slide:not(.slick-cloned) img",
    ).each((i, el) => {
      const img = this.$(el);
      // Prioritize data-lazy, then data-src, then src
      const src =
        img.attr("data-lazy") || img.attr("data-src") || img.attr("src");
      if (src) images.push(src);
    });
    // Deduplicate and resolve
    return [...new Set(images)].map((src) => this.resolveUrl(src));
  }

  getInStock(): boolean {
    // Check if any sizes are in stock
    const sizes = this.getSizes();
    if (sizes.length > 0) {
      return sizes.some((s) => s.inStock);
    }
    // Fallback: Check for Add to Bag/Cart button vs unavailable message
    const unavailableMsg = this.$(".product-unavailable").length > 0; // Check for specific unavailable message class
    const cartButton = this.$("button.js-add-to-cart-btn").length > 0; // Check specific cart button class/id
    return cartButton && !unavailableMsg;
  }

  getDescription(): string | null {
    // Try meta tags first
    let description =
      this.getAttr('meta[property="og:description"]', "content") ||
      this.getAttr('meta[name="description"]', "content");
    if (description) return description;

    // Fallback: Look for description section (inspect page for selector)
    description = this.$("div.pdp__description").text().trim(); // Example selector
    return description || null;
  }
}
