import { prisma } from '../lib/db.js';

/**
 * Regex to match wiki-style links: [[keyword]]
 * Captures the keyword inside the brackets
 */
const WIKI_LINK_REGEX = /\[\[([^\]]+)\]\]/g;

/**
 * Extract all wiki-link keywords from content
 */
export function extractWikiLinks(content: string | null): string[] {
  if (!content) return [];

  const keywords: string[] = [];
  let match;

  // Reset regex state
  WIKI_LINK_REGEX.lastIndex = 0;

  while ((match = WIKI_LINK_REGEX.exec(content)) !== null) {
    const keyword = match[1].trim();
    if (keyword && !keywords.includes(keyword)) {
      keywords.push(keyword);
    }
  }

  return keywords;
}

/**
 * Sync wiki-links for a note
 * Called when a note is created or updated
 */
export async function syncNoteLinks(noteId: string, content: string | null): Promise<void> {
  const keywords = extractWikiLinks(content);

  await prisma.$transaction(async (tx) => {
    // Delete existing links for this note
    await tx.noteLink.deleteMany({
      where: { sourceNoteId: noteId },
    });

    // Create new links
    if (keywords.length > 0) {
      await tx.noteLink.createMany({
        data: keywords.map((keyword) => ({
          sourceNoteId: noteId,
          targetKeyword: keyword,
        })),
        skipDuplicates: true,
      });
    }
  });
}

/**
 * Find all notes that reference a given keyword
 */
export async function findNotesByKeyword(
  userId: string,
  keyword: string,
  options?: { limit?: number; offset?: number }
): Promise<{
  keyword: string;
  notes: Array<{
    id: string;
    title: string;
    snippet: string;
    mentionCount: number;
    updatedAt: Date;
    folder: { id: string; name: string } | null;
  }>;
  total: number;
}> {
  const { limit = 50, offset = 0 } = options || {};

  // Find all notes that contain this keyword as a wiki-link
  const [noteLinks, total] = await Promise.all([
    prisma.noteLink.findMany({
      where: {
        targetKeyword: {
          equals: keyword,
          mode: 'insensitive',
        },
        sourceNote: {
          userId,
          deleted: false,
        },
      },
      include: {
        sourceNote: {
          select: {
            id: true,
            title: true,
            content: true,
            updatedAt: true,
            folder: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      take: limit,
      skip: offset,
      orderBy: {
        sourceNote: {
          updatedAt: 'desc',
        },
      },
    }),
    prisma.noteLink.count({
      where: {
        targetKeyword: {
          equals: keyword,
          mode: 'insensitive',
        },
        sourceNote: {
          userId,
          deleted: false,
        },
      },
    }),
  ]);

  // Transform results
  const notes = noteLinks.map((link) => {
    const note = link.sourceNote;

    // Count mentions of the keyword in the content
    const mentionCount = (note.content?.match(new RegExp(`\\[\\[${escapeRegex(keyword)}\\]\\]`, 'gi')) || []).length;

    // Generate snippet around the first mention
    const snippet = generateSnippet(note.content, keyword);

    return {
      id: note.id,
      title: note.title,
      snippet,
      mentionCount,
      updatedAt: note.updatedAt,
      folder: note.folder,
    };
  });

  return {
    keyword,
    notes,
    total,
  };
}

/**
 * Get backlinks for a specific note
 * Returns notes that link TO this note (by title match)
 */
export async function getBacklinksForNote(
  userId: string,
  noteId: string
): Promise<{
  noteId: string;
  noteTitle: string;
  backlinks: Array<{
    id: string;
    title: string;
    snippet: string;
    updatedAt: Date;
  }>;
  total: number;
}> {
  // First get the note title
  const note = await prisma.note.findFirst({
    where: { id: noteId, userId, deleted: false },
    select: { title: true },
  });

  if (!note) {
    throw new Error('Note not found');
  }

  // Find notes that link to this note's title
  const result = await findNotesByKeyword(userId, note.title);

  // Filter out self-references
  const backlinks = result.notes
    .filter((n) => n.id !== noteId)
    .map((n) => ({
      id: n.id,
      title: n.title,
      snippet: n.snippet,
      updatedAt: n.updatedAt,
    }));

  return {
    noteId,
    noteTitle: note.title,
    backlinks,
    total: backlinks.length,
  };
}

/**
 * Get all unique keywords used in wiki-links by a user
 * Useful for autocomplete
 */
export async function getAllKeywords(userId: string): Promise<string[]> {
  const keywords = await prisma.noteLink.findMany({
    where: {
      sourceNote: {
        userId,
        deleted: false,
      },
    },
    select: {
      targetKeyword: true,
    },
    distinct: ['targetKeyword'],
    orderBy: {
      targetKeyword: 'asc',
    },
  });

  return keywords.map((k) => k.targetKeyword);
}

/**
 * Generate a snippet around the keyword mention
 */
function generateSnippet(content: string | null, keyword: string, maxLength: number = 150): string {
  if (!content) return '';

  // Find the first mention of [[keyword]]
  const pattern = new RegExp(`\\[\\[${escapeRegex(keyword)}\\]\\]`, 'i');
  const match = pattern.exec(content);

  if (!match) {
    // Fallback: return start of content
    return content.substring(0, maxLength) + (content.length > maxLength ? '...' : '');
  }

  const matchIndex = match.index;
  const halfLength = Math.floor(maxLength / 2);

  let start = Math.max(0, matchIndex - halfLength);
  let end = Math.min(content.length, matchIndex + match[0].length + halfLength);

  // Adjust to avoid cutting words
  if (start > 0) {
    const spaceIndex = content.indexOf(' ', start);
    if (spaceIndex !== -1 && spaceIndex < matchIndex) {
      start = spaceIndex + 1;
    }
  }

  if (end < content.length) {
    const spaceIndex = content.lastIndexOf(' ', end);
    if (spaceIndex !== -1 && spaceIndex > matchIndex + match[0].length) {
      end = spaceIndex;
    }
  }

  let snippet = content.substring(start, end);

  // Add ellipsis
  if (start > 0) snippet = '...' + snippet;
  if (end < content.length) snippet = snippet + '...';

  return snippet;
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
