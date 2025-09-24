import { AiConfig, GenerativeModel } from '../../../types';
import { fetchWithRetry, handleApiResponse, createApiError } from '../fetchWrapper';

export function createOllamaModel(cfg: AiConfig): GenerativeModel {
  return {
    id: cfg.id,
    provider: 'ollama',

    async generateContent(prompt: string, opts: any = {}) {
      const url = cfg.baseURL || 'http://localhost:11434/api/generate';

      const body = {
        model: cfg.modelId,
        prompt: prompt,
        stream: false,
        options: {
          temperature: opts.temperature || 0.7,
          num_predict: opts.maxTokens || 1000,
          ...opts,
        },
      };

      try {
        const response = await fetchWithRetry(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        handleApiResponse(response, 'ollama');

        const data = await response.json();

        if (!data.response) {
          throw createApiError('PARSE_ERROR', 'Invalid response format from Ollama', 'ollama', response.status, data);
        }

        return {
          text: data.response.trim(),
          raw: data,
        };
      } catch (error) {
        if (error instanceof Error && 'code' in error) {
          throw error;
        }
        throw createApiError('NETWORK_ERROR', error instanceof Error ? error.message : 'Unknown error', 'ollama');
      }
    },

    // Streaming not implemented yet
    async streamGenerate(prompt: string, opts: any, onDelta: (delta: string) => void) {
      throw createApiError('PROVIDER_ERROR', 'Streaming not supported for Ollama yet', 'ollama');
    },
  };
}
