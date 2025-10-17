// In file: server/src/scraper.ts (REPLACE THE WHOLE FILE - Clean Rebuild)

import * as cheerio from "cheerio";
import axios from "axios";

// Interface definition - OK
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

// --- Start of safeJsonParse function ---
function safeJsonParse(json: string | null): any {
  if (!json) {
      return null;
  }
  try {
    // Correct regex for HTML comments
    const cleanedJson = json.replace(//g, '').trim();
    // Attempt to find JSON structure
    const jsonMatch = cleanedJson.match(/({.*}|\[.*\])/s);
    if (jsonMatch && jsonMatch[0]) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (innerError){
        // Fall through if parsing the extracted part fails
      }
    }
    // Fallback: Check structure before parsing the whole string
    if ((cleanedJson.startsWith('{') && cleanedJson.endsWith('}')) || (cleanedJson.startsWith('[') && cleanedJson.endsWith(']'))) {
       return JSON.parse(cleanedJson);
    }
    // If no valid JSON structure found
    return null;
  } catch (e) {
    // If any parsing fails
    return null;
  }
}
// --- End of safeJsonParse function ---


// --- Start of cleanImageUrl function ---
function cleanImageUrl(url: string | undefined, baseUrl: string): string | undefined {
    if (!url) {
        return undefined;
    }
    try {
        let absoluteUrl = url.startsWith('http') ? url : new URL(url, baseUrl).href;
        if (absoluteUrl.startsWith('http:')) {
            absoluteUrl = absoluteUrl.replace('http:', 'https:');
        }
        const parsedUrl = new URL(absoluteUrl);
        const paramsToRemove = ['wid', 'hei', 'fit', 'qlt', 'fmt', 'size', 'width', 'height', 'quality', 'crop', 'config', '$n_480w$', '_V', '_AC_'];
        paramsToRemove.forEach(p => parsedUrl.searchParams.delete(p));
        parsedUrl.pathname = parsedUrl.pathname.replace(/(_\d+x\d+|_small|_medium|_large|_thumb(?:nail)?)\.(jpg|jpeg|png|webp|gif)$/i, '.$2');
        return parsedUrl.toString();
    } catch (e) {
        return url; // Return original if parsing fails
    }
}
// --- End of cleanImageUrl function --- (This is the critical area ~line 24-40)


// --- Start of parsePrice function ---
function parsePrice(priceText: string): number {
  if (!priceText) {
      return 0;
  }
  // Remove currency symbols, letters, etc. KEEP commas and dots.
  let cleaned = priceText.replace(/[^\d.,]/g, '');
  // Prioritize finding the *last* number found in the string
  const numbers = cleaned.match(/[\d]+(?:[.,]\d+)?/g);
  if (numbers && numbers.length > 0) {
    cleaned = numbers[numbers.length - 1];
  }
  // Standardize decimal separator: remove thousands, replace comma decimal
  cleaned = cleaned.replace(/[.,](?=\d{3})/g, '').replace(',', '.');
  const priceMatch = cleaned.match(/[\d]+\.?\d*/);
  return priceMatch ? Math.round(parseFloat(priceMatch[0]) * 100) : 0;
}
// --- End of parsePrice function ---


