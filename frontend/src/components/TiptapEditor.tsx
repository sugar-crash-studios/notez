import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import { useEffect, useRef } from 'react';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import { marked } from 'marked';
import './TiptapEditor.css';

interface TiptapEditorProps {
  content: string;
  onChange: (content: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

// Initialize turndown service for HTML to Markdown conversion
const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  emDelimiter: '*',
  strongDelimiter: '**',
  bulletListMarker: '-',
});

// Custom rule for task items (MUST come before GFM to take priority)
turndownService.addRule('taskListItems', {
  filter: (node) => {
    // Check for task items by data-type attribute OR by presence of checkbox input
    if (node.nodeName === 'LI') {
      // Check if it has data-type="taskItem"
      if (node.hasAttribute('data-type') && node.getAttribute('data-type') === 'taskItem') {
        return true;
      }
      // Also check if it contains a checkbox input (fallback)
      const hasCheckbox = node.querySelector('input[type="checkbox"]');
      if (hasCheckbox) {
        return true;
      }
    }
    return false;
  },
  replacement: (content, node: any) => {
    // Try to get checked state from data-checked attribute
    let isChecked = node.getAttribute('data-checked') === 'true';

    // Fallback: check for checkbox input element
    const checkbox = node.querySelector('input[type="checkbox"]');
    if (checkbox) {
      isChecked = checkbox.hasAttribute('checked') || checkbox.checked;
    }

    // Clean up the content - remove checkbox elements that might be in the text
    const cleanContent = content
      .replace(/<input[^>]*>/g, '')
      .replace(/<label[^>]*>.*?<\/label>/g, '')
      .trim();

    return `- [${isChecked ? 'x' : ' '}] ${cleanContent}\n`;
  },
});

// Add GFM (GitHub Flavored Markdown) support for task lists
// This comes AFTER our custom rule so our rule takes priority
turndownService.use(gfm);

// Configure marked to handle task lists
marked.use({
  gfm: true,
  breaks: true,
  extensions: [
    {
      name: 'taskListItem',
      level: 'block',
      start(src: string) {
        return src.match(/^- \[(x| )\]/)?.index;
      },
      tokenizer(src: string) {
        const match = /^- \[(x| )\] (.+?)(?:\n|$)/.exec(src);
        if (match) {
          return {
            type: 'taskListItem',
            raw: match[0],
            checked: match[1] === 'x',
            text: match[2],
          };
        }
      },
      renderer(token: any) {
        return `<li data-type="taskItem" data-checked="${token.checked}"><label><input type="checkbox" ${token.checked ? 'checked' : ''}><span></span></label><div><p>${token.text}</p></div></li>`;
      },
    },
  ],
});

// Convert markdown to HTML for Tiptap
function markdownToHTML(markdown: string): string {
  if (!markdown) return '<p></p>';

  try {
    // Use marked to parse markdown to HTML
    let html = marked.parse(markdown, { async: false }) as string;

    // Post-process to handle task lists that marked might not catch
    // Make <p> tags optional as a group to handle all list item variations

    // First handle escaped brackets \[ \] (common when copying markdown)
    html = html.replace(/<li>(?:<p>)?\s*\\\[\s*x\s*\\\]\s*(.*?)(?:<\/p>)?<\/li>/gi, (_match, text) => {
      return `<li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked><span></span></label><div><p>${text.trim()}</p></div></li>`;
    });

    html = html.replace(/<li>(?:<p>)?\s*\\\[\s*\\\]\s*(.*?)(?:<\/p>)?<\/li>/gi, (_match, text) => {
      return `<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>${text.trim()}</p></div></li>`;
    });

    // Then handle normal brackets [ ]
    html = html.replace(/<li>(?:<p>)?\s*\[\s*x\s*\]\s*(.*?)(?:<\/p>)?<\/li>/gi, (_match, text) => {
      return `<li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked><span></span></label><div><p>${text.trim()}</p></div></li>`;
    });

    html = html.replace(/<li>(?:<p>)?\s*\[\s*\]\s*(.*?)(?:<\/p>)?<\/li>/gi, (_match, text) => {
      return `<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>${text.trim()}</p></div></li>`;
    });

    // Wrap task list items in ul with task-list class
    html = html.replace(/(<li data-type="taskItem".*?<\/li>\s*)+/gs, (match) => {
      return `<ul data-type="taskList" class="task-list">${match}</ul>`;
    });

    return html;
  } catch (error) {
    // Log error without exposing sensitive content
    console.error('Error parsing markdown');
    return `<p>${markdown}</p>`;
  }
}

export function TiptapEditor({ content, onChange, disabled = false, placeholder = 'Start writing...' }: TiptapEditorProps) {
  const isUpdatingFromProp = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4, 5, 6],
        },
        // Disable link from StarterKit to avoid duplicate with our explicit Link extension
        link: false,
      }),
      TaskList.configure({
        HTMLAttributes: {
          class: 'task-list',
        },
      }),
      TaskItem.configure({
        nested: true,
        HTMLAttributes: {
          class: 'task-item',
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'tiptap-link',
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      Typography,
    ],
    content: markdownToHTML(content),
    editable: !disabled,
    onUpdate: ({ editor }) => {
      if (isUpdatingFromProp.current) return;

      // Convert HTML back to markdown
      const html = editor.getHTML();
      const markdown = turndownService.turndown(html);
      onChange(markdown);
    },
    editorProps: {
      attributes: {
        class: 'tiptap-editor prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-full px-4 py-3',
      },
    },
  });

  // Update editor content when prop changes (e.g., switching notes)
  useEffect(() => {
    if (editor && content !== undefined) {
      const html = editor.getHTML();
      const currentMarkdown = turndownService.turndown(html);

      // Only update if content actually changed
      if (currentMarkdown !== content) {
        isUpdatingFromProp.current = true;
        editor.commands.setContent(markdownToHTML(content));
        setTimeout(() => {
          isUpdatingFromProp.current = false;
        }, 100);
      }
    }
  }, [content, editor]);

  // Update editable state when disabled prop changes
  useEffect(() => {
    if (editor) {
      editor.setEditable(!disabled);
    }
  }, [disabled, editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className="tiptap-wrapper h-full overflow-y-auto">
      <EditorContent editor={editor} />
    </div>
  );
}
