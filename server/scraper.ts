import * as cheerio from "cheerio";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

puppeteer.use(StealthPlugin());

export interface ScrapedProduct {
  name: string;
  images: string[];
  price: number;
  currency: string;
  availableSizes: string[];
  availableColors?: string[];
  inStock: boolean;
  description?: string;
}

const JAVASCRIPT_HEAVY_DOMAINS = [
  'zara.com',
  'hm.com',
  'shop.mango.com',
  'gap.com',
  'forever21.com'
];

function isJavaScriptHeavySite(url: string): boolean {
  try {
    const domain = new URL(url).hostname.toLowerCase();
    return JAVASCRIPT_HEAVY_DOMAINS.some(heavy => domain.includes(heavy));
  } catch {
    return false;
  }
}

async function scrapeWithPuppeteer(url: string): Promise<ScrapedProduct> {
  let browser;
  
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    await page.goto(url, { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    const scrapedData = await page.evaluate(() => {
      const data: any = {
        name: '',
        images: [],
        priceText: '',
        availableSizes: [],
        availableColors: [],
        description: '',
        html: document.documentElement.outerHTML
      };

      data.name = 
        document.querySelector('h1[itemprop="name"]')?.textContent?.trim() ||
        document.querySelector('h1.product-title, h1[class*="product-name"]')?.textContent?.trim() ||
        document.querySelector('h1')?.textContent?.trim() ||
        document.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
        document.title || '';

      const imageElements = document.querySelectorAll('img[itemprop="image"], .product-image img, .gallery img, [class*="product-gallery"] img, [class*="product-media"] img');
      imageElements.forEach(img => {
        const src = img.getAttribute('src') || img.getAttribute('data-src');
        if (src && !data.images.includes(src)) {
          data.images.push(src);
        }
      });

      const ogImages = document.querySelectorAll('meta[property="og:image"]');
      ogImages.forEach(meta => {
        const content = meta.getAttribute('content');
        if (content && !data.images.includes(content)) {
          data.images.push(content);
        }
      });

      data.priceText = 
        document.querySelector('[itemprop="price"]')?.getAttribute('content') ||
        document.querySelector('[itemprop="price"]')?.textContent?.trim() ||
        document.querySelector('meta[property="product:price:amount"]')?.getAttribute('content') ||
        document.querySelector('.sale-price, .discounted-price, .final-price, [class*="sale-price"], [class*="current-price"]')?.textContent?.trim() ||
        document.querySelector('.price, [class*="price"]')?.textContent?.trim() || '0';

      const sizeElements = document.querySelectorAll(
        'button[class*="size"], [data-size], select[name*="size"] option, [class*="size-selector"] button, [aria-label*="size"]'
      );
      const seenSizes = new Set();
      sizeElements.forEach(el => {
        const size = 
          el.getAttribute('data-size') ||
          el.getAttribute('data-value') ||
          el.getAttribute('value') ||
          el.getAttribute('aria-label') ||
          el.textContent?.trim();
        if (size && !seenSizes.has(size)) {
          seenSizes.add(size);
          data.availableSizes.push(size);
        }
      });

      const colorElements = document.querySelectorAll(
        'button[class*="color"], button[class*="colour"], [data-color], [data-colour], select[name*="color" i] option, select[name*="colour" i] option, [class*="color-selector"] button, [class*="colour-selector"] button, [aria-label*="color" i], [aria-label*="colour" i]'
      );
      const seenColors = new Set();
      colorElements.forEach(el => {
        const color = 
          el.getAttribute('data-color') ||
          el.getAttribute('data-colour') ||
          el.getAttribute('data-value') ||
          el.getAttribute('value') ||
          el.getAttribute('aria-label') ||
          el.getAttribute('title') ||
          el.textContent?.trim();
        if (color && !seenColors.has(color)) {
          seenColors.add(color);
          data.availableColors.push(color);
        }
      });

      data.description =
        document.querySelector('meta[name="description"]')?.getAttribute('content') ||
        document.querySelector('meta[property="og:description"]')?.getAttribute('content') ||
        document.querySelector('[itemprop="description"]')?.textContent?.trim() || '';

      return data;
    });

    const $ = cheerio.load(scrapedData.html);
    const processedData = processScrapedData($, scrapedData, url);
    
    await browser.close();
    return processedData;

  } catch (error) {
    if (browser) {
      await browser.close();
    }
    throw error;
  }
}

function cleanSizes(rawSizes: string[]): string[] {
  const invalidSizeTexts = [
    "select size", "choose size", "pick size", "size guide", 
    "size chart", "add to cart", "add to bag", "click to enlarge",
    "view details", "quick view", "buy now", "shop now", "sold out",
    "select", "choose", "customise", "customize", "find your size",
    "size & fit", "details", "delivery", "returns"
  ];

  const cleanedSizes: string[] = [];
  const seenSizes = new Set<string>();

  rawSizes.forEach((sizeText: string) => {
    sizeText = sizeText.trim();
    const lowerSize = sizeText.toLowerCase();

    if (
      sizeText &&
      sizeText.length >= 1 &&
      sizeText.length <= 15 &&
      !invalidSizeTexts.some(invalid => lowerSize.includes(invalid)) &&
      !seenSizes.has(sizeText)
    ) {
      const looksLikeSize = 
        /^(xx?[sl]|[sml]|x{1,3}l|one size|free size|os)$/i.test(sizeText) ||
        /^\d+$/.test(sizeText) ||
        /^\d+(\.\d+)?$/.test(sizeText) ||
        /^\d+\s*-\s*\d+$/.test(sizeText) ||
        /^(UK|US|EU|FR|IT|JP)?\s*\d+(\.\d+)?$/i.test(sizeText) ||
        /^\d+["\']$/.test(sizeText) ||
        /^(XXS|XS|S|M|L|XL|XXL|XXXL|\d+XL)$/i.test(sizeText);
      
      if (looksLikeSize) {
        seenSizes.add(sizeText);
        cleanedSizes.push(sizeText);
      }
    }
  });

  return cleanedSizes;
}

function cleanColors(rawColors: string[]): string[] {
  const invalidColorTexts = [
    "select color", "choose color", "pick color", "add to cart",
    "add to bag", "click to enlarge", "view details", "quick view",
    "buy now", "shop now", "sold out", "select", "choose", "select colour", "choose colour"
  ];

  const cleanedColors: string[] = [];
  const seenColors = new Set<string>();

  rawColors.forEach((colorText: string) => {
    colorText = colorText.trim();
    const lowerColor = colorText.toLowerCase();

    if (
      colorText &&
      colorText.length >= 2 &&
      colorText.length <= 50 &&
      !invalidColorTexts.some(invalid => lowerColor === invalid) &&
      !seenColors.has(colorText) &&
      !/^[\d.]+$/.test(colorText) &&
      !/^(XXS|XS|S|M|L|XL|XXL|XXXL|\d+XL)$/i.test(colorText)
    ) {
      seenColors.add(colorText);
      cleanedColors.push(colorText);
    }
  });

  return cleanedColors;
}

function processScrapedData($: cheerio.CheerioAPI, scrapedData: any, url: string): ScrapedProduct {
  const html = $.html();
  
  const normalizePrice = (priceStr: string): number => {
    priceStr = priceStr.replace(/\s/g, "");
    const hasComma = priceStr.includes(",");
    const hasDot = priceStr.includes(".");
    
    if (hasComma && hasDot) {
      const lastCommaIndex = priceStr.lastIndexOf(",");
      const lastDotIndex = priceStr.lastIndexOf(".");
      
      if (lastCommaIndex > lastDotIndex) {
        return parseFloat(priceStr.replace(/\./g, "").replace(",", "."));
      } else {
        return parseFloat(priceStr.replace(/,/g, ""));
      }
    } else if (hasComma && !hasDot) {
      const parts = priceStr.split(",");
      if (parts.length === 2 && parts[1].length <= 2) {
        return parseFloat(priceStr.replace(",", "."));
      } else {
        return parseFloat(priceStr.replace(/,/g, ""));
      }
    } else if (!hasComma && hasDot) {
      const parts = priceStr.split(".");
      if (parts.length === 2 && parts[1].length <= 2) {
        return parseFloat(priceStr);
      } else if (parts.length >= 2) {
        return parseFloat(priceStr.replace(/\./g, ""));
      } else {
        return parseFloat(priceStr);
      }
    } else {
      return parseFloat(priceStr);
    }
  };

  let price = 0;
  const priceText = scrapedData.priceText;
  
  const salePriceMatch = priceText.match(/(?:sale|discounted|final|now|special)[:\s]*[\$£€¥₽]*\s*([\d,.\s]+)/i);
  if (salePriceMatch) {
    price = normalizePrice(salePriceMatch[1]) * 100;
  } else {
    const percentageDiscountMatch = priceText.match(/\(-?\d+%\)[^\d]*([\d,.\s]+)/);
    if (percentageDiscountMatch) {
      price = normalizePrice(percentageDiscountMatch[1]) * 100;
    } else {
      const allPrices = priceText.match(/[\d,.\s]+/g);
      if (allPrices && allPrices.length > 1) {
        price = normalizePrice(allPrices[allPrices.length - 1]) * 100;
      } else if (allPrices && allPrices.length === 1) {
        price = normalizePrice(allPrices[0]) * 100;
      }
    }
  }

  let currency =
    $('meta[property="product:price:currency"]').attr("content") ||
    $('[itemprop="priceCurrency"]').attr("content") ||
    "USD";
  
  if (priceText.includes("$") && !priceText.includes("HK$") && !priceText.includes("A$")) currency = "USD";
  else if (priceText.includes("HK$")) currency = "HKD";
  else if (priceText.includes("A$")) currency = "AUD";
  else if (priceText.includes("£")) currency = "GBP";
  else if (priceText.includes("€")) currency = "EUR";
  else if (priceText.includes("¥") || priceText.includes("CN¥") || priceText.includes("CNY")) currency = "CNY";
  else if (priceText.includes("₽") || priceText.includes("RUB")) currency = "RUB";
  else if (priceText.includes("CAD") || priceText.includes("C$")) currency = "CAD";
  else if (priceText.includes("SGD") || priceText.includes("S$")) currency = "SGD";

  const cleanedSizes = cleanSizes(scrapedData.availableSizes);
  const cleanedColors = cleanColors(scrapedData.availableColors);

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
    /class="[^"]*sold-out/i,
    /class="[^"]*unavailable/i,
    /"inStock":\s*false/i,
    /"available":\s*false/i
  ];
  
  const inStockPatterns = [
    /"availability":\s*"InStock"/i,
    /"availability":\s*"https:\/\/schema.org\/InStock"/i,
    /"inStock":\s*true/i,
    /"available":\s*true/i,
    /add to (cart|bag|basket)/i
  ];

  const hasOutOfStockIndicator = outOfStockPatterns.some(pattern => pattern.test(html));
  const hasInStockIndicator = inStockPatterns.some(pattern => pattern.test(html));
  
  let inStock = true;
  if (hasOutOfStockIndicator) {
    inStock = false;
  } else if (hasInStockIndicator) {
    inStock = true;
  }

  const images = scrapedData.images.map((img: string) => {
    if (img.startsWith('http')) return img;
    if (img.startsWith('//')) return 'https:' + img;
    return new URL(img, url).href;
  });

  return {
    name: scrapedData.name || "Untitled Product",
    images: images.length > 0 ? Array.from(new Set(images)) : ["https://via.placeholder.com/400"],
    price: Math.round(price),
    currency,
    availableSizes: cleanedSizes.length > 0 ? cleanedSizes : [],
    availableColors: cleanedColors.length > 0 ? cleanedColors : undefined,
    inStock,
    description: scrapedData.description,
  };
}

