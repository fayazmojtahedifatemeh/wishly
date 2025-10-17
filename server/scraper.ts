// Original scraper.ts (Before recent upgrades causing the crash)

import * as cheerio from "cheerio";

export interface ScrapedProduct {
  name: string;
  images: string[];
  price: number; // in cents
  currency: string;
  availableSizes: string[];
  availableColors?: string[];
  inStock: boolean;
  description?: string;
}

export async function scrapeProductFromUrl(
  url: string,
): Promise<ScrapedProduct> {
  try {
    // Uses the built-in fetch instead of axios
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      // Basic error handling for 404
      if (response.status === 404) {
        throw new Error("Product not found (404)");
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // --- Original Generic Scraping Logic ---

    // Extract product name (original guesses)
    let name =
      $('h1[itemprop="name"]').first().text().trim() ||
      $("h1.product-title").first().text().trim() ||
      $("h1").first().text().trim() ||
      $('meta[property="og:title"]').attr("content") ||
      $("title").text().trim();

    // Extract images (original guesses)
    const images: string[] = [];
    $('img[itemprop="image"]').each((_, el) => {
      const src = $(el).attr("src") || $(el).attr("data-src");
      if (src && !images.includes(src)) {
        images.push(src.startsWith("http") ? src : new URL(src, url).href);
      }
    });
    $('meta[property="og:image"]').each((_, el) => {
      const content = $(el).attr("content");
      if (content && !images.includes(content)) {
        images.push(content);
      }
    });
    // Added a check to prevent adding duplicates from different selectors
    $(".product-image img, .gallery img, .product-gallery img").each(
      (_, el) => {
        const src = $(el).attr("src") || $(el).attr("data-src");
        if (src) {
          const fullSrc = src.startsWith("http") ? src : new URL(src, url).href;
          if (!images.includes(fullSrc)) {
            // Check before pushing
            images.push(fullSrc);
          }
        }
      },
    );

    // Extract price (original guesses and parsing)
    let priceText =
      $('[itemprop="price"]').first().attr("content") ||
      $('[itemprop="price"]').first().text().trim() ||
      $(".price").first().text().trim() ||
      $('[class*="price"]').first().text().trim() ||
      $('meta[property="product:price:amount"]').attr("content") ||
      "0";
    // Original simpler price parsing (might have issues with commas)
    const priceMatch = priceText.match(/[\d,]+\.?\d*/);
    const price = priceMatch
      ? parseFloat(priceMatch[0].replace(",", "")) * 100
      : 0; // Note: Original replace was just ','

    // Extract currency (original guesses)
    let currency =
      $('meta[property="product:price:currency"]').attr("content") ||
      $('[itemprop="priceCurrency"]').attr("content") ||
      "USD"; // Default USD
    // Original simple currency detection
    if (priceText.includes("$")) currency = "USD";
    else if (priceText.includes("£")) currency = "GBP";
    else if (priceText.includes("€")) currency = "EUR";
    else if (priceText.includes("¥") || priceText.includes("CN¥"))
      currency = "CNY";
    // (Missing HKD detection from original)

    // Extract sizes with better filtering
    const availableSizes: string[] = [];
    const invalidSizeTexts = [
      "select size", "choose size", "pick size", "size guide", 
      "size chart", "add to cart", "add to bag", "click to enlarge",
      "view details", "quick view", "buy now", "shop now", "sold out"
    ];
    
    $(
      'select[name*="size"] option, [class*="size"] button, [class*="size"] .option, [data-size]',
    ).each((_, el) => {
      const sizeText = $(el).text().trim() || $(el).attr("value") || $(el).attr("data-size");
      const lowerSize = sizeText?.toLowerCase() || "";
      
      if (
        sizeText &&
        sizeText.length < 15 &&
        !invalidSizeTexts.some(invalid => lowerSize.includes(invalid)) &&
        !availableSizes.includes(sizeText)
      ) {
        availableSizes.push(sizeText);
      }
    });

    // Extract colors with better filtering
    const availableColors: string[] = [];
    const invalidColorTexts = [
      "select color", "choose color", "pick color", "add to cart",
      "add to bag", "click to enlarge", "view details", "quick view",
      "buy now", "shop now", "sold out"
    ];
    
    $(
      'select[name*="color"] option, [class*="color"] button, [class*="color"] .option, [data-color], [data-variant]',
    ).each((_, el) => {
      const colorText = $(el).text().trim() || $(el).attr("value") || $(el).attr("data-color");
      const lowerColor = colorText?.toLowerCase() || "";
      
      if (
        colorText &&
        colorText.length < 30 &&
        !invalidColorTexts.some(invalid => lowerColor.includes(invalid)) &&
        !availableColors.includes(colorText)
      ) {
        availableColors.push(colorText);
      }
    });

    // Extract description (original guesses)
    const description =
      $('meta[name="description"]').attr("content") ||
      $('meta[property="og:description"]').attr("content") ||
      $('[itemprop="description"]').first().text().trim() ||
      "";

    // Determine inStock status with better detection
    const outOfStockPatterns = [
      /out of stock/i,
      /sold out/i,
      /currently unavailable/i,
      /not available/i,
      /no longer available/i,
      /discontinued/i,
      /"availability":\s*"OutOfStock"/i,
      /"availability":\s*"SoldOut"/i,
      /class="[^"]*out-of-stock/i,
      /class="[^"]*sold-out/i
    ];
    
    const hasOutOfStockIndicator = outOfStockPatterns.some(pattern => pattern.test(html));
    const inStock = !hasOutOfStockIndicator && price > 0;

    return {
      name: name || "Untitled Product",
      images:
        images.length > 0
          ? Array.from(new Set(images))
          : ["https://via.placeholder.com/400"], // Added Set for uniqueness
      price: Math.round(price),
      currency,
      availableSizes: Array.from(new Set(availableSizes)), // Added Set for uniqueness
      availableColors: availableColors.length > 0 ? Array.from(new Set(availableColors)) : undefined,
      inStock,
      description,
    };
  } catch (error: any) {
    // Added : any
    console.error(`Error scraping product at ${url}:`, error);
    // Throw specific error for 404
    if (error.message.includes("Product not found (404)")) {
      throw error;
    }
    // Generic error for other issues
    throw new Error(
      "Failed to fetch product details. Check URL or website structure.",
    );
  }
}
