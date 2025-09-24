import { GoogleGenAI } from '@google/genai';
import { AiConfig, GenerativeModel } from '../../../types';
import { createApiError } from '../fetchWrapper';

export function createGeminiModel(cfg: AiConfig): GenerativeModel {
  return {
    id: cfg.id,
    provider: 'gemini',

    async generateContent(prompt: string, opts: any = {}) {
      const apiKey = cfg.apiKey || process.env.API_KEY;

      if (!apiKey) {
        throw createApiError('AUTH_ERROR', 'Gemini API key is required', 'gemini');
      }

      try {
        const ai = new GoogleGenAI({ apiKey });
        const modelToUse = cfg.modelId || 'gemini-1.5-flash';

        const response = await ai.models.generateContent({
          model: modelToUse,
          contents: prompt,
        });

        const text = response.text?.trim();
        if (!text) {
          throw createApiError('PARSE_ERROR', 'No text generated from Gemini', 'gemini', undefined, response);
        }

        return {
          text,
          raw: response,
        };
      } catch (error: any) {
        // Handle Gemini-specific errors
        if (error?.status === 429 || error?.code === 429) {
          // Extract retry delay from error details if available
          let retryDelay = 60; // Default 60 seconds
          try {
            const errorData = JSON.parse(error.message || '{}');
            if (errorData?.error?.details?.[2]?.retryInfo?.retryDelay) {
              const delayStr = errorData.error.details[2].retryInfo.retryDelay;
              // Parse delay like "60s" or "6.454274266s"
              const match = delayStr.match(/(\d+(?:\.\d+)?)s/);
              if (match) {
                retryDelay = parseFloat(match[1]);
              }
            }
          } catch (parseError) {
            // Use default retry delay
          }

          throw createApiError(
            'RATE_LIMIT',
            `Gemini API rate limit exceeded. Retry after ${retryDelay} seconds. Consider upgrading to paid tier.`,
            'gemini',
            429,
            { retryDelay }
          );
        }

        if (error instanceof Error && 'code' in error) {
          throw error;
        }
        throw createApiError('NETWORK_ERROR', error instanceof Error ? error.message : 'Unknown error', 'gemini');
      }
    },

    // Streaming not implemented yet
    async streamGenerate(prompt: string, opts: any, onDelta: (delta: string) => void) {
      throw createApiError('PROVIDER_ERROR', 'Streaming not supported for Gemini yet', 'gemini');
    },
  };
}
