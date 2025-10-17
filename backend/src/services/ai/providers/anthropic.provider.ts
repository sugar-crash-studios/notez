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

  async listModels(): Promise<Array<{ id: string; name: string; description?: string }>> {
    try {
      // Fetch models from Anthropic API
      const apiKey = this.client.apiKey || '';
      const response = await fetch('https://api.anthropic.com/v1/models', {
        method: 'GET',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }

      const data: any = await response.json();

      // Transform API response to our format
      return data.data.map((model: any) => ({
        id: model.id,
        name: model.display_name || model.id,
        description: model.created_at ? `Released ${new Date(model.created_at).toLocaleDateString()}` : undefined,
      }));
    } catch (error: any) {
      // If fetching fails, return hardcoded list of current models as fallback
      console.warn('Failed to fetch Anthropic models, using fallback list:', error.message);
      return [
        { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5', description: 'Most capable model (Sep 2025)' },
        { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', description: 'Fast and efficient (Oct 2025)' },
        { id: 'claude-opus-4-1-20250805', name: 'Claude Opus 4.1', description: 'Previous flagship (Aug 2025)' },
        { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: 'Previous generation (Oct 2024)' },
        { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', description: 'Previous generation (Oct 2024)' },
      ];
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
