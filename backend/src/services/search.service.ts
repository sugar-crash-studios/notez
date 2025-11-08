import { prisma } from '../lib/db.js';

export interface SearchOptions {
  query: string;
  userId: string;
  folderId?: string;
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  id: string;
  title: string;
  content: string | null;
  folderId: string | null;
  createdAt: Date;
  updatedAt: Date;
  snippet: string;
  rank: number;
  folder?: {
    id: string;
    name: string;
  } | null;
  tags: {
    id: string;
    name: string;
  }[];
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  hasMore: boolean;
}

/**
 * Search Service
 *
 * Provides full-text search functionality using PostgreSQL tsvector
 */
export class SearchService {
  /**
   * Search notes using full-text search
   * @param options Search options
   */
  async searchNotes(options: SearchOptions): Promise<SearchResponse> {
    const { query, userId, folderId, limit = 20, offset = 0 } = options;

    // Sanitize search query for tsquery
    const sanitizedQuery = this.sanitizeSearchQuery(query);

    if (!sanitizedQuery) {
      return {
        results: [],
        total: 0,
        hasMore: false,
      };
    }

    // Build WHERE clause parts
    const folderCondition = folderId ? `AND n.folder_id = '${folderId}'::uuid` : '';

    // Search query with ranking and snippets
    const results = await prisma.$queryRawUnsafe(`
      SELECT
        n.id,
        n.title,
        n.content,
        n.folder_id as "folderId",
        n.created_at as "createdAt",
        n.updated_at as "updatedAt",
        ts_rank(n.search_vector, to_tsquery('english', $1)) as rank,
        ts_headline(
          'english',
          COALESCE(n.content, n.title),
          to_tsquery('english', $1),
          'MaxWords=30, MinWords=15, ShortWord=3, HighlightAll=FALSE, MaxFragments=1'
        ) as snippet
      FROM notes n
      WHERE n.user_id = $2::uuid ${folderCondition}
        AND n.search_vector @@ to_tsquery('english', $1)
        AND n.deleted = false
      ORDER BY rank DESC, n.updated_at DESC
      LIMIT $3
      OFFSET $4
    `, sanitizedQuery, userId, limit, offset) as SearchResult[];

    // Get total count
    const countResult = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) as count
      FROM notes n
      WHERE n.user_id = $1::uuid ${folderCondition}
        AND n.search_vector @@ to_tsquery('english', $2)
        AND n.deleted = false
    `, userId, sanitizedQuery) as [{ count: bigint }];

    const total = Number(countResult[0]?.count || 0);

    // Fetch folder and tag data for all results in a single batch query
    // This prevents N+1 query performance issue
    const noteIds = results.map((r: any) => r.id);
    const notesWithRelations = await prisma.note.findMany({
      where: { id: { in: noteIds } },
      include: {
        folder: {
          select: {
            id: true,
            name: true,
          },
        },
        tags: {
          include: {
            tag: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    // Create a map for O(1) lookup
    const relationsMap = new Map(
      notesWithRelations.map((n: any) => [
        n.id,
        {
          folder: n.folder,
          tags: n.tags.map((nt: any) => nt.tag),
        },
      ])
    );

    // Enrich results with folder and tag data
    const enrichedResults = results.map((result: any) => {
      const relations: any = relationsMap.get(result.id);
      return {
        ...result,
        folder: relations?.folder || null,
        tags: relations?.tags || [],
      };
    });

    return {
      results: enrichedResults,
      total,
      hasMore: offset + limit < total,
    };
  }

  /**
   * Sanitize search query for PostgreSQL tsquery
   * Converts user input to valid tsquery format
   */
  private sanitizeSearchQuery(query: string): string {
    // Remove special characters and trim
    const cleaned = query
      .trim()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ');

    if (!cleaned) {
      return '';
    }

    // Split into words and join with & (AND operator)
    const words = cleaned.split(' ').filter((word) => word.length > 0);

    // Add :* suffix for prefix matching (e.g., "test" matches "testing")
    const tsquery = words.map((word) => `${word}:*`).join(' & ');

    return tsquery;
  }
}

// Export singleton instance
export const searchService = new SearchService();
