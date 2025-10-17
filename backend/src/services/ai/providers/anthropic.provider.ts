import Anthropic from '@anthropic-ai/sdk';
import {
  AIProvider,
  AISummarizeOptions,
  AISuggestTitleOptions,
  AISuggestTagsOptions,
  AIProviderConnectionError,
  AIProviderRateLimitError,
  AIServiceError,
} from '../types';

export class AnthropicProvider implements AIProvider {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model?: string) {
    this.client = new Anthropic({ apiKey });
    this.model = model || 'claude-3-5-sonnet-20241022'; // Default to Sonnet 3.5
  }

  async summarize(options: AISummarizeOptions): Promise<string> {
    const { content, maxLength = 100 } = options;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: `Please provide a concise summary of the following text in approximately ${maxLength} words. Focus on the main ideas and key points:\n\n${content}`,
          },
        ],
      });

      const textBlock = response.content.find((block) => block.type === 'text');
      if (!textBlock || textBlock.type !== 'text') {
        throw new Error('No text response received from Claude');
      }

      return textBlock.text.trim();
    } catch (error: any) {
      this.handleError(error, 'summarize');
      throw error; // TypeScript needs this
    }
  }

  async suggestTitle(options: AISuggestTitleOptions): Promise<string> {
    const { content, maxLength = 60 } = options;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 256,
        messages: [
          {
            role: 'user',
            content: `Based on the following content, suggest a clear and concise title (maximum ${maxLength} characters). Return ONLY the title text, no quotes or extra formatting:\n\n${content}`,
          },
        ],
      });

      const textBlock = response.content.find((block) => block.type === 'text');
      if (!textBlock || textBlock.type !== 'text') {
        throw new Error('No text response received from Claude');
      }

      // Remove any quotes and trim
      const title = textBlock.text.trim().replace(/^["']|["']$/g, '');

      // Truncate if too long
      return title.length > maxLength ? title.substring(0, maxLength).trim() : title;
    } catch (error: any) {
      this.handleError(error, 'suggestTitle');
      throw error; // TypeScript needs this
    }
  }

  async suggestTags(options: AISuggestTagsOptions): Promise<string[]> {
    const { content, maxTags = 5 } = options;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 512,
        messages: [
          {
            role: 'user',
            content: `Based on the following content, suggest up to ${maxTags} relevant tags. Return ONLY the tags as a comma-separated list, no explanations or extra text:\n\n${content}`,
          },
        ],
      });

      const textBlock = response.content.find((block) => block.type === 'text');
      if (!textBlock || textBlock.type !== 'text') {
        throw new Error('No text response received from Claude');
      }

      // Parse comma-separated tags
      const tags = textBlock.text
        .split(',')
        .map((tag) => tag.trim().toLowerCase())
        .filter((tag) => tag.length > 0 && tag.length <= 50) // Filter out empty and too-long tags
        .slice(0, maxTags);

      return tags;
    } catch (error: any) {
      this.handleError(error, 'suggestTags');
      throw error; // TypeScript needs this
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      // Simple test: ask Claude to respond with a specific word
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 10,
        messages: [
          {
            role: 'user',
            content: 'Respond with just the word "OK"',
          },
        ],
      });

      const textBlock = response.content.find((block) => block.type === 'text');
      return textBlock?.type === 'text' && textBlock.text.trim() === 'OK';
    } catch (error: any) {
      this.handleError(error, 'testConnection');
      return false;
    }
  }

  private handleError(error: any, operation: string): never {
    // Check for rate limiting
    if (error.status === 429) {
      throw new AIProviderRateLimitError('anthropic', error);
    }

    // Check for authentication errors
    if (error.status === 401) {
      throw new AIProviderConnectionError('anthropic', error);
    }

    // Check for other API errors
    if (error.status >= 400) {
      throw new AIServiceError(
        `Anthropic API error during ${operation}: ${error.message || 'Unknown error'}`,
        'anthropic',
        error
      );
    }

    // Network or unknown errors
    throw new AIServiceError(
      `Failed to ${operation} with Anthropic: ${error.message || 'Unknown error'}`,
      'anthropic',
      error
    );
  }
}
