import { AiConfig, GenerativeModel, ProviderName } from '../../types';
import { PREDEFINED_BASE_URLS } from '../../constants';

// Import provider creators
import { createOpenAiModel } from './providers/openai';
import { createGeminiModel } from './providers/gemini';
import { createOpenRouterModel } from './providers/openrouter';
import { createAnthropicModel } from './providers/anthropic';
import { createOllamaModel } from './providers/ollama';

export function getGenerativeModel(
  configs: AiConfig[],
  activeId?: string,
  specificId?: string
): GenerativeModel {
  const idToUse = specificId ?? activeId ?? configs.find(c => c.isDefault)?.id ?? configs[0]?.id;

  if (!idToUse) {
    throw new Error('No AiConfig available');
  }

  const cfg = configs.find(c => c.id === idToUse);
  if (!cfg) {
    throw new Error(`AiConfig with id ${idToUse} not found`);
  }

  // Ensure baseURL is set for providers that require it
  if (!cfg.baseURL) {
    cfg.baseURL = PREDEFINED_BASE_URLS[cfg.provider];
  }

  switch (cfg.provider) {
    case 'openai':
      return createOpenAiModel(cfg);
    case 'gemini':
      return createGeminiModel(cfg);
    case 'openrouter':
      return createOpenRouterModel(cfg);
    case 'anthropic':
      return createAnthropicModel(cfg);
    case 'ollama':
      return createOllamaModel(cfg);
    case 'azure':
      // Azure uses OpenAI-compatible API
      return createOpenAiModel(cfg);
    case 'grok':
      // Grok uses OpenAI-compatible API
      return createOpenAiModel(cfg);
    case 'custom':
      // Custom defaults to OpenAI-compatible
      return createOpenAiModel(cfg);
    default:
      throw new Error(`Unsupported provider: ${cfg.provider}`);
  }
}
