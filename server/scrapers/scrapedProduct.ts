// server/scrapers/scrapedProduct.ts

// Define the interfaces for structured data
export interface PriceInfo { price: number; currency: string; } // price in cents
export interface SizeInfo { name: string; inStock: boolean; }
export interface ColorInfo { name: string; swatchUrl?: string; }

// Main interface for the data returned by any scraper
export interface ScrapedProduct {
  name: string;
  priceInfo: PriceInfo | null; // Use the PriceInfo interface, allow null if not found
  availableSizes: SizeInfo[]; // Use the SizeInfo interface
  availableColors: ColorInfo[]; // Use the ColorInfo interface
  images: string[];
  inStock: boolean;
  description?: string;
}