// server/scrapers/therealreal_scraper.ts
import { BaseScraper, PriceInfo, SizeInfo, ColorInfo } from "./base_scraper";

export class TheRealRealScraper extends BaseScraper {
  getName(): string | null {
    const name = this.getText("h1[data-test='productName']") || 
                 this.getText("h1.product-title") ||
                 this.getText("h1");
    return name;
  }

  getPrice(): PriceInfo | null {
    const priceText = this.getText("span[data-test='productPrice']") ||
                      this.getText("span.price") ||
                      this.getText("div.product-price");
    return this.parsePriceString(priceText);
  }

  getSizes(): SizeInfo[] {
    const sizes: SizeInfo[] = [];
    this.$("button[data-test='sizeButton'], .size-selector button").each((i, el) => {
      const element = this.$(el);
      const name = element.text().trim();
      const inStock = !element.hasClass("disabled") && !element.attr("disabled");
      if (name) {
        sizes.push({ name, inStock });
      }
    });
    return sizes;
  }

  getColors(): ColorInfo[] {
    const colors: ColorInfo[] = [];
    this.$("button[data-test='colorButton'], .color-selector button").each((i, el) => {
      const element = this.$(el);
      const name = element.attr("aria-label") || element.attr("title") || element.text().trim();
      const swatchUrl = element.find("img").attr("src");
      if (name) {
        colors.push({ name, swatchUrl });
      }
    });
    return colors;
  }

  getImages(): string[] {
    const images: string[] = [];
    this.$("img[data-test='productImage'], .product-gallery img, .product-images img").each((i, el) => {
      const src = this.$(el).attr("src") || this.$(el).attr("data-src");
      if (src && !src.includes("placeholder")) {
        images.push(src);
      }
    });
    return images;
  }

  getInStock(): boolean {
    const addToCartButton = this.$("button[data-test='addToBag'], button.add-to-cart, button.add-to-bag");
    const soldOutText = this.$("div.sold-out, span.sold-out").text().toLowerCase();
    
    if (soldOutText.includes("sold out") || soldOutText.includes("unavailable")) {
      return false;
    }
    
    if (addToCartButton.length > 0 && !addToCartButton.attr("disabled")) {
      return true;
    }
    
    const sizes = this.getSizes();
    return sizes.length > 0 && sizes.some((s) => s.inStock);
  }

  getDescription(): string | null {
    let description =
      this.getAttr('meta[property="og:description"]', "content") ||
      this.getAttr('meta[name="description"]', "content");
    
    if (description) return description;

    description = this.$("div[data-test='productDescription'], .product-description, .product-details").text().trim();
    return description || null;
  }
}
