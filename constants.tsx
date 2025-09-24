import { ProviderName } from './types';

export const PREDEFINED_BASE_URLS: Record<ProviderName, string> = {
  openai: 'https://api.openai.com/v1/chat/completions',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/models/',
  anthropic: 'https://api.anthropic.com/v1/messages',
  grok: 'https://api.x.ai/v1/chat/completions',
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
  azure: 'https://your-resource-name.openai.azure.com/openai/deployments/your-deployment-name/chat/completions',
  ollama: 'http://localhost:11434/api/generate',
  custom: '',
};

export const PROVIDER_DEFINITIONS: Record<ProviderName, {
  name: string;
  defaultModelId: string;
  requiresApiKey: boolean;
  requiresBaseURL: boolean;
  note?: string;
}> = {
  openai: {
    name: 'OpenAI',
    defaultModelId: 'gpt-3.5-turbo',
    requiresApiKey: true,
    requiresBaseURL: false,
  },
  gemini: {
    name: 'Google Gemini',
    defaultModelId: 'gemini-1.5-flash',
    requiresApiKey: true,
    requiresBaseURL: false,
    note: 'Free tier has rate limits. Consider upgrading to paid tier for higher limits.',
  },
  anthropic: {
    name: 'Anthropic Claude',
    defaultModelId: 'claude-3-haiku-20240307',
    requiresApiKey: true,
    requiresBaseURL: false,
  },
  grok: {
    name: 'Grok (xAI)',
    defaultModelId: 'grok-beta',
    requiresApiKey: true,
    requiresBaseURL: false,
  },
  openrouter: {
    name: 'OpenRouter',
    defaultModelId: 'anthropic/claude-3-haiku',
    requiresApiKey: true,
    requiresBaseURL: false,
    note: 'Requires HTTP-Referer and X-Title headers. Set to app://promptcraft and PromptCraft respectively.',
  },
  azure: {
    name: 'Azure OpenAI',
    defaultModelId: 'gpt-35-turbo',
    requiresApiKey: true,
    requiresBaseURL: true,
    note: 'Replace "your-resource-name" and "your-deployment-name" with your actual Azure resource details. Include apiVersion in metadata.',
  },
  ollama: {
    name: 'Local Ollama',
    defaultModelId: 'llama2',
    requiresApiKey: false,
    requiresBaseURL: true,
    note: 'Ensure Ollama is running locally on port 11434.',
  },
  custom: {
    name: 'Custom URL',
    defaultModelId: '',
    requiresApiKey: true,
    requiresBaseURL: true,
    note: 'Provide your own base URL and ensure compatibility with OpenAI-style API.',
  },
};
