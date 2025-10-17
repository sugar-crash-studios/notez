// AI Provider Types and Interfaces

export type AIProviderType = 'anthropic' | 'openai' | 'gemini';

export interface AIProviderConfig {
  provider: AIProviderType;
  apiKey: string;
  model?: string; // Optional model override
}

export interface AISummarizeOptions {
  content: string;
  maxLength?: number; // Target summary length in words
}

export interface AISuggestTitleOptions {
  content: string;
  maxLength?: number; // Max title length in characters
}

export interface AISuggestTagsOptions {
  content: string;
  maxTags?: number; // Max number of tags to return
}

/**
 * AI Provider Interface
 *
 * All AI providers must implement this interface to ensure consistent behavior
 * across different AI services (Anthropic Claude, OpenAI, Google Gemini).
 */
export interface AIProvider {
  /**
   * Generate a concise summary of the given content
   * @param options Summarization options including content and max length
   * @returns Summary text
   */
  summarize(options: AISummarizeOptions): Promise<string>;

  /**
   * Suggest a title based on the content
   * @param options Title suggestion options including content
   * @returns Suggested title
   */
  suggestTitle(options: AISuggestTitleOptions): Promise<string>;

  /**
   * Extract and suggest relevant tags from the content
   * @param options Tag suggestion options including content
   * @returns Array of suggested tag names
   */
  suggestTags(options: AISuggestTagsOptions): Promise<string[]>;

  /**
   * Test the API connection with the provider
   * @returns True if connection is successful, throws error otherwise
   */
  testConnection(): Promise<boolean>;
}

/**
 * AI Service Error Types
 */
export class AIServiceError extends Error {
  constructor(
    message: string,
    public provider: AIProviderType,
    public originalError?: unknown
  ) {
    super(message);
    this.name = 'AIServiceError';
  }
}

export class AIProviderNotConfiguredError extends Error {
  constructor() {
    super('AI provider is not configured. Please configure your AI settings to use AI features.');
    this.name = 'AIProviderNotConfiguredError';
  }
}

export class AIProviderConnectionError extends AIServiceError {
  constructor(provider: AIProviderType, originalError?: unknown) {
    super(`Failed to connect to ${provider} AI provider`, provider, originalError);
    this.name = 'AIProviderConnectionError';
  }
}

export class AIProviderRateLimitError extends AIServiceError {
  constructor(provider: AIProviderType, originalError?: unknown) {
    super(`Rate limit exceeded for ${provider} AI provider`, provider, originalError);
    this.name = 'AIProviderRateLimitError';
  }
}