// --- SITE-SPECIFIC RULES (Using previously refined logic) ---
const siteRules: Record<string, ($: cheerio.CheerioAPI, url: string) => Partial<ScrapedProduct>> = {
    "www2.hm.com": ($, url) => {
        let d:any=null;$('script[type="application/ld+json"]').each((_,el)=>{const p=safeJsonParse($(el).html());if(p&&(p['@type']==='Product'||(Array.isArray(p)&&p[0]?.['@type']==='Product'))){d=Array.isArray(p)?p[0]:p;return false;}});if(!d)d=safeJsonParse($('script:contains("productArticleDetails")').html());if(!d)throw new Error("H&M JSON");const o=Array.isArray(d.offers)?d.offers:[d.offers].filter(Boolean);const mO=o.find((i:any)=>i?.['@type']==='Offer')||{};return{name:d.name,images:(d.image||[]).map((i:string)=>cleanImageUrl(i,url)),price:parsePrice(mO.price||"0"),currency:mO.priceCurrency||"USD",availableSizes:[...new Set(o.map((i:any)=>i?.itemOffered?.name||i?.name).filter(Boolean))],availableColors:[d.color].filter(Boolean),inStock:mO.availability?.includes("InStock")};
    },
    "www.theoutnet.com": ($, url) => {
        let d:any=null;$('script[type="application/ld+json"]').each((_,el)=>{const p=safeJsonParse($(el).html());if(p&&p['@type']==='Product'){d=p;return false;}});const n=d?.name||$('h1[data-test-id="product-title"]').text().trim();const i=[...new Set((d?.image||[]).concat(Array.from($('ul[data-test-id="thumbnails"] img').map((_,el)=>$(el).attr('src')))).map((u:string|undefined)=>cleanImageUrl(u,url)).filter(Boolean))];const sP=$('ins[data-test-id="current-price"]').text().trim();const oP=$('del[data-test-id="rrp"]').text().trim();const pT=sP||oP;let c="USD";if(url.includes('/en-de/')||url.includes('/en-at/')||url.includes('/en-ru/'))c="EUR";else if(url.includes('/en-gb/'))c="GBP";else if(url.includes('/en-hk/'))c="HKD";return{name:n,images:i,price:parsePrice(pT),currency:c,availableSizes:Array.from($('li button[data-test-id^="size-"]:not([disabled])').map((_,el)=>$(el).text().trim())),availableColors:[$('span[data-test-id="product-color"]').text().trim()].filter(Boolean),inStock:!$('[data-test-id="out-of-stock-label"]').length&&!!pT};
    },
    "www.zara.com": ($, url) => {
        let d:any=null;$('script[type="application/ld+json"]').each((_,el)=>{const p=safeJsonParse($(el).html());if(p&&(p['@type']==='Product'||(Array.isArray(p)&&p[0]?.['@type']==='Product'))){d=Array.isArray(p)?p[0]:p;return false;}});if(!d)throw new Error("Zara JSON");const o=Array.isArray(d.offers)?d.offers:[d.offers].filter(Boolean);const mO=o.find((i:any)=>i?.['@type']==='Offer')||{};let s=(d.description||"").match(/Available sizes: (.*)/)?.[1]?.split(', ')||[];if(s.length===0){s=Array.from($('.product-detail-size-selector__size-list-item--is-available .product-detail-size-info__main-label').map((_,el)=>$(el).text().trim()));}return{name:d.name,images:(d.image||[]).map((i:string)=>cleanImageUrl(i,url)),price:parsePrice(mO.price||"0"),currency:mO.priceCurrency||"USD",availableSizes:[...new Set(s)],availableColors:[d.color].filter(Boolean),inStock:mO.availability?.includes("InStock")};
    },
    "www.aym-studio.com": ($, url) => {
        let d:any=null;$('script[type="application/ld+json"]').each((_,el)=>{const p=safeJsonParse($(el).html());if(p&&(p['@type']==='Product'||(Array.isArray(p)&&p.find((i:any)=>i['@type']==='Product')))){d=Array.isArray(p)?p.find((i:any)=>i['@type']==='Product'):p;return false;}});if(!d)throw new Error("AYM JSON");const o=Array.isArray(d.offers)?d.offers:[d.offers].filter(Boolean);const mO=o.find((i:any)=>i?.['@type']==='Offer')||{};let i=Array.from($('.product__media-item img[srcset]').map((_,el)=>{const s=$(el).attr('srcset')||'';const src=s.split(',').map(s=>s.trim().split(' ')[0]);return src.pop();})).map((u:string|undefined)=>cleanImageUrl(u,url)).filter(Boolean);if(i.length===0&&d.image)i=[d.image].map((u:string)=>cleanImageUrl(u,url)).filter(Boolean);const c=mO.priceCurrency||(mO.price?.includes('£')?'GBP':(mO.price?.includes('€')?'EUR':'USD'));return{name:d.name,images:[...new Set(i)],price:parsePrice(mO.price||"0"),currency:c,availableSizes:o.map((i:any)=>i?.itemOffered?.name||i?.name||i?.sku).filter(Boolean),availableColors:[d.color].filter(Boolean),inStock:mO.availability?.includes("InStock")};
    },
    "www.aybl.com": ($, url) => {
        let d:any=null;$('script[type="application/ld+json"]').each((_,el)=>{const p=safeJsonParse($(el).html());if(p&&p['@type']==='Product'){d=p;return false;}});if(d){const o=Array.isArray(d.offers)?d.offers:[d.offers].filter(Boolean);const mO=o.find((i:any)=>i?.['@type']==='Offer')||{};return{name:d.name,images:(d.image||[]).map((i:string)=>cleanImageUrl(i,url)),price:parsePrice(mO.price||"0"),currency:mO.priceCurrency||(url.includes('uk.')?'GBP':(url.includes('eu.')?'EUR':'USD')),availableSizes:o.map((i:any)=>i?.itemOffered?.size||i?.itemOffered?.name).filter(Boolean),availableColors:[d.color].filter(Boolean),inStock:mO.availability?.includes("InStock")};}else{const n=$('h1.product-title, .product__title h1').first().text().trim();const pT=$('.price--highlight, .product-price, .price__regular .price-item').first().text().trim();let c=url.includes('uk.')?'GBP':(url.includes('eu.')?'EUR':'USD');const i=Array.from($('.product-gallery__thumbnail-image, .product__thumb img').map((_,el)=>$(el).attr('src')||$(el).attr('data-src'))).map(s=>s?.replace(/_\d+x.*/,'_1024x')).map((u:string|undefined)=>cleanImageUrl(u,url)).filter(Boolean);const aS=Array.from($('.product-form__swatch--size .product-form__swatch-item label:not(.disabled), .size-swatch:not(.soldout) input[type="radio"] + label').map((_,el)=>$(el).text().trim()));const aC=Array.from($('.product-form__swatch--color .product-form__swatch-item label, .color-swatch input[type="radio"]:checked + label').map((_,el)=>$(el).text().trim()));const iS=!$('.product-form__button--sold-out, .product-form__submit[disabled]').length;return{name:n,images:[...new Set(i)],price:parsePrice(pT),currency:c,availableSizes:aS,availableColors:aC,inStock:iS};}
    },
    // (Stubs for Amazon, Asos)
};


