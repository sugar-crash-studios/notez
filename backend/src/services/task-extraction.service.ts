import { prisma } from '../lib/db.js';
import { JSDOM } from 'jsdom';

/**
 * Extract tasks from note content (HTML or Markdown)
 * Supports both Tiptap HTML and markdown formats
 */
export interface ExtractedTask {
  noteId: string;
  noteTitle: string;
  title: string;
  checked: boolean;
  folderId?: string | null;
}

/**
 * Parse HTML content from Tiptap editor to extract task items
 */
function extractTasksFromHTML(html: string): Array<{ title: string; checked: boolean }> {
  const tasks: Array<{ title: string; checked: boolean }> = [];

  try {
    const dom = new JSDOM(html);
    const document = dom.window.document;

    // Find all task items (Tiptap uses <li data-type="taskItem">)
    const taskItems = document.querySelectorAll('li[data-type="taskItem"]');

    taskItems.forEach((item) => {
      const checkbox = item.querySelector('input[type="checkbox"]');
      if (checkbox) {
        const checked = checkbox.hasAttribute('checked');
        // Get text content, excluding the checkbox
        const label = item.querySelector('label');
        const title = label?.textContent?.trim() || '';

        if (title) {
          tasks.push({ title, checked });
        }
      }
    });
  } catch (error) {
    console.error('Error parsing HTML for tasks:', error);
  }

  return tasks;
}

/**
 * Parse markdown content to extract task items
 */
function extractTasksFromMarkdown(markdown: string): Array<{ title: string; checked: boolean }> {
  const tasks: Array<{ title: string; checked: boolean }> = [];

  // Regex to match task list items: - [ ] or - [x]
  const taskRegex = /^[\s]*[-*]\s+\[([ xX])\]\s+(.+)$/gm;

  let match;
  while ((match = taskRegex.exec(markdown)) !== null) {
    const checked = match[1].toLowerCase() === 'x';
    const title = match[2].trim();

    if (title) {
      tasks.push({ title, checked });
    }
  }

  return tasks;
}

/**
 * Extract tasks from a single note's content
 */
export function extractTasksFromNote(
  noteId: string,
  noteTitle: string,
  content: string,
  folderId?: string | null
): ExtractedTask[] {
  let tasks: Array<{ title: string; checked: boolean }> = [];

  // Try HTML parsing first (Tiptap saves as HTML)
  tasks = extractTasksFromHTML(content);

  // If no tasks found in HTML, try markdown as fallback
  if (tasks.length === 0) {
    tasks = extractTasksFromMarkdown(content);
  }

  // Filter out completed tasks (we only want unchecked tasks)
  return tasks
    .filter((task) => !task.checked)
    .map((task) => ({
      noteId,
      noteTitle,
      title: task.title,
      checked: task.checked,
      folderId,
    }));
}

/**
 * Scan all notes for a user and extract unchecked tasks
 */
export async function scanNotesForTasks(
  userId: string,
  options?: {
    folderId?: string;
    noteIds?: string[];
  }
): Promise<ExtractedTask[]> {
  const { folderId, noteIds } = options || {};

  // Build where clause
  const where: any = {
    userId,
    deleted: false,
  };

  if (folderId !== undefined) {
    where.folderId = folderId;
  }

  if (noteIds && noteIds.length > 0) {
    where.id = { in: noteIds };
  }

  // Fetch notes
  const notes = await prisma.note.findMany({
    where,
    select: {
      id: true,
      title: true,
      content: true,
      folderId: true,
    },
  });

  // Extract tasks from each note
  const allTasks: ExtractedTask[] = [];

  for (const note of notes) {
    if (note.content) {
      const tasks = extractTasksFromNote(note.id, note.title, note.content, note.folderId);
      allTasks.push(...tasks);
    }
  }

  return allTasks;
}

/**
 * Import extracted tasks as Task records
 */
export async function importTasksFromNotes(
  userId: string,
  extractedTasks: ExtractedTask[]
): Promise<any[]> {
  // Use a transaction to ensure all tasks are created atomically
  return prisma.$transaction(async (tx: any) => {
    const createdTasks = [];

    for (const task of extractedTasks) {
      const createdTask = await tx.task.create({
        data: {
          userId,
          title: task.title,
          status: 'PENDING',
          priority: 'MEDIUM',
          noteId: task.noteId,
          noteTitle: task.noteTitle,
          folderId: task.folderId,
        },
        include: {
          folder: {
            select: {
              id: true,
              name: true,
            },
          },
          note: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      });

      createdTasks.push(createdTask);
    }

    return createdTasks;
  });
}
