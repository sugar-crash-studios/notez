import { Mark, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

export interface WikiLinkOptions {
  HTMLAttributes: Record<string, unknown>;
  onWikiLinkClick?: (keyword: string) => void;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    wikiLink: {
      /**
       * Set a wiki link mark
       */
      setWikiLink: (attributes: { keyword: string }) => ReturnType;
      /**
       * Toggle a wiki link mark
       */
      toggleWikiLink: (attributes: { keyword: string }) => ReturnType;
      /**
       * Unset a wiki link mark
       */
      unsetWikiLink: () => ReturnType;
    };
  }
}

/**
 * WikiLink Extension for TipTap
 *
 * Enables [[keyword]] syntax for creating wiki-style links between notes.
 *
 * Features:
 * - Input rule: Typing [[keyword]] creates a wiki link
 * - Styled distinctly from regular links
 * - Clickable to show references
 */
export const WikiLink = Mark.create<WikiLinkOptions>({
  name: 'wikiLink',

  priority: 1000,

  addOptions() {
    return {
      HTMLAttributes: {
        class: 'wiki-link',
        'data-wiki-link': '',
      },
      onWikiLinkClick: undefined,
    };
  },

  addAttributes() {
    return {
      keyword: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-keyword'),
        renderHTML: (attributes) => {
          if (!attributes.keyword) {
            return {};
          }
          return {
            'data-keyword': attributes.keyword,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-wiki-link]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setWikiLink:
        (attributes) =>
        ({ commands }) => {
          return commands.setMark(this.name, attributes);
        },
      toggleWikiLink:
        (attributes) =>
        ({ commands }) => {
          return commands.toggleMark(this.name, attributes);
        },
      unsetWikiLink:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
    };
  },

  addProseMirrorPlugins() {
    const { onWikiLinkClick } = this.options;

    return [
      new Plugin({
        key: new PluginKey('wikiLinkClick'),
        props: {
          handleClick(_view, _pos, event) {
            const target = event.target as HTMLElement;

            // Check if clicked on a wiki link
            if (target.hasAttribute('data-wiki-link')) {
              const keyword = target.getAttribute('data-keyword');
              if (keyword && onWikiLinkClick) {
                event.preventDefault();
                onWikiLinkClick(keyword);
                return true;
              }
            }

            return false;
          },
        },
      }),
      // Input rule plugin for [[keyword]] syntax
      new Plugin({
        key: new PluginKey('wikiLinkInput'),
        props: {
          handleTextInput(view, from, to, text) {
            // Check if we just typed ]]
            if (text !== ']') return false;

            const { state } = view;
            const $from = state.doc.resolve(from);
            const textBefore = $from.parent.textContent.slice(0, $from.parentOffset);

            // Look for [[ pattern
            const match = textBefore.match(/\[\[([^\]]+)$/);
            if (!match) return false;

            const keyword = match[1];
            const start = from - match[0].length;
            const end = to + 1; // Include the second ]

            // Check if next char will complete ]]
            const textAfter = $from.parent.textContent.slice($from.parentOffset);
            if (!textAfter.startsWith(']')) {
              // Need to wait for second ]
              return false;
            }

            // Replace [[keyword]] with styled wiki link
            const tr = state.tr;

            // Delete the [[keyword]] text
            tr.delete(start, end);

            // Insert the wiki link node
            const wikiLinkMark = state.schema.marks.wikiLink.create({ keyword });
            const textNode = state.schema.text(`[[${keyword}]]`, [wikiLinkMark]);
            tr.insert(start, textNode);

            view.dispatch(tr);
            return true;
          },
        },
      }),
    ];
  },
});

/**
 * CSS styles for wiki links (add to TiptapEditor.css)
 */
export const wikiLinkStyles = `
.wiki-link {
  color: #6366f1;
  background-color: rgba(99, 102, 241, 0.1);
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
  cursor: pointer;
  text-decoration: none;
  font-weight: 500;
  transition: background-color 0.15s ease;
}

.wiki-link:hover {
  background-color: rgba(99, 102, 241, 0.2);
  text-decoration: underline;
}

.dark .wiki-link {
  color: #818cf8;
  background-color: rgba(129, 140, 248, 0.15);
}

.dark .wiki-link:hover {
  background-color: rgba(129, 140, 248, 0.25);
}
`;
