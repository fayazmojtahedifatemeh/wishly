// server/scraper.ts
import { parse } from "url";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { Page } from "puppeteer";
import { ScrapedProduct } from "./scrapers/scrapedProduct"; // Import the interface

// --- Import all your NEW specific scrapers ---
import { MytheresaScraper } from "./scrapers/mytheresa_scraper";
import { ZaraScraper } from "./scrapers/zara_scraper";
import { HmScraper } from "./scrapers/hm_scraper";
import { AymScraper } from "./scrapers/aym_scraper";
import { CoachOutletScraper } from "./scrapers/coachoutlet_scraper";
import { AmazonScraper } from "./scrapers/amazon_scraper";
import { EtsyScraper } from "./scrapers/etsy_scraper";
import { CharlesTyrhittScraper } from "./scrapers/charles_tyrhitt_scraper";
import { TheFoldScraper } from "./scrapers/the_fold_scraper";
import { RalphLaurenScraper } from "./scrapers/ralph_lauren_scraper";
import { JCrewScraper } from "./scrapers/jcrew_scraper";
import { MaxMaraScraper } from "./scrapers/maxmara_scraper";
import { YooxScraper } from "./scrapers/yoox_scraper";
import { FarfetchScraper } from "./scrapers/farfetch_scraper";
import { TheOutnetScraper } from "./scrapers/theoutnet_scraper"; // <<< ADDED IMPORT

puppeteer.use(StealthPlugin());

// This maps a domain (without www.) to the specific scraper class
const SCRAPER_REGISTRY: { [domain: string]: any } = {
  "mytheresa.com": MytheresaScraper,
  "zara.com": ZaraScraper,
  "hm.com": HmScraper,
  "www2.hm.com": HmScraper,
  "aym-studio.com": AymScraper,
  "coachoutlet.com": CoachOutletScraper,
  "amazon.com": AmazonScraper,
  "amazon.co.uk": AmazonScraper,
  "amazon.de": AmazonScraper,
  "amazon.fr": AmazonScraper,
  "amazon.ca": AmazonScraper,
  "etsy.com": EtsyScraper,
  "ctshirts.com": CharlesTyrhittScraper,
  "thefoldlondon.com": TheFoldScraper,
  "ralphlauren.com": RalphLaurenScraper,
  "ralphlauren.co.uk": RalphLaurenScraper,
  "jcrew.com": JCrewScraper,
  "maxmara.com": MaxMaraScraper,
  "us.maxmara.com": MaxMaraScraper,
  "gb.maxmara.com": MaxMaraScraper,
  "yoox.com": YooxScraper,
  "farfetch.com": FarfetchScraper,
  "theoutnet.com": TheOutnetScraper, // <<< ADDED ENTRY
};

// Sites that *require* Puppeteer to get essential data
const JAVASCRIPT_HEAVY_DOMAINS = [
  "zara.com",
  "hm.com",
  "shop.mango.com", // Keep unless tested otherwise
  "gap.com", // Keep unless tested otherwise
  "forever21.com", // Keep unless tested otherwise
  "jcrew.com",
  "ralphlauren.com",
  "farfetch.com",
  "amazon.com",
  "amazon.co.uk",
  "amazon.de",
  "amazon.fr",
  "amazon.ca",
  // 'theoutnet.com', // Seems static based on analysis, excluded for now
];

function isJavaScriptHeavySite(url: string): boolean {
  try {
    const domain = new URL(url).hostname.toLowerCase();
    // Check if the domain *includes* any heavy domain strings
    return JAVASCRIPT_HEAVY_DOMAINS.some((heavy) => domain.includes(heavy));
  } catch {
    return false;
  }
}

/**
 * The main "Router" function.
 * This is the ONLY function your worker will call.
 */
export async function routeAndScrape(
  url: string,
  browser: any, // Expects a Puppeteer browser instance
): Promise<ScrapedProduct> {
  const fullDomain = parse(url).hostname || "";
  // Normalize domain: remove www. and handle potential subdomains if necessary
  let domain = fullDomain.replace(/^www\./, "");
  // Handle specific subdomains if needed, e.g., us.maxmara.com -> maxmara.com
  if (domain.endsWith("maxmara.com")) domain = "maxmara.com";
  // Add similar rules if other sites use regional subdomains you want to map

  let page: Page | null = null;

  console.log(
    `[Router] Received request for URL: ${url} (Normalized Domain: ${domain})`,
  );

  try {
    // 1. Find the correct scraper class for this domain
    const ScraperClass = SCRAPER_REGISTRY[domain];

    if (!ScraperClass) {
      console.error(
        `[Router] No scraper registered for domain: ${domain} (from ${fullDomain})`,
      );
      throw new Error(`No scraper registered for domain: ${domain}`);
    }

    // 2. Load the page using Puppeteer
    console.log(`[Router] Launching new page for ${url}`);
    page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    );
    await page.setViewport({ width: 1366, height: 768 });

    console.log(`[Router] Navigating to ${url}`);
    // Increased timeout slightly
    await page.goto(url, { waitUntil: "networkidle0", timeout: 60000 });

    // Slightly longer delay for stability, maybe only for JS heavy sites?
    // if (isJavaScriptHeavySite(url)) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    // }

    const html = await page.content();
    console.log(`[Router] HTML content fetched for ${url}`);

    // 3. Instantiate and run the *specific* scraper
    let scraperInstance;
    let result: ScrapedProduct;
    const usePuppeteer =
      isJavaScriptHeavySite(url) || ScraperClass === AmazonScraper; // Force Puppeteer for Amazon even if not technically "heavy" due to complexity

    if (usePuppeteer) {
      console.log(
        `[Router] Using JS-Heavy scraper (${ScraperClass.name}) for ${domain}`,
      );
      // Pass the live Puppeteer page
      scraperInstance = new ScraperClass(html, url, page);
    } else {
      console.log(
        `[Router] Using Static scraper (${ScraperClass.name}) for ${domain}`,
      );
      // Pass null for the Puppeteer page, scraper will use Cheerio
      scraperInstance = new ScraperClass(html, url, null);
    }

    // Call scrape (works for both async/sync methods via await)
    result = await scraperInstance.scrape();

    console.log(`[Router] Scraping finished successfully for ${url}`);
    await page.close();
    console.log(`[Router] Page closed for ${url}`);
    return result;
  } catch (error: any) {
    console.error(`[Router] Failed to scrape ${url}: ${error.message}`);
    if (page && !page.isClosed()) {
      console.log(`[Router] Closing page for ${url} due to error.`);
      await page.close();
    }
    // Add more context to the error if possible
    error.message = `Scraping failed for ${url} (Domain: ${domain}): ${error.message}`;
    throw error; // Re-throw the error for the worker
  }
}
