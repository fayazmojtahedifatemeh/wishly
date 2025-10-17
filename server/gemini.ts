// In file: server/src/gemini.ts (REPLACE THE WHOLE FILE)

import { GoogleGenerativeAI } from "@google/generative-ai";

// Use GoogleGenerativeAI for consistency
const genAI = process.env.GEMINI_API_KEY 
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

export interface CategorySuggestion {
  suggestedCategories: string[];
  confidence: number;
}

// --- findProductsFromImage function (This was mostly correct) ---
export async function findProductsFromImage(imageBuffer: Buffer, mimeType: string = "image/jpeg") {
  if (!genAI) {
    throw new Error("GEMINI_API_KEY is not configured. Please add it to enable image search.");
  }
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `You are a product search expert. Analyze this image and identify the product shown.
    
Your task:
1. Identify what type of product this is (clothing, shoes, electronics, etc.)
2. Describe the key features (color, style, brand if visible, etc.)
3. Find 5-8 real online shopping links where this exact product or very similar items can be purchased
4. Include links from major retailers like Zara, H&M, ASOS, Amazon, Etsy, Net-a-Porter, TheOutnet, Nordstrom, etc.

Return ONLY valid JSON in this exact format (no markdown, no explanations):
[
  {"name": "Product Name at Retailer", "price": "$XX.XX", "url": "https://retailer.com/product"},
  {"name": "Similar Product Name", "price": "$XX.XX", "url": "https://store.com/item"}
]

Important:
- Each product MUST have a real, working URL
- Include the actual price or "Price varies" if unknown
- Name should include the retailer and product description
- Return 5-8 results minimum`;

    const imagePart = {
      inlineData: {
        data: imageBuffer.toString("base64"),
        mimeType: mimeType,
      },
    };

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const text = response.text();

    // Clean up the response to ensure it's valid JSON
    // Remove potential markdown fences and trim whitespace
    const jsonString = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    // Validate that it looks like JSON before parsing
    if (!jsonString.startsWith("[") || !jsonString.endsWith("]")) {
      console.error("AI response is not a valid JSON array:", jsonString);
      throw new Error("AI response was not in the expected JSON array format.");
    }

    const products = JSON.parse(jsonString);
    return products; // Should be an array of { name, price, url }
  } catch (error) {
    console.error("Error finding products from image:", error);
    // Re-throw a more specific error
    if (error instanceof Error && error.message.includes("JSON")) {
      throw new Error("AI failed to return valid JSON product data.");
    }
    throw new Error("Failed to find products using Gemini AI.");
  }
} // --- END of findProductsFromImage function ---

// --- categorizeProduct function (This looks correct) ---
export async function categorizeProduct(
  productName: string,
  productDescription?: string,
): Promise<CategorySuggestion> {
  if (!genAI) {
    return {
      suggestedCategories: ["Extra Stuff"],
      confidence: 0.5,
    };
  }
  try {
    const categories = [
      "Skirts",
      "Dresses",
      "Coats",
      "Shoes",
      "Electronics",
      "Food",
      "House Things",
      "Extra Stuff",
      "Jewelry",
      "Tops",
      "Nails",
      "Makeup",
      "Pants",
      "Bags",
      "Blazers",
      "Gym",
      "Sweaters & Cardigans",
      "Accessories",
      "Perfumes",
      "Shirts and Blouses",
    ];

    const prompt = `You are a product categorization expert for an e-commerce wishlist application.

Product to categorize: "${productName}"${
      productDescription ? `
Product description: ${productDescription}` : ""
    }

Available categories:
${categories.map((cat, idx) => `${idx + 1}. ${cat}`).join("\n")}

Instructions:
1. Analyze the product name and description carefully
2. Select 1-3 most relevant categories from the list above
3. Be specific - choose the most precise categories that match
4. For clothing, consider the specific type (e.g., "Dresses" not "Extra Stuff")
5. For beauty products, use "Makeup", "Nails", or "Perfumes" specifically
6. Only use "Extra Stuff" if truly no other category fits
7. Assign high confidence (0.8-1.0) for clear matches, lower (0.5-0.7) for uncertain ones

Respond ONLY with valid JSON (no markdown, no explanations):
{
  "suggestedCategories": ["Category1"],
  "confidence": 0.95
}

The categories MUST be exactly from the list above.`;

    // Use the same genAI instance
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const rawJson = response.text();

    if (rawJson) {
      // Clean potential markdown fences
      const jsonString = rawJson
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();
      if (!jsonString.startsWith("{") || !jsonString.endsWith("}")) {
        console.error(
          "Categorization response is not valid JSON object:",
          jsonString,
        );
        throw new Error(
          "AI response was not in the expected JSON object format.",
        );
      }
      const data: CategorySuggestion = JSON.parse(jsonString);
      // Validate categories against the list
      data.suggestedCategories = data.suggestedCategories.filter((cat) =>
        categories.includes(cat),
      );
      if (data.suggestedCategories.length === 0)
        data.suggestedCategories.push("Extra Stuff"); // Fallback
      return data;
    } else {
      throw new Error("Empty response from model");
    }
  } catch (error) {
    console.error("Error categorizing product:", error);
    // Return default suggestion on error
    return {
      suggestedCategories: ["Extra Stuff"],
      confidence: 0.5,
    };
  }
}
