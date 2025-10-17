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

    // Extract price with improved sale price detection
    let priceText =
      $('[itemprop="price"]').first().attr("content") ||
      $('[itemprop="price"]').first().text().trim() ||
      $('meta[property="product:price:amount"]').attr("content") ||
      $(".sale-price, .discounted-price, .final-price").first().text().trim() ||
      $('[class*="sale"], [class*="discounted"], [class*="final"]').first().text().trim() ||
      $(".price").first().text().trim() ||
      $('[class*="price"]').first().text().trim() ||
      "0";

    // Enhanced price parsing for different formats
    // Handle formats like: "RUB 83,389", "$129.99", "€45,50", "RRP: RUB 166,777 (-50%) RUB 83,389"
    let price = 0;
    
    // Helper function to normalize price strings (handle both . and , as decimal separators)
    const normalizePrice = (priceStr: string): number => {
      // Remove spaces
      priceStr = priceStr.replace(/\s/g, "");
      
      // Check if comma is decimal separator (European format like "45,50")
      // vs thousands separator (like "1,234.00" or "1.234,00")
      const hasComma = priceStr.includes(",");
      const hasDot = priceStr.includes(".");
      
      if (hasComma && hasDot) {
        // Both present: determine which is decimal separator
        const lastCommaIndex = priceStr.lastIndexOf(",");
        const lastDotIndex = priceStr.lastIndexOf(".");
        
        if (lastCommaIndex > lastDotIndex) {
          // Format: "1.234,56" (European) - comma is decimal
          return parseFloat(priceStr.replace(/\./g, "").replace(",", "."));
        } else {
          // Format: "1,234.56" (US) - dot is decimal
          return parseFloat(priceStr.replace(/,/g, ""));
        }
      } else if (hasComma && !hasDot) {
        // Only comma: could be thousands or decimal separator
        const parts = priceStr.split(",");
        if (parts.length === 2 && parts[1].length <= 2) {
          // Likely decimal: "45,50"
          return parseFloat(priceStr.replace(",", "."));
        } else {
          // Likely thousands: "1,234" or "83,389"
          return parseFloat(priceStr.replace(/,/g, ""));
        }
      } else if (!hasComma && hasDot) {
        // Only dot: could be thousands (European) or decimal separator (US)
        const parts = priceStr.split(".");
        if (parts.length === 2 && parts[1].length <= 2) {
          // Likely decimal: "45.50" (US format)
          return parseFloat(priceStr);
        } else if (parts.length >= 2) {
          // Likely thousands: "1.234" (European) or "1.234.567"
          return parseFloat(priceStr.replace(/\./g, ""));
        } else {
          // No separator, just a dot: "45.5"
          return parseFloat(priceStr);
        }
      } else {
        // No separators at all
        return parseFloat(priceStr);
      }
    };
    
    // Look for sale/discounted price patterns first
    const salePriceMatch = priceText.match(/(?:sale|discounted|final|now|special)[:\s]*[\$£€¥₽]*\s*([\d,.\s]+)/i);
    if (salePriceMatch) {
      price = normalizePrice(salePriceMatch[1]) * 100;
    } else {
      // Look for percentage discount patterns like "(-50%) RUB 83,389"
      const percentageDiscountMatch = priceText.match(/\(-?\d+%\)[^\d]*([\d,.\s]+)/);
      if (percentageDiscountMatch) {
        price = normalizePrice(percentageDiscountMatch[1]) * 100;
      } else {
        // Try to find the last price mentioned (often the sale price)
        const allPrices = priceText.match(/[\d,.\s]+/g);
        if (allPrices && allPrices.length > 1) {
          // Multiple prices found, use the last one (usually sale price)
          price = normalizePrice(allPrices[allPrices.length - 1]) * 100;
        } else if (allPrices && allPrices.length === 1) {
          // Single price found
          price = normalizePrice(allPrices[0]) * 100;
        }
      }
    }

    // Extract currency with more coverage
    let currency =
      $('meta[property="product:price:currency"]').attr("content") ||
      $('[itemprop="priceCurrency"]').attr("content") ||
      "USD"; // Default USD
    
    // Detect currency from symbols and codes
    if (priceText.includes("$") && !priceText.includes("HK$") && !priceText.includes("A$")) currency = "USD";
    else if (priceText.includes("HK$")) currency = "HKD";
    else if (priceText.includes("A$")) currency = "AUD";
    else if (priceText.includes("£")) currency = "GBP";
    else if (priceText.includes("€")) currency = "EUR";
    else if (priceText.includes("¥") || priceText.includes("CN¥") || priceText.includes("CNY")) currency = "CNY";
    else if (priceText.includes("₽") || priceText.includes("RUB")) currency = "RUB";
    else if (priceText.includes("CAD") || priceText.includes("C$")) currency = "CAD";
    else if (priceText.includes("SGD") || priceText.includes("S$")) currency = "SGD";

    // Extract sizes with improved filtering and separation
    const availableSizes: string[] = [];
    const invalidSizeTexts = [
      "select size", "choose size", "pick size", "size guide", 
      "size chart", "add to cart", "add to bag", "click to enlarge",
      "view details", "quick view", "buy now", "shop now", "sold out",
      "select", "choose", "customise", "customize"
    ];
    
    // Look for size selectors with proper separation
    const sizeSelectors = [
      'select[name*="size" i] option',
      'select[id*="size" i] option',
      '[class*="size" i] button[data-value]',
      '[class*="size" i] button[aria-label]',
      '[class*="size" i] input[type="radio"] + label',
      '[data-size]',
      '[class*="swatch" i][data-value*="size" i]',
      'button[class*="size-option" i]',
      'li[data-size], li[class*="size" i] span'
    ];
    
    const seenSizes = new Set<string>();
    
    for (const selector of sizeSelectors) {
      $(selector).each((_, el) => {
        let sizeText = 
          $(el).attr("data-value") ||
          $(el).attr("data-size") ||
          $(el).attr("value") ||
          $(el).attr("aria-label") ||
          $(el).text().trim();
        
        if (!sizeText) return;
        
        // Clean up the size text
        sizeText = sizeText.trim();
        const lowerSize = sizeText.toLowerCase();
        
        // Split concatenated sizes if they appear to be joined
        // e.g., "xssmlxl" -> check if it contains multiple valid sizes
        const validSizes = ['xxs', 'xs', 's', 'm', 'l', 'xl', 'xxl', '3xl', '4xl', '5xl'];
        let foundValidSize = false;
        
        for (const validSize of validSizes) {
          if (lowerSize === validSize) {
            foundValidSize = true;
            break;
          }
        }
        
        // Check if it's a reasonable size (1-10 chars, no invalid keywords)
        if (
          sizeText &&
          sizeText.length >= 1 &&
          sizeText.length <= 10 &&
          !invalidSizeTexts.some(invalid => lowerSize.includes(invalid)) &&
          !seenSizes.has(sizeText)
        ) {
          // Additional validation: check if it looks like a size
          const looksLikeSize = 
            foundValidSize ||
            /^(xx?[sl]|[sml]|x{1,3}l|one size|free size|os)$/i.test(sizeText) ||
            /^\d+$/.test(sizeText) || // Numeric sizes (shoes: 8, 10.5, clothing: 32, 34, etc.)
            /^\d+(\.\d+)?$/.test(sizeText) || // Decimal sizes (10.5, 8.5)
            /^\d+\s*-\s*\d+$/.test(sizeText) || // Range like "8-10"
            /^(UK|US|EU|FR|IT|JP)?\s*\d+(\.\d+)?$/i.test(sizeText) || // "UK 8", "EU 42"
            /^\d+["\']$/.test(sizeText); // Waist sizes with quotes: 32", 34'
          
          if (looksLikeSize) {
            seenSizes.add(sizeText);
            availableSizes.push(sizeText);
          }
        }
      });
      
      // Break if we found sizes to avoid duplicates from other selectors
      if (availableSizes.length > 0) break;
    }

    // Extract colors with improved filtering and pattern detection
    const availableColors: string[] = [];
    const invalidColorTexts = [
      "select color", "choose color", "pick color", "add to cart",
      "add to bag", "click to enlarge", "view details", "quick view",
      "buy now", "shop now", "sold out", "select", "choose"
    ];
    
    // Look for color/pattern selectors with proper separation
    const colorSelectors = [
      'select[name*="color" i] option',
      'select[name*="colour" i] option',
      'select[id*="color" i] option',
      'select[id*="colour" i] option',
      '[class*="color" i] button[data-value]',
      '[class*="colour" i] button[data-value]',
      '[class*="color" i] input[type="radio"] + label',
      '[data-color]',
      '[data-colour]',
      '[class*="swatch" i][data-value*="color" i]',
      '[class*="variant" i] button[aria-label]',
      'button[class*="color-option" i]',
      'li[data-color], li[class*="color" i] span'
    ];
    
    const seenColors = new Set<string>();
    
    for (const selector of colorSelectors) {
      $(selector).each((_, el) => {
        let colorText = 
          $(el).attr("data-value") ||
          $(el).attr("data-color") ||
          $(el).attr("data-colour") ||
          $(el).attr("value") ||
          $(el).attr("aria-label") ||
          $(el).attr("title") ||
          $(el).text().trim();
        
        if (!colorText) return;
        
        // Clean up the color text
        colorText = colorText.trim();
        const lowerColor = colorText.toLowerCase();
        
        // Check if it's a reasonable color/pattern (1-50 chars, no invalid keywords)
        if (
          colorText &&
          colorText.length >= 2 &&
          colorText.length <= 50 &&
          !invalidColorTexts.some(invalid => lowerColor.includes(invalid)) &&
          !seenColors.has(colorText) &&
          !/^[\d.]+$/.test(colorText) // Avoid plain numbers
        ) {
          seenColors.add(colorText);
          availableColors.push(colorText);
        }
      });
      
      // Break if we found colors to avoid duplicates from other selectors
      if (availableColors.length > 0) break;
    }

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
