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
export async function findProductsFromImage(imageBuffer: Buffer) {
  if (!genAI) {
    throw new Error("GEMINI_API_KEY is not configured. Please add it to enable image search.");
  }
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
      Analyze this product image and find 5-8 online shopping links where this exact product or very similar products can be purchased.
      Focus on finding the actual product from major retailers and shopping sites.
      
      Return ONLY a valid JSON array of objects. Each object must have these exact keys: "name", "price", and "url".
      
      Example format:
      [
        {"name": "Green Wool Coat", "price": "$129.99", "url": "https://example.com/product"},
        {"name": "Similar Wool Coat", "price": "$149.00", "url": "https://store.com/item"}
      ]
      
      Do not include any text, markdown formatting, or explanations. Respond ONLY with the JSON array.
    `;

    const imagePart = {
      inlineData: {
        data: imageBuffer.toString("base64"),
        mimeType: "image/jpeg", // Consider handling other types like png if needed
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

    const prompt = `Given this product: "${productName}"${
      productDescription ? ` - Description: ${productDescription}` : ""
    }

Categorize this product into ONE or MORE of these categories (choose the most relevant ones):
${categories.join(", ")}

Respond ONLY with valid JSON in this exact format:
{
  "suggestedCategories": ["Category1", "Category2"],
  "confidence": 0.95
}

Only include categories from the provided list. The confidence should be a number between 0 and 1. Do not include any other text or markdown.`;

    // Use the same genAI instance
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Using 1.5-flash as default

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
