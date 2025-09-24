import { useState, useCallback } from 'react';
import { Bookmark, BookmarkNode, AiConfig, ApiError } from '../types';
import { useAiConfig } from '../context/AiConfigContext';
import { getGenerativeModel } from '../services/ai/modelFactory';
import { BookmarkOrganizer, OrganizationPlan, applyOrganizationPlan, ProcessingLog } from '../services/ai/bookmarkOrganizer';

interface UseAiApiReturn {
  generate: (prompt: string, options?: any) => Promise<{ text: string; tokens?: number; raw?: any }>;
  streamGenerate: (prompt: string, options: any, onDelta: (delta: string) => void) => Promise<void>;
  improvePrompt: (prompt: string, options?: any) => Promise<{ namePrompt: string; mainContentPrompt: string }>;
  testConfig: (config: AiConfig) => Promise<{ success: boolean; message: string }>;
  listModels: (config: AiConfig) => Promise<string[]>;
  getCategorySuggestion: (bookmark: Bookmark, existingCategories: string[]) => Promise<string>;
  getTagSuggestions: (bookmark: Bookmark) => Promise<string[]>;
  // Advanced organization features
  organizeBookmarks: (bookmarks: BookmarkNode[], options?: any) => Promise<OrganizationPlan>;
  applyOrganization: (bookmarks: BookmarkNode[], plan: OrganizationPlan, options?: any) => BookmarkNode[];
  isLoading: boolean;
  error: ApiError | null;
}

