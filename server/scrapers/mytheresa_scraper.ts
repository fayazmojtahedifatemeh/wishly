// server/scrapers/mytheresa_scraper.ts
import { BaseScraper, PriceInfo, SizeInfo, ColorInfo } from "./base_scraper";

export class MytheresaScraper extends BaseScraper {
  getName(): string | null {
    // Your analysis: div.product__area__branding__designer a + div.product__area__branding__name
    const brand = this.getText("div.product__area__branding__designer a");
    const name = this.getText("div.product__area__branding__name");
    return brand && name ? `${brand} - ${name}` : brand || name || null;
  }

  getPrice(): PriceInfo | null {
    // Your analysis: span.pricing__prices__price (e.g., "£ 1,290")
    const priceText = this.getText("span.pricing__prices__price");
    return this.parsePriceString(priceText); // Use helper from BaseScraper
  }

  getSizes(): SizeInfo[] {
    // Your analysis: div.dropdown__options__wrapper div.sizeitem:not(.sizeitem--placeholder)
    const sizes: SizeInfo[] = [];
    this.$(
      "div.dropdown__options__wrapper div.sizeitem:not(.sizeitem--placeholder)",
    ).each((i, el) => {
      const element = this.$(el);
      const name = element.find("span.sizeitem__label").text().trim();
      // Check for 'sizeitem--notavailable' class for stock status
      const inStock = !element.hasClass("sizeitem--notavailable");
      if (name) {
        sizes.push({ name, inStock });
      }
    });
    return sizes;
  }

  getColors(): ColorInfo[] {
    // Your analysis: Not in snippet, maybe in details accordion
    // Attempt to get the single listed color from details
    const colorName = this.$(
      '.product-details[data-label="Product details"] .product-details__content li',
    )
      .filter((i, el) => this.$(el).text().includes("Designer color name:"))
      .text()
      .replace("Designer color name:", "")
      .trim();

    // If we found a color name, return it structured
    return colorName ? [{ name: colorName, swatchUrl: undefined }] : [];
  }

  getImages(): string[] {
    // Your analysis: div.product__gallery__carousel .swiper-wrapper .swiper-slide:not(.swiper-slide-duplicate) img[src]
    const images: string[] = [];
    this.$(
      "div.product__gallery__carousel .swiper-wrapper .swiper-slide:not(.swiper-slide-duplicate) img",
    ).each((i, el) => {
      const src = this.$(el).attr("src");
      if (src) images.push(src);
    });
    return images;
  }

  getInStock(): boolean {
    // Check if there is at least one size available
    const sizes = this.getSizes();
    return sizes.length > 0 && sizes.some((s) => s.inStock);
    // You could add another check, e.g., if an "Add to Cart" button exists
  }

  getDescription(): string | null {
    // Try standard meta tags first
    let description =
      this.getAttr('meta[property="og:description"]', "content") ||
      this.getAttr('meta[name="description"]', "content");
    if (description) return description;

    // Fallback: Look within product details accordion if meta tags fail
    description = this.$(
      '.product-details[data-label="Product details"] .product-details__content',
    )
      .text()
      .trim();
    return description || null;
  }
}
