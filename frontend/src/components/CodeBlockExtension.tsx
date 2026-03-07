import { useState, useEffect, useRef } from 'react';
import CodeBlock from '@tiptap/extension-code-block';
import { NodeViewWrapper, NodeViewContent, ReactNodeViewRenderer } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { Copy } from 'lucide-react';

// Strips characters that can make clipboard content visually differ from what
// is displayed, enabling pastejacking attacks. Covers:
//   • Zero-width / direction-control: U+200B–200F, U+202A–202E, U+2066–2069, U+FEFF
//   • Variation selectors (BMP):      U+FE00–FE0F
//   • Line / paragraph separators:    U+2028, U+2029  (JS line terminators in terminals)
//   • Interlinear annotation:         U+FFF9–FFFB
//   • Tag characters (SMP):           U+E0000–E007F  (invisible, survive textContent reads)
//   • Variation selectors (SMP):      U+E0100–E01EF
// The `u` flag is required for the \u{…} supplementary-plane escapes.
// CAUTION: the `g` flag makes this a stateful regex. Only use with .replace() —
// never pass to .test() or .exec(), which advance lastIndex and corrupt subsequent calls.
const UNSAFE_UNICODE_RE =
  /[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF\uFE00-\uFE0F\u2028\u2029\uFFF9-\uFFFB\u{E0000}-\u{E007F}\u{E0100}-\u{E01EF}]/gu;

type CopyState = 'idle' | 'copying' | 'copied' | 'failed';

// Typed over non-idle states only — adding a new CopyState without a CSS class
// is a compile error, not a silent runtime miss.
const BTN_STATE_CLASS: Record<Exclude<CopyState, 'idle'>, string> = {
  copying: 'code-block-copy-btn--copying',
  copied:  'code-block-copy-btn--copied',
  failed:  'code-block-copy-btn--failed',
};

/** Characters of code included in the button's accessible label to distinguish
 *  identically-named "Copy code" buttons when multiple code blocks are present.
 *  Exported so tests can assert the exact truncation boundary. */
export const LABEL_PREVIEW_LENGTH = 40;

/** Show a visible "Copying…" state for blocks above this threshold so the user
 *  knows the synchronous textContent traversal has completed and the clipboard
 *  write is in progress. Exported so tests can reference the same value. */
export const LARGE_BLOCK_THRESHOLD = 100_000;

