# Bookmark Manager AI
# CLOSED - NOT RECOMMEND USE/CLONE THIS, USE THIS INSTEAD OF THIS => [HERE](https://github.com/yana-arch/ai-bookmark-architect)

A modern bookmark management application with AI-powered organization features.

## Features

- **Import/Export Bookmarks**: Support for HTML bookmark files
- **AI-Powered Organization**: Automatically categorize and organize bookmarks using various AI providers
- **Multiple AI Providers**: Support for OpenAI, Google Gemini, Anthropic Claude, OpenRouter, Azure OpenAI, Grok, Ollama, and custom providers
- **Flexible Configuration**: Easy setup and management of multiple AI provider configurations
- **Real-time Testing**: Test API connections before saving configurations
- **Persistent Storage**: Local storage for bookmarks and AI configurations

## AI Provider Support

### Supported Providers

1. **Google Gemini** - Uses official Google GenAI SDK
2. **OpenAI** - Full OpenAI API compatibility
3. **Anthropic Claude** - Official Claude API support
4. **OpenRouter** - Unified API for multiple models
5. **Azure OpenAI** - Microsoft Azure OpenAI service
6. **Grok (xAI)** - xAI's Grok model
7. **Ollama** - Local Ollama server support
8. **Custom** - Any OpenAI-compatible API endpoint

### Configuration

Each provider can be configured with:
- Custom name for easy identification
- API key (when required)
- Base URL (for custom or Azure configurations)
- Model ID selection
- Connection testing before saving

## Architecture

### Core Components

```
src/
├── types.ts                      # TypeScript interfaces and types
├── constants.tsx                 # Provider definitions and constants
├── context/
│   └── AiConfigContext.tsx       # React context for AI configuration state
├── hooks/
│   └── useAiApi.ts               # Main AI API hook
├── services/
│   └── ai/
│       ├── modelFactory.ts       # Factory for creating AI model instances
│       ├── fetchWrapper.ts       # HTTP client with retry logic
│       └── providers/            # Individual provider implementations
│           ├── gemini.ts
│           ├── openai.ts
│           ├── openrouter.ts
│           ├── anthropic.ts
│           └── ollama.ts
└── components/
    └── modals/
        └── AiConfigModal.tsx     # AI configuration management UI
```

### Key Features

- **Modular Provider System**: Each AI provider is implemented as a separate module
- **Unified Interface**: All providers implement the same `GenerativeModel` interface
- **Error Handling**: Comprehensive error handling with specific error codes
- **Retry Logic**: Automatic retries for transient failures
- **State Management**: React Context for global AI configuration state
- **Persistent Storage**: localStorage for configuration persistence

## Getting Started

1. **Clone the repository**
   ```bash
   git clone https://github.com/yana-arch/bookmark-manager-ai.git
   cd bookmark-manager-ai
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables** (optional)
   Create a `.env.local` file for default API keys:
   ```
   API_KEY=your_gemini_api_key_here
   OPENAI_API_KEY=your_openai_api_key_here
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:3000`

## Usage

### Importing Bookmarks

1. Export your bookmarks from your browser as an HTML file
2. Click "Import" in the application
3. Select the exported HTML file
4. Your bookmarks will be parsed and displayed

### AI Organization

1. **Configure AI Provider**
   - Click the settings icon in the header
   - Add a new AI configuration
   - Select your preferred provider
   - Enter API credentials
   - Test the connection
   - Save the configuration

2. **Organize Bookmarks**
   - Click "AI Classify All" to organize all bookmarks
   - Or use "AI Classify" on individual folders
   - The AI will analyze bookmark titles and URLs
   - Bookmarks will be moved to appropriate categories

### Managing Configurations

- **Multiple Configurations**: Set up multiple AI providers for different use cases
- **Active Configuration**: Switch between configurations easily
- **Testing**: Verify API connections before use
- **Security**: API keys are stored locally and not transmitted unnecessarily

## API Reference

### useAiApi Hook

```typescript
const {
  generate,           // Generate text with AI
  streamGenerate,     // Stream generation (future)
  improvePrompt,      // Improve prompt writing
  testConfig,         // Test API configuration
  listModels,         // List available models
  getCategorySuggestion, // Get category for bookmark
  getTagSuggestions,  // Get tags for bookmark
  isLoading,          // Loading state
  error               // Error state
} = useAiApi();
```

### AiConfig Interface

```typescript
interface AiConfig {
  id: string;
  name: string;
  provider: ProviderName;
  baseURL?: string;
  apiKey?: string;
  modelId: string;
  metadata?: Record<string, any>;
  isDefault?: boolean;
  createdAt?: string;
}
```

## Error Handling

The system provides comprehensive error handling with specific error codes:

- `NETWORK_ERROR` - Network connectivity issues
- `AUTH_ERROR` - Authentication failures (401/403)
- `ENDPOINT_NOT_FOUND` - Invalid API endpoints (404)
- `RATE_LIMIT` - Rate limiting (429)
- `PARSE_ERROR` - Response parsing failures
- `PROVIDER_ERROR` - Provider-specific errors

## Security Considerations

- API keys are stored in browser localStorage
- No server-side storage of sensitive credentials
- HTTPS recommended for production deployments
- Consider encrypting stored API keys for enhanced security

## Development

### Adding New Providers

1. Create a new provider file in `services/ai/providers/`
2. Implement the `GenerativeModel` interface
3. Add provider definition to `constants.tsx`
4. Update `modelFactory.ts` to include the new provider

### Testing

```bash
# Run tests
npm test

# Run development server
npm run dev

# Build for production
npm run build
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Built with React, TypeScript, and Vite
- AI provider integrations using official SDKs where available
- Inspired by modern bookmark management tools
