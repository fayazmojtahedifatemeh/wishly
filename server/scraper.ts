// In file: server/src/scraper.ts (REPLACE THE WHOLE FILE - Fixing Regex Flag)

import * as cheerio from "cheerio";
import axios from "axios";

// Interface definition - OK
export interface ScrapedProduct {
  name: string; images: string[]; price: number; currency: string;
  availableSizes: string[]; availableColors?: string[]; inStock: boolean; description?: string;
}

// --- Start of safeJsonParse function ---
function safeJsonParse(json: string | null): any {
  if (!json) { return null; }
  try {
    const cleanedJson = json.replace(//g, '').trim();
    // --- THIS IS THE FIX: Replaced /s flag with [\s\S] ---
    const jsonMatch = cleanedJson.match(/({[\s\S]*}|\[[\s\S]*\])/); // Use [\s\S] instead of '.' with 's' flag
    // --- END OF FIX ---
    if (jsonMatch && jsonMatch[0]) {
      try { return JSON.parse(jsonMatch[0]); } catch (innerError){ /* Fall through */ }
    }
    if ((cleanedJson.startsWith('{') && cleanedJson.endsWith('}')) || (cleanedJson.startsWith('[') && cleanedJson.endsWith(']'))) {
       return JSON.parse(cleanedJson);
    }
    return null;
  } catch (e) { return null; }
}
// --- End of safeJsonParse ---


// --- cleanImageUrl is STILL COMMENTED OUT ---
/*
function cleanImageUrl(url: string | undefined, baseUrl: string): string | undefined {
    // ... function code ...
}
*/
// --- Simple Placeholder for cleanImageUrl ---
function cleanImageUrl(url: string | undefined, baseUrl: string): string | undefined {
    if (!url) return undefined; try { return url.startsWith('http') ? url : new URL(url, baseUrl).href; } catch { return url; }
}


// --- parsePrice is STILL COMMENTED OUT ---
/*
function parsePrice(priceText: string): number {
    // ... function code ...
}
*/
// --- Simple Placeholder for parsePrice ---
function parsePrice(priceText: string): number { return 12345; }


// --- siteRules are STILL COMMENTED OUT ---
/*
const siteRules: Record<string, ($: cheerio.CheerioAPI, url: string) => Partial<ScrapedProduct>> = {
  // ... All rules commented out ...
};
*/


// --- Start of MAIN SCRAPER FUNCTION (Dummy Version) ---
export async function scrapeProductFromUrl(url: string): Promise<ScrapedProduct> {
  console.warn(`SCRAPER IS USING DUMMY DATA for URL: ${url}`);
  try {
    await axios.get(url.substring(0,10), { timeout: 1000 });
    return { name: "Dummy Product (Scraper Disabled)", images: ['https://via.placeholder.com/150'], price: 12345, currency: "USD", availableSizes: ["S", "M", "L"], availableColors: ["Red", "Blue"], inStock: true, description: `Dummy data for URL: ${url}` };
  } catch (error: any) {
    console.error(`Dummy scraper failed for ${url}:`, error.message);
    throw new Error("Failed even in dummy scraper mode.");
  }
}
// --- End of MAIN SCRAPER FUNCTION ---