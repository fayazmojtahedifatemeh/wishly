// server/scrapers/theoutnet_scraper.ts
import { BaseScraper, PriceInfo, SizeInfo, ColorInfo } from "./base_scraper";

export class TheOutnetScraper extends BaseScraper {
  getName(): string | null {
    // Your analysis: h1... span.ProductInformation89__designer + span.ProductInformation89__name
    const brand = this.getText(
      "h1.ProductInformation89__designerInfoContainer span.ProductInformation89__designer",
    );
    const productName = this.getText(
      "h1.ProductInformation89__designerInfoContainer span.ProductInformation89__name",
    );
    if (brand && productName) return `${brand} - ${productName}`;
    return productName || brand || null;
  }

  getPrice(): PriceInfo | null {
    // Your analysis: div.PriceWithSchema11--details span.PriceWithSchema11__value
    const priceText = this.getText(
      "div.PriceWithSchema11--details span.PriceWithSchema11__value",
    );
    // Original price: span.PriceWithSchema11__previousPrice
    return this.parsePriceString(priceText);
  }

  getSizes(): SizeInfo[] {
    // Your analysis: ul.GridSelect11 li.GridSelect11__optionWrapper label.GridSelect11__optionBox
    const sizes: SizeInfo[] = [];
    this.$("ul.GridSelect11 li.GridSelect11__optionWrapper").each((i, el) => {
      const element = this.$(el);
      const label = element.find("label.GridSelect11__optionBox");
      // Get text content for name, potentially clean it (e.g., remove "Notify Me")
      let name = label
        .text()
        .trim()
        .replace(/Notify Me/i, "")
        .trim();
      // Check aria-label for availability details if text isn't sufficient
      const ariaLabel = label.attr("aria-label") || "";
      // Stock: Check if label contains unavailable text or aria-label indicates it
      // Or check if associated input is disabled
      const input = element.find("input"); // Find associated input
      const isUnavailable =
        ariaLabel.toLowerCase().includes("unavailable") ||
        label.text().toLowerCase().includes("notify me") || // Or 'Sold out' etc.
        input.prop("disabled");

      if (name) {
        // Further clean name if needed, e.g., "Size UK 8" -> "UK 8"
        if (name.toLowerCase().startsWith("size ")) {
          name = name.substring(5);
        }
        sizes.push({ name, inStock: !isUnavailable });
      }
    });
    return sizes;
  }

  getColors(): ColorInfo[] {
    // Your analysis: Only selected color available statically
    // p.ProductDetailsColours89__colourHeading span.ProductDetailsColours89__colourName
    const colorName = this.getText(
      "p.ProductDetailsColours89__colourHeading span.ProductDetailsColours89__colourName",
    );
    // Since only the selected is shown, we can't get swatches or other options here.
    return colorName ? [{ name: colorName, swatchUrl: undefined }] : [];
  }

  getImages(): string[] {
    // Your analysis: ul.ImageCarousel89__track li.ImageCarousel89__slide picture > source / img [srcset]
    const images: string[] = [];
    this.$("ul.ImageCarousel89__track li.ImageCarousel89__slide").each(
      (i, el) => {
        const picture = this.$(el).find("picture");
        const img = picture.find("img");
        const source = picture.find("source");

        // Prioritize srcset from source or img
        const srcset = source.attr("srcset") || img.attr("srcset");
        let src = img.attr("src"); // Fallback to img src

        if (srcset) {
          // Get the last (likely highest res) URL from srcset
          const sources = srcset.split(",").map((s) => s.trim().split(" ")[0]);
          src = sources.pop() || src;
        }
        if (src) images.push(src);
      },
    );
    // Deduplicate and resolve URLs (ensure https: is added if missing)
    return [...new Set(images)].map((src) => this.resolveUrl(src));
  }

  getInStock(): boolean {
    // Check if any sizes are marked as in stock
    const sizes = this.getSizes();
    if (sizes.length > 0) {
      return sizes.some((s) => s.inStock);
    }
    // Fallback: Check for Add to Bag button vs Sold Out message
    // Inspect the page for specific selectors for these elements
    const soldOutMsg = this.$(".soldOutMessageSelector").length > 0; // Replace with actual selector
    const addToBagBtn = this.$("button.AddToBagButtonSelector").length > 0; // Replace with actual selector

    return addToBagBtn && !soldOutMsg;
  }

  getDescription(): string | null {
    // Try meta tags first
    let description =
      this.getAttr('meta[property="og:description"]', "content") ||
      this.getAttr('meta[name="description"]', "content");
    if (description) return description;

    // Fallback: Look for description section (e.g., under "Editor's Notes" or "Details")
    description = this.$("div#productInformationAccordion").text().trim(); // Example selector, likely needs refinement
    return description || null;
  }
}