export function CodeBlockView({ node, getPos, editor }: NodeViewProps) {
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const mountedRef = useRef(true);

  // Track mount state to guard async setCopyState calls — the clipboard promise
  // may resolve after the component has unmounted (e.g., user navigates away
  // mid-copy of a large block).
  // `mountedRef.current = true` is set in the effect body (not only at useRef)
  // so that React 18 Strict Mode's double-invoke (mount → cleanup → remount)
  // re-arms the guard on the second mount instead of leaving it permanently false.
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Reset to idle 3 s after a terminal state. 3 s gives screen readers enough
  // time to complete a "Copied to clipboard" announcement before the live region
  // is cleared — 2 s was insufficient for busy documents with queued AT speech.
  useEffect(() => {
    if (copyState !== 'copied' && copyState !== 'failed') return;
    const id = setTimeout(() => {
      if (mountedRef.current) setCopyState('idle');
    }, 3000);
    return () => clearTimeout(id);
  }, [copyState]);

  // Safety timeout for the 'copying' state — some browsers freeze the clipboard
  // permission dialog indefinitely, leaving the promise unresolved. After 10 s,
  // transition to 'failed' so the button is not permanently inert.
  useEffect(() => {
    if (copyState !== 'copying') return;
    const id = setTimeout(() => {
      if (mountedRef.current) setCopyState('failed');
    }, 10_000);
    return () => clearTimeout(id);
  }, [copyState]);

  const handleCopy = async () => {
    // Prevent re-entrancy — only one copy in flight at a time.
    if (copyState !== 'idle') return;

    // Read fresh text from editor state at click time, bypassing the stale
    // `node` prop. ProseMirror replaces `node` by reference on every
    // transaction, so the prop may be one render frame behind in collab mode.
    const pos = typeof getPos === 'function' ? getPos() : undefined;
    const rawFresh = pos !== undefined && editor
      ? editor.state.doc.nodeAt(pos)
      : null;
    // Guard: nodeAt() can return a non-codeBlock node when the document is
    // restructured between render and click (common in collaborative editing).
    // Copying the wrong node's textContent would silently write the wrong data.
    const freshNode = rawFresh?.type.name === 'codeBlock' ? rawFresh : null;
    const text = (freshNode ?? node).textContent;

    // Don't transition to 'copying'/'copied' for an empty block — misleading.
    if (!text.trim()) return;

    // Strip pastejacking characters before writing to clipboard.
    const sanitized = text.replace(UNSAFE_UNICODE_RE, '');

    // Guard: if the block contained *only* sanitizable characters (e.g., pure
    // zero-width spaces that pass .trim()), sanitized is now "". Writing "" to
    // the clipboard and showing "Copied!" would be misleading.
    if (!sanitized.trim()) return;

    // Show a loading indicator for very large blocks so the user knows the
    // synchronous textContent traversal has completed and the write is pending.
    if (text.length > LARGE_BLOCK_THRESHOLD) {
      setCopyState('copying');
    }

    try {
      await navigator.clipboard.writeText(sanitized);
      if (mountedRef.current) setCopyState('copied');
    } catch (err) {
      if (import.meta.env.DEV) console.warn('Clipboard write failed:', err);
      if (mountedRef.current) setCopyState('failed');
    }
  };

  const stateClass = copyState !== 'idle' ? ` ${BTN_STATE_CLASS[copyState]}` : '';
  const isActive = copyState !== 'idle';

  // Dynamic accessible label satisfies WCAG 2.5.3 (Label in Name) — the label
  // contains the visible text for every state. A sanitized preview in idle also
  // distinguishes buttons when multiple code blocks are present on the page.
  const codePreview = node.textContent
    .replace(UNSAFE_UNICODE_RE, '')
    .slice(0, LABEL_PREVIEW_LENGTH)
    .replace(/\s+/g, ' ')
    .trim();
  const ariaLabel =
    copyState === 'copied'  ? 'Copied to clipboard' :
    copyState === 'failed'  ? 'Copy failed' :
    copyState === 'copying' ? 'Copying code' :
    codePreview ? `Copy code: ${codePreview}` : 'Copy code';

  // In terminal states show a text label; in idle show icon + "Copy".
  const buttonContent =
    copyState === 'copied'  ? 'Copied!' :
    copyState === 'failed'  ? 'Copy failed' :
    copyState === 'copying' ? 'Copying…' :
    <><Copy size={12} aria-hidden="true" /><span>Copy</span></>;

  return (
    <NodeViewWrapper className="code-block-wrapper">
      {/* pre/code block comes first in DOM order so keyboard users encounter
          the code content before the copy action in the tab sequence. The
          button is repositioned visually to top-right via position:absolute. */}
      <pre>
        <NodeViewContent<'code'> as="code" />
      </pre>
      {/* aria-disabled={isActive || undefined} omits the attribute entirely in
          idle state — aria-disabled="false" is spec-valid but triggers "dimmed"
          announcements in some AT implementations. During active states,
          aria-disabled="true" keeps the button in the AT tree while signalling
          it is not operable. Keyboard re-entrancy is handled by the JS guard in
          handleCopy; pointer-events:none in CSS handles mouse. */}
      <button
        type="button"
        className={`code-block-copy-btn${stateClass}`}
        onClick={handleCopy}
        aria-disabled={isActive || undefined}
        aria-label={ariaLabel}
      >
        {buttonContent}
      </button>
      {/* Proactive screen-reader announcement for terminal state changes.
          aria-relevant="additions" suppresses VoiceOver's re-evaluation when
          the region is cleared back to "" on idle — we only want AT to announce
          when text is added, not when it is removed.
          'copying' is omitted intentionally: the button label change conveys
          that state visually and some AT would double-announce if the live
          region fired simultaneously. */}
      <span
        aria-live="polite"
        aria-relevant="additions"
        data-testid="copy-feedback"
        className="sr-only"
      >
        {copyState === 'copied' ? 'Copied to clipboard' :
         copyState === 'failed' ? 'Copy failed' : ''}
      </span>
    </NodeViewWrapper>
  );
}

/**
 * Extends TipTap's built-in CodeBlock with a React node view that adds
 * a "Copy" button in the top-right corner of each code block.
 *
 * Usage: add this to getBaseExtensions() and pass `codeBlock: false`
 * to StarterKit to prevent the built-in from registering.
 *
 * Upgrade note: when syntax highlighting is added, this extension must be
 * refactored to extend `@tiptap/extension-code-block-lowlight` instead of
 * `@tiptap/extension-code-block`. CodeBlockLowlight has a different
 * constructor, different options (lowlight, defaultLanguage), and registers
 * an additional ProseMirror decoration plugin. See docs/known-issues.md.
 */
export const CodeBlockExtension = CodeBlock.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView);
  },
});
