
// This file is deprecated. AI functionality has been moved to hooks/useAiApi.ts
// The new system supports multiple AI providers and configurations.

// Legacy functions for backward compatibility (if needed)
import { useAiApi } from '../hooks/useAiApi';
import { Bookmark } from '../types';

// Note: These functions are deprecated. Use the useAiApi hook instead.
// They are kept here for reference and potential backward compatibility.

export const getCategorySuggestion = async (
  bookmark: Bookmark,
  existingCategories: string[]
): Promise<string> => {
  // This function is deprecated. Use useAiApi hook instead.
  throw new Error("This function is deprecated. Use the useAiApi hook for AI functionality.");
};

export const getTagSuggestions = async (bookmark: Bookmark): Promise<string[]> => {
  // This function is deprecated. Use useAiApi hook instead.
  throw new Error("This function is deprecated. Use the useAiApi hook for AI functionality.");
};
