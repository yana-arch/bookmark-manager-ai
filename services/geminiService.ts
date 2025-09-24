
import { GoogleGenAI, Type } from "@google/genai";
import { Bookmark } from '../types';

if (!process.env.API_KEY) {
  console.warn("API_KEY environment variable not set. AI features will be disabled.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

export const getCategorySuggestion = async (
  bookmark: Bookmark,
  existingCategories: string[]
): Promise<string> => {
   if (!process.env.API_KEY) {
    throw new Error("API Key is not configured. Cannot use AI features.");
  }
  
  const prompt = `
    You are an expert bookmark organizer. Your task is to suggest the best category for a new bookmark.

    Analyze the bookmark's title and URL.
    Bookmark Title: "${bookmark.title}"
    Bookmark URL: "${bookmark.url}"

    Here is a list of existing categories:
    ${existingCategories.join(', ')}

    Based on the bookmark's content, choose the most relevant category from the existing list. 
    If none of the existing categories are a good fit, suggest a concise and appropriate new category name.

    Your response MUST be a single category name. Do not add any explanation or punctuation.
  `;

  try {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
             thinkingConfig: { thinkingBudget: 0 }
        }
    });
    
    return response.text.trim();

  } catch (error) {
    console.error("Error getting category suggestion from Gemini API:", error);
    throw new Error("Failed to get AI suggestion. Please try again.");
  }
};
