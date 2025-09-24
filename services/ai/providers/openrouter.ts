import { AiConfig, GenerativeModel } from '../../../types';
import { fetchWithRetry, handleApiResponse, createApiError } from '../fetchWrapper';

export function createOpenRouterModel(cfg: AiConfig): GenerativeModel {
  return {
    id: cfg.id,
    provider: 'openrouter',

    async generateContent(prompt: string, opts: any = {}) {
      const url = cfg.baseURL || 'https://openrouter.ai/api/v1/chat/completions';
      const apiKey = cfg.apiKey;

      if (!apiKey) {
        throw createApiError('AUTH_ERROR', 'OpenRouter API key is required', 'openrouter');
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'app://promptcraft',
        'X-Title': 'PromptCraft',
      };

      const body = {
        model: cfg.modelId,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: opts.maxTokens || 1000,
        temperature: opts.temperature || 0.7,
        ...opts,
      };

      try {
        const response = await fetchWithRetry(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });

        handleApiResponse(response, 'openrouter');

        const data = await response.json();

        if (!data.choices?.[0]?.message?.content) {
          throw createApiError('PARSE_ERROR', 'Invalid response format from OpenRouter', 'openrouter', response.status, data);
        }

        return {
          text: data.choices[0].message.content.trim(),
          raw: data,
        };
      } catch (error) {
        if (error instanceof Error && 'code' in error) {
          throw error;
        }
        throw createApiError('NETWORK_ERROR', error instanceof Error ? error.message : 'Unknown error', 'openrouter');
      }
    },

    // Streaming not implemented yet
    async streamGenerate(prompt: string, opts: any, onDelta: (delta: string) => void) {
      throw createApiError('PROVIDER_ERROR', 'Streaming not supported for OpenRouter yet', 'openrouter');
    },
  };
}