async function scrapeWithCheerio(url: string): Promise<ScrapedProduct> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Product not found (404)");
    }
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  let name =
    $('h1[itemprop="name"]').first().text().trim() ||
    $("h1.product-title").first().text().trim() ||
    $("h1").first().text().trim() ||
    $('meta[property="og:title"]').attr("content") ||
    $("title").text().trim();

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
  $(".product-image img, .gallery img, .product-gallery img").each((_, el) => {
    const src = $(el).attr("src") || $(el).attr("data-src");
    if (src) {
      const fullSrc = src.startsWith("http") ? src : new URL(src, url).href;
      if (!images.includes(fullSrc)) {
        images.push(fullSrc);
      }
    }
  });

  let priceText =
    $('[itemprop="price"]').first().attr("content") ||
    $('[itemprop="price"]').first().text().trim() ||
    $('meta[property="product:price:amount"]').attr("content") ||
    $(".sale-price, .discounted-price, .final-price").first().text().trim() ||
    $('[class*="sale"], [class*="discounted"], [class*="final"]').first().text().trim() ||
    $(".price").first().text().trim() ||
    $('[class*="price"]').first().text().trim() ||
    "0";

  const normalizePrice = (priceStr: string): number => {
    priceStr = priceStr.replace(/\s/g, "");
    const hasComma = priceStr.includes(",");
    const hasDot = priceStr.includes(".");
    
    if (hasComma && hasDot) {
      const lastCommaIndex = priceStr.lastIndexOf(",");
      const lastDotIndex = priceStr.lastIndexOf(".");
      
      if (lastCommaIndex > lastDotIndex) {
        return parseFloat(priceStr.replace(/\./g, "").replace(",", "."));
      } else {
        return parseFloat(priceStr.replace(/,/g, ""));
      }
    } else if (hasComma && !hasDot) {
      const parts = priceStr.split(",");
      if (parts.length === 2 && parts[1].length <= 2) {
        return parseFloat(priceStr.replace(",", "."));
      } else {
        return parseFloat(priceStr.replace(/,/g, ""));
      }
    } else if (!hasComma && hasDot) {
      const parts = priceStr.split(".");
      if (parts.length === 2 && parts[1].length <= 2) {
        return parseFloat(priceStr);
      } else if (parts.length >= 2) {
        return parseFloat(priceStr.replace(/\./g, ""));
      } else {
        return parseFloat(priceStr);
      }
    } else {
      return parseFloat(priceStr);
    }
  };
  
  let price = 0;
  const salePriceMatch = priceText.match(/(?:sale|discounted|final|now|special)[:\s]*[\$£€¥₽]*\s*([\d,.\s]+)/i);
  if (salePriceMatch) {
    price = normalizePrice(salePriceMatch[1]) * 100;
  } else {
    const percentageDiscountMatch = priceText.match(/\(-?\d+%\)[^\d]*([\d,.\s]+)/);
    if (percentageDiscountMatch) {
      price = normalizePrice(percentageDiscountMatch[1]) * 100;
    } else {
      const allPrices = priceText.match(/[\d,.\s]+/g);
      if (allPrices && allPrices.length > 1) {
        price = normalizePrice(allPrices[allPrices.length - 1]) * 100;
      } else if (allPrices && allPrices.length === 1) {
        price = normalizePrice(allPrices[0]) * 100;
      }
    }
  }

  let currency =
    $('meta[property="product:price:currency"]').attr("content") ||
    $('[itemprop="priceCurrency"]').attr("content") ||
    "USD";
  
  if (priceText.includes("$") && !priceText.includes("HK$") && !priceText.includes("A$")) currency = "USD";
  else if (priceText.includes("HK$")) currency = "HKD";
  else if (priceText.includes("A$")) currency = "AUD";
  else if (priceText.includes("£")) currency = "GBP";
  else if (priceText.includes("€")) currency = "EUR";
  else if (priceText.includes("¥") || priceText.includes("CN¥") || priceText.includes("CNY")) currency = "CNY";
  else if (priceText.includes("₽") || priceText.includes("RUB")) currency = "RUB";
  else if (priceText.includes("CAD") || priceText.includes("C$")) currency = "CAD";
  else if (priceText.includes("SGD") || priceText.includes("S$")) currency = "SGD";

  const rawSizes: string[] = [];
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
  
  for (const selector of sizeSelectors) {
    $(selector).each((_, el) => {
      const sizeText = 
        $(el).attr("data-value") ||
        $(el).attr("data-size") ||
        $(el).attr("value") ||
        $(el).attr("aria-label") ||
        $(el).text().trim();
      
      if (sizeText && !rawSizes.includes(sizeText.trim())) {
        rawSizes.push(sizeText.trim());
      }
    });
    
    if (rawSizes.length > 0) break;
  }

  const rawColors: string[] = [];
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
  
  for (const selector of colorSelectors) {
    $(selector).each((_, el) => {
      const colorText = 
        $(el).attr("data-value") ||
        $(el).attr("data-color") ||
        $(el).attr("data-colour") ||
        $(el).attr("value") ||
        $(el).attr("aria-label") ||
        $(el).attr("title") ||
        $(el).text().trim();
      
      if (colorText && !rawColors.includes(colorText.trim())) {
        rawColors.push(colorText.trim());
      }
    });
    
    if (rawColors.length > 0) break;
  }

  const description =
    $('meta[name="description"]').attr("content") ||
    $('meta[property="og:description"]').attr("content") ||
    $('[itemprop="description"]').first().text().trim() ||
    "";

  const availableSizes = cleanSizes(rawSizes);
  const availableColors = cleanColors(rawColors);

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
    /class="[^"]*sold-out/i,
    /class="[^"]*unavailable/i,
    /"inStock":\s*false/i,
    /"available":\s*false/i
  ];
  
  const inStockPatterns = [
    /"availability":\s*"InStock"/i,
    /"availability":\s*"https:\/\/schema.org\/InStock"/i,
    /"inStock":\s*true/i,
    /"available":\s*true/i,
    /add to (cart|bag|basket)/i
  ];

  const hasOutOfStockIndicator = outOfStockPatterns.some(pattern => pattern.test(html));
  const hasInStockIndicator = inStockPatterns.some(pattern => pattern.test(html));
  
  let inStock = true;
  if (hasOutOfStockIndicator) {
    inStock = false;
  } else if (hasInStockIndicator) {
    inStock = true;
  }

  return {
    name: name || "Untitled Product",
    images: images.length > 0 ? Array.from(new Set(images)) : ["https://via.placeholder.com/400"],
    price: Math.round(price),
    currency,
    availableSizes,
    availableColors: availableColors.length > 0 ? availableColors : undefined,
    inStock,
    description,
  };
}

export async function scrapeProductFromUrl(url: string): Promise<ScrapedProduct> {
  try {
    console.log(`[Scraper] Scraping URL: ${url}`);
    
    if (isJavaScriptHeavySite(url)) {
      console.log(`[Scraper] Detected JavaScript-heavy site, using Puppeteer`);
      try {
        return await scrapeWithPuppeteer(url);
      } catch (puppeteerError) {
        console.error(`[Scraper] Puppeteer failed, falling back to Cheerio:`, puppeteerError);
        return await scrapeWithCheerio(url);
      }
    } else {
      console.log(`[Scraper] Using Cheerio for static scraping`);
      return await scrapeWithCheerio(url);
    }
  } catch (error: any) {
    console.error(`Error scraping product at ${url}:`, error);
    if (error.message.includes("Product not found (404)")) {
      throw error;
    }
    throw new Error("Failed to fetch product details. Check URL or website structure.");
  }
}
