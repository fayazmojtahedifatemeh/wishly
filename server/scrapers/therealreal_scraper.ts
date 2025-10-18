// server/scrapers/therealreal_scraper.ts
import { BaseScraper, PriceInfo, SizeInfo, ColorInfo } from "./base_scraper";

export class TheRealRealScraper extends BaseScraper {
  getName(): string | null {
    // Your analysis: div.brand > a + div.product-name
    const brand = this.getText("div.brand > a");
    const productName = this.getText("div.product-name");
    if (brand && productName) return `${brand} - ${productName}`;
    return productName || brand || null;
  }

  getPrice(): PriceInfo | null {
    // Your analysis: div.product-price-info__reduced-price
    let priceText = this.getText("div.product-price-info__reduced-price");
    if (!priceText) {
      // Fallback if not reduced (check for a standard price class)
      priceText = this.getText("div.product-price-info__price"); // Example fallback selector
    }
    // Original price: div.product-price-info__strike-through-price
    return this.parsePriceString(priceText);
  }

  getSizes(): SizeInfo[] {
    // Your analysis: Descriptive only - div.pdp-title__size
    const sizeText = this.getText("div.pdp-title__size");
    // Since it's descriptive and only one, assume in stock if product is purchasable
    // A better check is needed for actual stock status
    return sizeText ? [{ name: sizeText, inStock: true }] : [];
  }

  getColors(): ColorInfo[] {
    // Your analysis: Descriptive only - dd#pdp-details-Description ul > li containing "Color:"
    let colorName: string | undefined;
    this.$("dd#pdp-details-Description ul > li").each((i, el) => {
      const text = this.$(el).text().trim();
      if (text.toLowerCase().startsWith("color:")) {
        colorName = text.replace(/color:/i, "").trim();
        return false; // Stop searching once found
      }
    });
    return colorName ? [{ name: colorName, swatchUrl: undefined }] : [];
  }

  getImages(): string[] {
    // Your analysis: div.main-image figure.image img[data-zoom]
    const images: string[] = [];
    this.$("div.main-image figure.image img[data-zoom]").each((i, el) => {
      const zoomUrl = this.$(el).attr("data-zoom");
      if (zoomUrl) images.push(zoomUrl);
    });
    // Fallback if data-zoom isn't present
    if (images.length === 0) {
      this.$("div.main-image figure.image img[src]").each((i, el) => {
        const src = this.$(el).attr("src");
        if (src) images.push(src);
      });
    }
    return images.map((src) => this.resolveUrl(src));
  }

  getInStock(): boolean {
    // Check for "Add to Bag" button vs "Sold" or unavailable messages
    const soldLabel = this.$("div.pdp-title__sold-label").length > 0;
    const addToBagButton =
      this.$('button[data-event-action="add to bag"]').length > 0; // Check specific button

    return addToBagButton && !soldLabel;
  }

  getDescription(): string | null {
    // Try the specific description element first
    let description = this.$("dd#pdp-details-Description").text().trim();
    if (description) return description;

    // Fallback to meta tags
    description =
      this.getAttr('meta[property="og:description"]', "content") ||
      this.getAttr('meta[name="description"]', "content");
    return description || null;
  }
}
