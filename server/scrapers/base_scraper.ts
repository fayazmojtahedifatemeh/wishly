// server/scrapers/base_scraper.ts
import * as cheerio from "cheerio";
import { Page } from "puppeteer"; // Use Page from puppeteer
import {
  ScrapedProduct,
  PriceInfo,
  SizeInfo,
  ColorInfo,
} from "./scrapedProduct"; // Import interfaces

export abstract class BaseScraper {
  protected $: cheerio.CheerioAPI; // For parsing static HTML
  protected page: Page | null; // The live Puppeteer page, if needed
  protected url: string;

  constructor(html: string, url: string, puppeteerPage: Page | null = null) {
    this.$ = cheerio.load(html);
    this.url = url;
    this.page = puppeteerPage; // Store the Puppeteer page if provided
  }

  // --- Abstract methods: MUST be implemented by child classes ---
  abstract getName(): string | null;
  abstract getPrice(): PriceInfo | null; // Return structured PriceInfo or null
  abstract getSizes(): SizeInfo[]; // Return structured SizeInfo array
  abstract getColors(): ColorInfo[]; // Return structured ColorInfo array
  abstract getImages(): string[];
  abstract getInStock(): boolean;
  abstract getDescription(): string | null;

  // --- Helper methods ---

  // Helper to safely get text from a Cheerio element
  protected getText(
    selector: string,
    context?: cheerio.Cheerio<cheerio.Element>,
  ): string {
    const element = context
      ? context.find(selector).first()
      : this.$(selector).first();
    return element.text().trim();
  }

  // Helper to safely get an attribute
  protected getAttr(
    selector: string,
    attribute: string,
    context?: cheerio.Cheerio<cheerio.Element>,
  ): string | undefined {
    const element = context
      ? context.find(selector).first()
      : this.$(selector).first();
    return element.attr(attribute);
  }

  // Helper to normalize and resolve URLs
  protected resolveUrl(relativeUrl: string | undefined): string {
    if (!relativeUrl) return "";
    try {
      if (relativeUrl.startsWith("//")) {
        return "https:" + relativeUrl;
      }
      // Use the URL constructor for robust resolving
      return new URL(relativeUrl, this.url).href;
    } catch (e) {
      console.warn(
        `[BaseScraper] Failed to resolve URL: ${relativeUrl} against base ${this.url}`,
      );
      return relativeUrl; // Return original if parsing fails
    }
  }

  // Helper to parse price string like "$12.34", "£1,290", "¥13,225" into cents
  protected parsePriceString(priceStr: string | undefined): PriceInfo | null {
    if (!priceStr) return null;

    // Remove currency symbols, commas, and whitespace
    const cleanedPrice = priceStr
      .replace(/[$,£€¥₽]/g, "")
      .replace(/,/g, "")
      .trim();
    const price = parseFloat(cleanedPrice);

    if (isNaN(price)) return null;

    // Basic currency detection
    let currency = "USD"; // Default
    if (priceStr.includes("£")) currency = "GBP";
    else if (priceStr.includes("€")) currency = "EUR";
    else if (priceStr.includes("¥") || priceStr.includes("円"))
      currency = "JPY"; // Or CNY? Needs context
    else if (priceStr.includes("₽")) currency = "RUB";
    // Add more currency detections as needed

    return {
      price: Math.round(price * 100), // Convert to cents
      currency: currency,
    };
  }

  // --- Public Scrape Method ---
  // This can be overridden by scrapers needing async logic (like Zara)
  public async scrape(): Promise<ScrapedProduct> {
    const images = this.getImages().map((src) => this.resolveUrl(src));

    return {
      name: this.getName() || "Untitled Product",
      priceInfo: this.getPrice(),
      availableSizes: this.getSizes(),
      availableColors: this.getColors(),
      images:
        images.length > 0
          ? [...new Set(images)]
          : ["https://via.placeholder.com/400"], // Deduplicate images
      inStock: this.getInStock(),
      description: this.getDescription(),
    };
  }
}
