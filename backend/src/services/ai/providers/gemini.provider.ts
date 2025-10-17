import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  AIProvider,
  AISummarizeOptions,
  AISuggestTitleOptions,
  AISuggestTagsOptions,
  AIProviderConnectionError,
  AIProviderRateLimitError,
  AIServiceError,
} from '../types';

export class GeminiProvider implements AIProvider {
  private client: GoogleGenerativeAI;
  private model: string;

  constructor(apiKey: string, model?: string) {
    this.client = new GoogleGenerativeAI(apiKey);
    this.model = model || 'gemini-1.5-flash'; // Default to Flash for speed and cost
  }

  async summarize(options: AISummarizeOptions): Promise<string> {
    const { content, maxLength = 100 } = options;

    try {
      const model = this.client.getGenerativeModel({ model: this.model });

      const prompt = `Please provide a concise summary of the following text in approximately ${maxLength} words. Focus on the main ideas and key points:\n\n${content}`;

      const result = await model.generateContent(prompt);
      const response = result.response;
      const summary = response.text().trim();

      if (!summary) {
        throw new Error('No response received from Gemini');
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
      const model = this.client.getGenerativeModel({ model: this.model });

      const prompt = `Based on the following content, suggest a clear and concise title (maximum ${maxLength} characters). Return ONLY the title text, no quotes or extra formatting:\n\n${content}`;

      const result = await model.generateContent(prompt);
      const response = result.response;
      const title = response.text().trim();

      if (!title) {
        throw new Error('No response received from Gemini');
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
    const { content, maxTags = 5 } = options;

    try {
      const model = this.client.getGenerativeModel({ model: this.model });

      const prompt = `Based on the following content, suggest up to ${maxTags} relevant tags. Return ONLY the tags as a comma-separated list, no explanations or extra text:\n\n${content}`;

      const result = await model.generateContent(prompt);
      const response = result.response;
      const tagsText = response.text().trim();

      if (!tagsText) {
        throw new Error('No response received from Gemini');
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
      // Simple test: ask Gemini to respond with a specific word
      const model = this.client.getGenerativeModel({ model: this.model });

      const result = await model.generateContent('Respond with just the word "OK"');
      const response = result.response;
      const text = response.text();

      return text !== undefined && text.trim().length > 0;
    } catch (error: any) {
      this.handleError(error, 'testConnection');
      return false;
    }
  }

  private handleError(error: any, operation: string): never {
    // Check for rate limiting
    if (error.message?.includes('429') || error.message?.includes('RESOURCE_EXHAUSTED')) {
      throw new AIProviderRateLimitError('gemini', error);
    }

    // Check for authentication errors
    if (
      error.message?.includes('401') ||
      error.message?.includes('API key') ||
      error.message?.includes('UNAUTHENTICATED')
    ) {
      throw new AIProviderConnectionError('gemini', error);
    }

    // Check for other API errors
    if (error.message?.includes('4') || error.message?.includes('5')) {
      throw new AIServiceError(
        `Gemini API error during ${operation}: ${error.message || 'Unknown error'}`,
        'gemini',
        error
      );
    }

    // Network or unknown errors
    throw new AIServiceError(
      `Failed to ${operation} with Gemini: ${error.message || 'Unknown error'}`,
      'gemini',
      error
    );
  }
}
