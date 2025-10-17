import * as cheerio from "cheerio";

export interface ScrapedProduct {
  name: string;
  images: string[];
  price: number;
  currency: string;
  availableSizes: string[];
  description?: string;
}

export async function scrapeProductFromUrl(url: string): Promise<ScrapedProduct> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract product name
    let name = 
      $('h1[itemprop="name"]').first().text().trim() ||
      $('h1.product-title').first().text().trim() ||
      $('h1').first().text().trim() ||
      $('meta[property="og:title"]').attr('content') ||
      $('title').text().trim();

    // Extract images
    const images: string[] = [];
    
    // Try common image selectors
    $('img[itemprop="image"]').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src');
      if (src && !images.includes(src)) {
        images.push(src.startsWith('http') ? src : new URL(src, url).href);
      }
    });

    $('meta[property="og:image"]').each((_, el) => {
      const content = $(el).attr('content');
      if (content && !images.includes(content)) {
        images.push(content);
      }
    });

    $('.product-image img, .gallery img, .product-gallery img').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src');
      if (src && !images.includes(src)) {
        const fullSrc = src.startsWith('http') ? src : new URL(src, url).href;
        images.push(fullSrc);
      }
    });

    // Extract price
    let priceText = 
      $('[itemprop="price"]').first().attr('content') ||
      $('[itemprop="price"]').first().text().trim() ||
      $('.price').first().text().trim() ||
      $('[class*="price"]').first().text().trim() ||
      $('meta[property="product:price:amount"]').attr('content') ||
      '0';

    // Clean price text and extract number
    const priceMatch = priceText.match(/[\d,]+\.?\d*/);
    const price = priceMatch ? parseFloat(priceMatch[0].replace(',', '')) * 100 : 0;

    // Extract currency
    let currency = 
      $('meta[property="product:price:currency"]').attr('content') ||
      $('[itemprop="priceCurrency"]').attr('content') ||
      'USD';

    // Detect currency from price text
    if (priceText.includes('$')) currency = 'USD';
    else if (priceText.includes('£')) currency = 'GBP';
    else if (priceText.includes('€')) currency = 'EUR';
    else if (priceText.includes('¥') || priceText.includes('CN¥')) currency = 'CNY';

    // Extract sizes
    const availableSizes: string[] = [];
    $('select[name*="size"] option, [class*="size"] button, [class*="size"] .option').each((_, el) => {
      const sizeText = $(el).text().trim() || $(el).attr('value');
      if (sizeText && sizeText !== 'Select Size' && !availableSizes.includes(sizeText)) {
        availableSizes.push(sizeText);
      }
    });

    // Extract description
    const description = 
      $('meta[name="description"]').attr('content') ||
      $('meta[property="og:description"]').attr('content') ||
      $('[itemprop="description"]').first().text().trim() ||
      '';

    return {
      name: name || 'Untitled Product',
      images: images.length > 0 ? images : ['https://via.placeholder.com/400'],
      price: Math.round(price),
      currency,
      availableSizes,
      description,
    };
  } catch (error) {
    console.error('Error scraping product:', error);
    throw new Error('Failed to fetch product details from URL');
  }
}
