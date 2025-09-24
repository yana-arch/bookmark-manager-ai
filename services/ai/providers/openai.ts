import { AiConfig, GenerativeModel } from '../../../types';
import { fetchWithRetry, handleApiResponse, createApiError } from '../fetchWrapper';

export function createOpenAiModel(cfg: AiConfig): GenerativeModel {
  return {
    id: cfg.id,
    provider: 'openai',

    async generateContent(prompt: string, opts: any = {}) {
      const url = cfg.baseURL || 'https://api.openai.com/v1/chat/completions';
      const apiKey = cfg.apiKey || process.env.OPENAI_API_KEY;

      if (!apiKey) {
        throw createApiError('AUTH_ERROR', 'OpenAI API key is required', 'openai');
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      };

      // Add Azure-specific headers if needed
      if (cfg.provider === 'azure' && cfg.metadata?.apiVersion) {
        headers['api-version'] = cfg.metadata.apiVersion;
      }

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

        handleApiResponse(response, 'openai');

        const data = await response.json();

        if (!data.choices?.[0]?.message?.content) {
          throw createApiError('PARSE_ERROR', 'Invalid response format from OpenAI', 'openai', response.status, data);
        }

        return {
          text: data.choices[0].message.content.trim(),
          raw: data,
        };
      } catch (error) {
        if (error instanceof Error && 'code' in error) {
          throw error;
        }
        throw createApiError('NETWORK_ERROR', error instanceof Error ? error.message : 'Unknown error', 'openai');
      }
    },

    // Streaming not implemented yet
    async streamGenerate(prompt: string, opts: any, onDelta: (delta: string) => void) {
      throw createApiError('PROVIDER_ERROR', 'Streaming not supported for OpenAI yet', 'openai');
    },
  };
}
