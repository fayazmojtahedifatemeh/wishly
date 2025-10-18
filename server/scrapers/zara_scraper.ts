// server/scrapers/zara_scraper.ts
import {
  BaseScraper,
  PriceInfo,
  SizeInfo,
  ColorInfo,
  ScrapedProduct,
} from "./base_scraper"; // Import ScrapedProduct too
import { Page } from "puppeteer";

export class ZaraScraper extends BaseScraper {
  // Store the Puppeteer page instance. Override type from BaseScraper.
  protected page: Page;

  constructor(html: string, url: string, puppeteerPage: Page | null) {
    super(html, url, puppeteerPage); // Call parent constructor
    if (!puppeteerPage) {
      throw new Error("Zara scraper requires a Puppeteer page instance.");
    }
    this.page = puppeteerPage; // Assign the non-null page
  }

  // --- Override the main scrape method to use Puppeteer ---
  public async scrape(): Promise<ScrapedProduct> {
    console.log("[ZaraScraper] Starting scrape method...");

    // 1. Get static data using Cheerio (as fallback or initial values)
    const initialName = this.getName(); // Uses Cheerio
    const initialDescription = this.getDescription(); // Uses Cheerio

    // 2. Get dynamic data using Puppeteer page.evaluate
    console.log("[ZaraScraper] Evaluating page content...");
    const dynamicData = await this.page.evaluate(() => {
      // Name (Your analysis: h1 span.product-detail-card-info__name)
      const nameElement = document.querySelector(
        "h1.product-detail-card-info__title span.product-detail-card-info__name",
      );
      const name = (nameElement as HTMLElement)?.innerText?.trim() || null;

      // Price (Your analysis: span[data-qa-qualifier="price-amount-current"] span.money-amount__main)
      const priceElement = document.querySelector(
        'span[data-qa-qualifier="price-amount-current"] span.money-amount__main',
      );
      const priceText =
        (priceElement as HTMLElement)?.innerText?.trim() || null;

      // Colors (Your analysis: ul.product-detail-color-selector__colors li button span.screen-reader-text)
      const colors: ColorInfo[] = [];
      document
        .querySelectorAll(
          "ul.product-detail-color-selector__colors li.product-detail-color-item button",
        )
        .forEach((el) => {
          const colorName = (
            el.querySelector("span.screen-reader-text") as HTMLElement
          )?.innerText?.trim();
          // You might need to adjust selector for swatch image if available
          const swatchImg = (
            el.querySelector(
              "img.product-detail-color-selector__color-image",
            ) as HTMLImageElement
          )?.src;
          if (colorName) {
            colors.push({ name: colorName, swatchUrl: swatchImg || undefined });
          }
        });

      // Images (Your analysis: picture[data-qa-qualifier="media-image"] source[srcset])
      const images: string[] = [];
      document
        .querySelectorAll(
          'picture[data-qa-qualifier="media-image"] source[srcset]',
        )
        .forEach((el) => {
          const srcset = el.getAttribute("srcset");
          if (srcset) {
            // Get the last (highest res) image URL from srcset
            const sources = srcset
              .split(",")
              .map((s) => s.trim().split(" ")[0]);
            const bestSource = sources.pop(); // Get the last one
            if (bestSource && !images.includes(bestSource)) {
              images.push(bestSource);
            }
          }
        });
      // Fallback if source fails (Your analysis: img src)
      if (images.length === 0) {
        document
          .querySelectorAll('picture[data-qa-qualifier="media-image"] img[src]')
          .forEach((imgEl) => {
            const src = (imgEl as HTMLImageElement).src;
            if (src && !images.includes(src)) images.push(src);
          });
      }

      return { name, priceText, colors, images: [...new Set(images)] }; // Deduplicate images
    });
    console.log("[ZaraScraper] Page evaluation complete.");

    // 3. Get Sizes using Puppeteer interaction (Your analysis: click button, then find sizes)
    console.log("[ZaraScraper] Attempting to get sizes...");
    const sizes = await this.getPuppeteerSizes();

    // 4. Parse Price
    const priceInfo = this.parsePriceString(dynamicData.priceText);

    // 5. Determine Stock (based on size availability)
    const inStock = sizes.length > 0 && sizes.some((s) => s.inStock);
    console.log(`[ZaraScraper] In Stock determined as: ${inStock}`);

    // 6. Combine and return
    return {
      name: dynamicData.name || initialName || "Untitled Product",
      priceInfo: priceInfo,
      availableSizes: sizes,
      availableColors: dynamicData.colors,
      // Resolve image URLs relative to the page URL
      images: dynamicData.images.map((src) => this.resolveUrl(src)),
      inStock: inStock,
      description: initialDescription, // Use Cheerio-scraped description
    };
  }

