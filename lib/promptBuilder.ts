
import { Bookmark } from '../types';

/**
 * Builds a prompt for organizing a batch of bookmarks, including the existing folder structure.
 * This prompt guides the AI to categorize new bookmarks into existing folders or suggest new ones consistently.
 *
 * @param bookmarks - The batch of bookmarks to be organized.
 * @param existingFolderStructure - A JSON string representing the current folder hierarchy.
 * @param maxDepth - The maximum depth for suggested folder hierarchies.
 * @param createHierarchy - Whether to create hierarchical categories.
 * @param generateTags - Whether to generate tags for each bookmark.
 * @returns The complete prompt string for the AI model.
 */
export const buildBatchOrganizePrompt = (
  bookmarks: Bookmark[],
  existingFolderStructure: string,
  maxDepth: number,
  createHierarchy: boolean,
  generateTags: boolean
): string => {
  const hierarchyInstruction = createHierarchy
    ? `Create hierarchical category structures using " > " as a separator (e.g., "Work > Projects > Q3"). Maximum depth is ${maxDepth} levels.`
    : "Suggest a single, relevant category name for each bookmark.";

  const tagInstruction = generateTags
    ? "Also suggest 2-4 relevant, lowercase tags for each bookmark."
    : "";

  const bookmarksList = bookmarks.map((bookmark, index) =>
    `${index + 1}. ID: "${bookmark.id}" | Title: "${bookmark.title}" | URL: "${bookmark.url}"`
  ).join('\n');

  return `
You are an expert AI bookmark organizer. Your task is to analyze a batch of bookmarks and categorize them logically.

**EXISTING FOLDER STRUCTURE:**
You are given the following folder structure that already exists. Your primary goal is to use these folders.
${existingFolderStructure}

**INSTRUCTIONS:**
1.  Analyze the ${bookmarks.length} bookmarks provided below.
2.  For EACH bookmark, decide the most appropriate folder for it.
3.  **PRIORITIZE USING EXISTING FOLDERS.** If a bookmark clearly fits into an existing folder, use that exact folder path.
4.  Only create a NEW folder if there is no suitable existing option. Be consistent; avoid creating folders with similar meanings (e.g., if "AI" exists, don't create "Artificial Intelligence").
5.  ${hierarchyInstruction}
6.  ${tagInstruction}

**BOOKMARKS TO ORGANIZE:**
${bookmarksList}

**RESPONSE FORMAT:**
You MUST return a valid JSON array, with one object per bookmark. Each object must contain:
- "bookmarkId": The original ID of the bookmark.
- "suggestedCategory": The full path of the suggested folder (e.g., "Technology > AI").
- "confidence": A score from 0.0 to 1.0 indicating your confidence.
- "reasoning": A brief explanation for your choice.
- "tags": An array of suggested tags (or an empty array if not requested).

**EXAMPLE RESPONSE:**
[
  {
    "bookmarkId": "xyz-123",
    "suggestedCategory": "Technology > AI",
    "confidence": 0.95,
    "reasoning": "The bookmark discusses large language models, which fits perfectly into the existing AI category.",
    "tags": ["ai", "llm", "research"]
  },
  {
    "bookmarkId": "abc-456",
    "suggestedCategory": "Personal > Recipes > Desserts",
    "confidence": 0.88,
    "reasoning": "This is a recipe for a cake. A new 'Desserts' subfolder is appropriate under 'Recipes'.",
    "tags": ["baking", "recipes", "dessert"]
  }
]

IMPORTANT:
- Return a valid JSON array with EXACTLY ${bookmarks.length} items.
- Ensure the 'bookmarkId' matches the ID from the input list.
- Be consistent and logical in your categorization.
`;
};
