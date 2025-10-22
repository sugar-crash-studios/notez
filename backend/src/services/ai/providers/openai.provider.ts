import OpenAI from 'openai';
import {
  AIProvider,
  AISummarizeOptions,
  AISuggestTitleOptions,
  AISuggestTagsOptions,
  AIProviderConnectionError,
  AIProviderRateLimitError,
  AIServiceError,
} from '../types.js';

export class OpenAIProvider implements AIProvider {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model?: string) {
    this.client = new OpenAI({ apiKey });
    this.model = model || 'gpt-4o-mini'; // Default to GPT-4o-mini for cost efficiency
  }

  async summarize(options: AISummarizeOptions): Promise<string> {
    const { content, maxLength = 100 } = options;

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: 1024,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that creates concise summaries.',
          },
          {
            role: 'user',
            content: `Please provide a concise summary of the following text in approximately ${maxLength} words. Focus on the main ideas and key points:\n\n${content}`,
          },
        ],
        temperature: 0.3, // Lower temperature for more consistent summaries
      });

      const summary = response.choices[0]?.message?.content?.trim();
      if (!summary) {
        throw new Error('No response received from OpenAI');
      }

      return summary;
    } catch (error: any) {
      this.handleError(error, 'summarize');
      throw error; // TypeScript needs this
    }
  }

  async suggestTitle(options: AISuggestTitleOptions): Promise<string> {
    const { content, maxLength = 60 } = options;

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: 256,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that suggests clear and concise titles.',
          },
          {
            role: 'user',
            content: `Based on the following content, suggest a clear and concise title (maximum ${maxLength} characters). Return ONLY the title text, no quotes or extra formatting:\n\n${content}`,
          },
        ],
        temperature: 0.5,
      });

      const title = response.choices[0]?.message?.content?.trim();
      if (!title) {
        throw new Error('No response received from OpenAI');
      }

      // Remove any quotes and trim
      const cleanTitle = title.replace(/^["']|["']$/g, '');

      // Truncate if too long
      return cleanTitle.length > maxLength
        ? cleanTitle.substring(0, maxLength).trim()
        : cleanTitle;
    } catch (error: any) {
      this.handleError(error, 'suggestTitle');
      throw error; // TypeScript needs this
    }
  }

  async suggestTags(options: AISuggestTagsOptions): Promise<string[]> {
    const { content, maxTags = 5, existingTags = [] } = options;

    // Build the user prompt with context about existing tags
    let userPrompt = `Based on the following content, suggest up to ${maxTags} relevant tags.`;

    if (existingTags.length > 0) {
      userPrompt += `\n\nIMPORTANT: The user already has these tags: ${existingTags.join(', ')}`;
      userPrompt += `\nPlease PREFER using existing tags when they are relevant to the content. Only create new tags if none of the existing tags are appropriate.`;
    }

    userPrompt += `\n\nReturn ONLY the tags as a comma-separated list, no explanations or extra text:\n\n${content}`;

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: 512,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that suggests relevant tags for content. When existing tags are provided, prefer reusing them over creating new ones.',
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        temperature: 0.4,
      });

      const tagsText = response.choices[0]?.message?.content?.trim();
      if (!tagsText) {
        throw new Error('No response received from OpenAI');
      }

      // Parse comma-separated tags
      const tags = tagsText
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
      // Simple test: ask GPT to respond with a specific word
      const response = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: 10,
        messages: [
          {
            role: 'user',
            content: 'Respond with just the word "OK"',
          },
        ],
      });

      return response.choices[0]?.message?.content?.trim() === 'OK';
    } catch (error: any) {
      this.handleError(error, 'testConnection');
      return false;
    }
  }

  async listModels(): Promise<Array<{ id: string; name: string; description?: string }>> {
    try {
      // OpenAI has a native models endpoint
      const models = await this.client.models.list();

      // Filter to only show GPT models (exclude deprecated and non-chat models)
      const gptModels = [];
      for await (const model of models) {
        if (model.id.startsWith('gpt-')) {
          gptModels.push({
            id: model.id,
            name: model.id.toUpperCase().replace(/-/g, ' '),
            description: model.created ? `Created ${new Date(model.created * 1000).toLocaleDateString()}` : undefined,
          });
        }
      }

      // Sort by ID descending (newest first)
      return gptModels.sort((a, b) => b.id.localeCompare(a.id));
    } catch (error: any) {
      // If fetching fails, return hardcoded list as fallback
      console.warn('Failed to fetch OpenAI models, using fallback list:', error.message);
      return [
        { id: 'gpt-4o', name: 'GPT-4o', description: 'Most capable GPT-4 model' },
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast and cost-effective' },
        { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'Fast GPT-4 variant' },
        { id: 'gpt-4', name: 'GPT-4', description: 'Standard GPT-4' },
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Fast and economical' },
      ];
    }
  }

  private handleError(error: any, operation: string): never {
    // Check for rate limiting
    if (error.status === 429) {
      throw new AIProviderRateLimitError('openai', error);
    }

    // Check for authentication errors
    if (error.status === 401) {
      throw new AIProviderConnectionError('openai', error);
    }

    // Check for other API errors
    if (error.status >= 400) {
      throw new AIServiceError(
        `OpenAI API error during ${operation}: ${error.message || 'Unknown error'}`,
        'openai',
        error
      );
    }

    // Network or unknown errors
    throw new AIServiceError(
      `Failed to ${operation} with OpenAI: ${error.message || 'Unknown error'}`,
      'openai',
      error
    );
  }
}