  // --- Helper method specifically for Zara sizes using Puppeteer ---
  private async getPuppeteerSizes(): Promise<SizeInfo[]> {
    try {
      const sizeSelectorButton = 'button[data-qa-action="open-size-selector"]';
      const sizeListItemSelector =
        ".product-detail-size-selector__size-list-item"; // Selector for each size box
      const sizeNameSelector = ".product-size-info__main-label"; // Selector for the size text inside the box
      const closeModalButton = ".product-detail-modal__close button";

      console.log("[ZaraScraper] Clicking size selector button...");
      await this.page.click(sizeSelectorButton);

      console.log("[ZaraScraper] Waiting for size list items...");
      // Wait for the modal and size items to appear
      await this.page.waitForSelector(sizeListItemSelector, {
        timeout: 7000,
        visible: true,
      });

      console.log("[ZaraScraper] Evaluating size list...");
      const sizes = await this.page.evaluate(
        (itemSelector, nameSelector) => {
          const sizeInfo: SizeInfo[] = [];
          document.querySelectorAll(itemSelector).forEach((item) => {
            const nameElement = item.querySelector(nameSelector);
            const name = (nameElement as HTMLElement)?.innerText?.trim();
            // Stock status: check for 'aria-disabled="true"' or a class like 'disabled'
            const isDisabled =
              item.getAttribute("aria-disabled") === "true" ||
              item.classList.contains(
                "product-detail-size-selector__size-list-item--disabled",
              );
            if (name) {
              sizeInfo.push({ name, inStock: !isDisabled });
            }
          });
          return sizeInfo;
        },
        sizeListItemSelector,
        sizeNameSelector,
      ); // Pass selectors as arguments

      console.log(
        `[ZaraScraper] Found ${sizes.length} sizes. Closing modal...`,
      );
      // Close the modal
      await this.page.click(closeModalButton);
      await this.page.waitForSelector(closeModalButton, {
        hidden: true,
        timeout: 3000,
      }); // Wait for modal to disappear

      console.log("[ZaraScraper] Size modal closed.");
      return sizes;
    } catch (e: any) {
      console.error(`[ZaraScraper] Error getting sizes: ${e.message}`);
      // Check if the error is because the size button wasn't found (e.g., one-size item)
      if (
        e.message.includes("selector") &&
        e.message.includes("open-size-selector")
      ) {
        console.log(
          "[ZaraScraper] Size selector button not found, assuming 'One Size'.",
        );
        // Check if an "Add to Cart" button exists to determine stock
        const addToCartVisible = await this.page.evaluate(
          () =>
            !!document.querySelector('button[data-qa-action="add-to-cart"]'),
        );
        return [{ name: "One Size", inStock: addToCartVisible }];
      }
      return []; // Return empty array if any other error occurs
    }
  }

  // --- Implement other methods using Cheerio for static fallbacks ---
  // These might not be strictly necessary if the Puppeteer scrape always works,
  // but good for robustness.

  getName(): string | null {
    // Fallback using Cheerio
    return (
      this.$(
        "h1.product-detail-card-info__title span.product-detail-card-info__name",
      )
        .text()
        .trim() || null
    );
  }

  getPrice(): PriceInfo | null {
    // Price is dynamic, rely on Puppeteer. Return null here.
    return null;
  }

  getSizes(): SizeInfo[] {
    // Sizes are dynamic, rely on Puppeteer. Return empty array here.
    return [];
  }

  getColors(): ColorInfo[] {
    // Colors might be static, try with Cheerio
    const colors: ColorInfo[] = [];
    this.$(
      "ul.product-detail-color-selector__colors li.product-detail-color-item button",
    ).each((i, el) => {
      const name = this.$(el).find("span.screen-reader-text").text().trim();
      const swatchUrl = this.$(el)
        .find("img.product-detail-color-selector__color-image")
        .attr("src");
      if (name) {
        colors.push({ name, swatchUrl: this.resolveUrl(swatchUrl) });
      }
    });
    return colors;
  }

  getImages(): string[] {
    // Images might be static, try with Cheerio
    const images: string[] = [];
    this.$('picture[data-qa-qualifier="media-image"] source[srcset]').each(
      (i, el) => {
        const srcset = this.$(el).attr("srcset");
        if (srcset) {
          const sources = srcset.split(",").map((s) => s.trim().split(" ")[0]);
          const bestSource = sources.pop();
          if (bestSource) images.push(bestSource);
        }
      },
    );
    // Fallback
    if (images.length === 0) {
      this.$('picture[data-qa-qualifier="media-image"] img[src]').each(
        (i, el) => {
          const src = this.$(el).attr("src");
          if (src) images.push(src);
        },
      );
    }
    return images.map((src) => this.resolveUrl(src)); // Resolve URLs
  }

  getInStock(): boolean {
    // Static check as fallback (might be unreliable)
    const outOfStock = this.$('div[class*="out-of-stock"]').length > 0;
    const addToCart = this.$('button[data-qa-action="add-to-cart"]').length > 0;
    return addToCart && !outOfStock;
  }

  getDescription(): string | null {
    // Use meta tags as primary source
    return (
      this.getAttr('meta[property="og:description"]', "content") ||
      this.getAttr('meta[name="description"]', "content") ||
      null
    ); // Return null if not found
  }
}
