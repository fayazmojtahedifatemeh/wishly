import { GoogleGenAI } from "@google/genai";

// DON'T DELETE THIS COMMENT
// Follow these instructions when using this blueprint:
// - Note that the newest Gemini model series is "gemini-2.5-flash" or gemini-2.5-pro"
//   - do not change this unless explicitly requested by the user

// This API key is from Gemini Developer API Key, not vertex AI API Key
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface CategorySuggestion {
  suggestedCategories: string[];
  confidence: number;
}

export async function analyzeProductImage(imageBuffer: Buffer): Promise<string> {
  try {
    const base64Image = imageBuffer.toString('base64');
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: base64Image
              }
            },
            {
              text: "Analyze this image and describe the clothing or accessory item in detail. Include: type of item (dress, shoes, bag, etc.), color, style, material if visible, and any distinguishing features. Format as a brief product search query."
            }
          ]
        }
      ]
    });

    return response.text || "clothing item";
  } catch (error) {
    console.error("Error analyzing image:", error);
    return "clothing item";
  }
}

export async function categorizeProduct(
  productName: string,
  productDescription?: string
): Promise<CategorySuggestion> {
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
      productDescription ? ` - ${productDescription}` : ""
    }

Categorize this product into ONE or MORE of these categories (choose the most relevant ones):
${categories.join(", ")}

Respond with JSON in this format:
{
  "suggestedCategories": ["Category1", "Category2"],
  "confidence": 0.95
}

Only include categories from the provided list. The confidence should be between 0 and 1.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            suggestedCategories: {
              type: "array",
              items: { type: "string" },
            },
            confidence: { type: "number" },
          },
          required: ["suggestedCategories", "confidence"],
        },
      },
      contents: prompt,
    });

    const rawJson = response.text;
    if (rawJson) {
      const data: CategorySuggestion = JSON.parse(rawJson);
      return data;
    } else {
      throw new Error("Empty response from model");
    }
  } catch (error) {
    console.error("Error categorizing product:", error);
    // Return default suggestion
    return {
      suggestedCategories: ["Extra Stuff"],
      confidence: 0.5,
    };
  }
}