export const useAiApi = (): UseAiApiReturn => {
  const { aiConfigs, activeAiConfigId } = useAiConfig();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const generate = useCallback(async (
    prompt: string,
    options: any = {}
  ): Promise<{ text: string; tokens?: number; raw?: any }> => {
    setIsLoading(true);
    setError(null);

    try {
      const model = getGenerativeModel(aiConfigs, activeAiConfigId);
      const result = await model.generateContent(prompt, options);
      return result;
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError);
      throw apiError;
    } finally {
      setIsLoading(false);
    }
  }, [aiConfigs, activeAiConfigId]);

  const streamGenerate = useCallback(async (
    prompt: string,
    options: any,
    onDelta: (delta: string) => void
  ): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const model = getGenerativeModel(aiConfigs, activeAiConfigId);
      if (!model.streamGenerate) {
        throw { code: 'PROVIDER_ERROR', message: 'Streaming not supported by this provider' } as ApiError;
      }
      await model.streamGenerate(prompt, options, onDelta);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError);
      throw apiError;
    } finally {
      setIsLoading(false);
    }
  }, [aiConfigs, activeAiConfigId]);

  const improvePrompt = useCallback(async (
    prompt: string,
    options: any = {}
  ): Promise<{ namePrompt: string; mainContentPrompt: string }> => {
    setIsLoading(true);
    setError(null);

    try {
      const improvementPrompt = `
        You are an expert prompt engineer. Your task is to improve the given prompt by making it more specific, actionable, and effective.

        Original prompt: "${prompt}"

        Please provide an improved version of this prompt. Focus on:
        1. Making it more specific and clear
        2. Adding context where needed
        3. Making it more actionable for an AI assistant
        4. Ensuring it's well-structured

        Return your response as a JSON object with two fields:
        - "namePrompt": A short, descriptive name for the improved prompt (max 50 characters)
        - "mainContentPrompt": The full improved prompt text

        Example format:
        {
          "namePrompt": "Enhanced Bookmark Organizer",
          "mainContentPrompt": "You are an expert bookmark organizer..."
        }
      `;

      const result = await generate(improvementPrompt, options);
      const response = result.text;

      try {
        const parsed = JSON.parse(response);
        if (parsed.namePrompt && parsed.mainContentPrompt) {
          return {
            namePrompt: parsed.namePrompt.trim(),
            mainContentPrompt: parsed.mainContentPrompt.trim(),
          };
        }
        throw new Error('Invalid response format');
      } catch (parseError) {
        // Fallback: try to extract from text response
        const nameMatch = response.match(/"namePrompt"\s*:\s*"([^"]+)"/);
        const contentMatch = response.match(/"mainContentPrompt"\s*:\s*"([^"]+)"/);

        if (nameMatch && contentMatch) {
          return {
            namePrompt: nameMatch[1].trim(),
            mainContentPrompt: contentMatch[1].trim(),
          };
        }

        throw { code: 'PARSE_ERROR', message: 'Failed to parse AI response as JSON' } as ApiError;
      }
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError);
      throw apiError;
    } finally {
      setIsLoading(false);
    }
  }, [generate]);

  const testConfig = useCallback(async (config: AiConfig): Promise<{ success: boolean; message: string }> => {
    try {
      const testPrompt = "Hello! Please respond with just the word 'OK' to confirm the connection is working.";
      const model = getGenerativeModel([config], config.id);
      const result = await model.generateContent(testPrompt, { maxTokens: 10, temperature: 0.1 });

      if (result.text.toLowerCase().includes('ok')) {
        return { success: true, message: "Connection successful! API responded correctly." };
      } else {
        return { success: true, message: "Connection successful, but unexpected response." };
      }
    } catch (error) {
      const apiError = error as ApiError;
      return { success: false, message: `Connection failed: ${apiError.message}` };
    }
  }, []);

  const listModels = useCallback(async (config: AiConfig): Promise<string[]> => {
    // For now, return default models. In a real implementation, this would query the provider's API
    // TODO: Implement actual model listing for each provider
    return [config.modelId];
  }, []);

  const getCategorySuggestion = useCallback(async (
    bookmark: Bookmark,
    existingCategories: string[]
  ): Promise<string> => {
    setIsLoading(true);
    setError(null);

    try {
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

      const result = await generate(prompt);
      return result.text;
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError);
      throw apiError;
    } finally {
      setIsLoading(false);
    }
  }, [generate]);

  const getTagSuggestions = useCallback(async (bookmark: Bookmark): Promise<string[]> => {
    setIsLoading(true);
    setError(null);

    try {
      const prompt = `
        You are an expert at analyzing web bookmarks. Your task is to suggest relevant tags for a bookmark.

        Analyze the bookmark's title and URL to suggest 2-4 relevant tags.
        Bookmark Title: "${bookmark.title}"
        Bookmark URL: "${bookmark.url}"

        Suggest tags that would help organize and find this bookmark later. Tags should be lowercase, single words or short phrases.

        Return only a comma-separated list of tags, no explanations or punctuation beyond commas.
        Example: technology, programming, tutorial
      `;

      const result = await generate(prompt);
      const tags = result.text.split(',').map((tag: string) => tag.trim()).filter(Boolean);
      return tags.slice(0, 4); // Limit to 4 tags
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError);
      throw apiError;
    } finally {
      setIsLoading(false);
    }
  }, [generate]);

  const organizeBookmarks = useCallback(async (
    bookmarks: BookmarkNode[],
    options: any = {}
  ): Promise<{ plan: OrganizationPlan; controller: AbortController; logs: ProcessingLog[] }> => {
    setIsLoading(true);
    setError(null);

    try {
      const organizer = new BookmarkOrganizer(aiConfigs, activeAiConfigId, {
        onProgress: (logs) => {
          // Could emit progress updates here if needed
        }
      });

      const controller = organizer.startOperation();
      const plan = await organizer.organizeBookmarks(bookmarks, options);
      const logs = organizer.getLogs();

      return { plan, controller, logs };
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError);
      throw apiError;
    } finally {
      setIsLoading(false);
    }
  }, [aiConfigs, activeAiConfigId]);

  const applyOrganization = useCallback((
    bookmarks: BookmarkNode[],
    plan: OrganizationPlan,
    options: any = {}
  ): BookmarkNode[] => {
    try {
      return applyOrganizationPlan(bookmarks, plan, options);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError);
      throw apiError;
    }
  }, []);

  return {
    generate,
    streamGenerate,
    improvePrompt,
    testConfig,
    listModels,
    getCategorySuggestion,
    getTagSuggestions,
    organizeBookmarks,
    applyOrganization,
    isLoading,
    error,
  };
};