// --- MAIN SCRAPER FUNCTION (Ensure Braces Match) ---
export async function scrapeProductFromUrl(url: string): Promise<ScrapedProduct> {
  try { // Start main try
    const { data: html, request } = await axios.get(url, {
      headers: { "User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36", "Accept":"text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8", "Accept-Language":"en-US,en;q=0.9", "Accept-Encoding":"gzip, deflate, br", "Referer":"https://www.google.com/", },
      timeout: 25000
    });

    const finalUrl = request?.res?.responseUrl || url;
    const $ = cheerio.load(html);
    const hostname = new URL(finalUrl).hostname.replace("www.", "");

    let name, images: string[] = [], price = 0, currency = "USD", availableSizes: string[] = [], availableColors: string[] = [], inStock = true, description;

    const rules = siteRules[hostname as keyof typeof siteRules];

    if (rules) {
      try { // Start rules try
        const siteData = rules($, finalUrl);
        name = siteData.name;
        images = (siteData.images || []).map((src) => cleanImageUrl(src, finalUrl)).filter(Boolean) as string[];
        availableSizes = (siteData.availableSizes || []).filter(s => s && String(s).length < 30);
        availableColors = (siteData.availableColors || []).filter(c => c && String(c).length < 50);
        inStock = siteData.inStock ?? true;
        price = siteData.price ?? parsePrice(siteData.priceText || "0");
        currency = siteData.currency || currency;
      } catch (err: any) { // End rules try, start catch
        console.error(`Error applying site-specific rules for ${hostname}: ${err.message}. Falling back to generic.`);
        name = undefined; // Trigger fallback
      } // End rules catch
    } // End if(rules)

    if (!name) { // Fallback logic
      name = $("h1").first().text().trim() || $('meta[property="og:title"]').attr("content") || "";
      $('meta[property="og:image"]').each((_, el) => { const c = $(el).attr("content"); const cl = cleanImageUrl(c, finalUrl); if (cl && !images.includes(cl)) images.push(cl); });
      if (images.length === 0) { $('.product-image img, .gallery img, .product-gallery img, img[itemprop="image"]').slice(0, 5).each((_, el) => { const s = $(el).attr('src') || $(el).attr('data-src'); const clS = cleanImageUrl(s, finalUrl); if (clS && !images.includes(clS)) images.push(clS); }); }
      const pT = $('[itemprop="price"]').first().attr("content") || $('[class*="price"]').first().text().trim() || "0";
      price = parsePrice(pT);
      $('select[name*="size"] option, button[class*="size"], a[class*="size"]').slice(0, 10).each((_, el) => { const sT = $(el).text().trim() || $(el).attr('value'); if (sT && !/select|choose|size/i.test(sT) && sT.length < 20) { if (!availableSizes.includes(sT)) availableSizes.push(sT); } });
      inStock = !/out of stock|sold out/i.test(html);
    } // End fallback

    description = $('meta[name="description"]').attr("content") || $('meta[property="og:description"]').attr("content") || "";

    // Fallback currency
    if (!currency || currency === "USD") { const pE = $('[itemprop="price"], [class*="price"]').first(); const pC = pE.attr('content') || pE.text(); if (pC.includes("£") || html.includes("GBP")) currency = "GBP"; else if (pC.includes("€") || html.includes("EUR")) currency = "EUR"; else if (pC.includes("HK$") || html.includes("HKD")) currency = "HKD"; else if (pC.includes("$") || html.includes("USD")) currency = "USD"; }

    return {
      name: name || "Untitled Product",
      images: [...new Set(images.filter(Boolean))],
      price: Math.round(price),
      currency,
      availableSizes: [...new Set(availableSizes.filter(s => s && String(s).length > 0))],
      availableColors: [...new Set(availableColors.filter(c => c && String(c).length > 0))],
      inStock: inStock && price > 0,
      description,
    };
  } catch (error) { // Start main catch
    if (axios.isAxiosError(error)) { if (error.response?.status === 404) throw new Error("Product not found (404)"); if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) throw new Error(`Scraping timed out (${(error.config?.timeout || 0)/1000}s)`); if (error.response?.status === 403) throw new Error("Blocked by website (403)"); if (error.response?.status) throw new Error(`HTTP error ${error.response.status}`); }
    console.error(`Error scraping ${url}:`, error);
    throw new Error("Failed to fetch product details. The website might be blocking requests or the page structure changed.");
  } // End main catch
} // <-- End of scrapeProductFromUrl