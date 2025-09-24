import { AiConfig, GenerativeModel } from '../../../types';
import { fetchWithRetry, handleApiResponse, createApiError } from '../fetchWrapper';

export function createAnthropicModel(cfg: AiConfig): GenerativeModel {
  return {
    id: cfg.id,
    provider: 'anthropic',

    async generateContent(prompt: string, opts: any = {}) {
      const url = cfg.baseURL || 'https://api.anthropic.com/v1/messages';
      const apiKey = cfg.apiKey;

      if (!apiKey) {
        throw createApiError('AUTH_ERROR', 'Anthropic API key is required', 'anthropic');
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      };

      const body = {
        model: cfg.modelId,
        max_tokens: opts.maxTokens || 1000,
        messages: [{ role: 'user', content: prompt }],
        temperature: opts.temperature || 0.7,
        ...opts,
      };

      try {
        const response = await fetchWithRetry(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });

        handleApiResponse(response, 'anthropic');

        const data = await response.json();

        if (!data.content?.[0]?.text) {
          throw createApiError('PARSE_ERROR', 'Invalid response format from Anthropic', 'anthropic', response.status, data);
        }

        return {
          text: data.content[0].text.trim(),
          raw: data,
        };
      } catch (error) {
        if (error instanceof Error && 'code' in error) {
          throw error;
        }
        throw createApiError('NETWORK_ERROR', error instanceof Error ? error.message : 'Unknown error', 'anthropic');
      }
    },

    // Streaming not implemented yet
    async streamGenerate(prompt: string, opts: any, onDelta: (delta: string) => void) {
      throw createApiError('PROVIDER_ERROR', 'Streaming not supported for Anthropic yet', 'anthropic');
    },
  };
}
