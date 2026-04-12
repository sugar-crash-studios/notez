/**
 * Strip HTML tags, decode common entities, and collapse whitespace.
 * Used for AI consumption of note content (MCP tools, search).
 * Removes script/style blocks entirely (content + tags) to prevent leaking code.
 */
export function htmlToPlainText(html: string): string {
  return html
    // Remove script and style blocks entirely (content + tags)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    // Strip remaining tags
    .replace(/<[^>]*>/g, ' ')
    // Decode common HTML entities
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();
}
