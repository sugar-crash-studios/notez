import { useState, useEffect } from 'react';
import CodeBlock from '@tiptap/extension-code-block';
import { NodeViewWrapper, NodeViewContent, ReactNodeViewRenderer } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';

type CopyState = 'idle' | 'copied' | 'failed';

function CodeBlockView({ node }: NodeViewProps) {
  const [copyState, setCopyState] = useState<CopyState>('idle');

  // Clear the feedback state after 2s; clean up timer on unmount.
  useEffect(() => {
    if (copyState === 'idle') return;
    const id = setTimeout(() => setCopyState('idle'), 2000);
    return () => clearTimeout(id);
  }, [copyState]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(node.textContent);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  };

  const label = copyState === 'copied' ? 'Copied!' : copyState === 'failed' ? 'Failed' : 'Copy';
  const ariaLabel =
    copyState === 'copied' ? 'Copied to clipboard' :
    copyState === 'failed' ? 'Copy failed' :
    'Copy code';

  return (
    <NodeViewWrapper className="code-block-wrapper">
      <button
        className={`code-block-copy-btn${copyState !== 'idle' ? ` ${copyState}` : ''}`}
        onClick={handleCopy}
        aria-label={ariaLabel}
        contentEditable={false}
      >
        {label}
      </button>
      {/* Screen reader announcement — not announced reliably via aria-label alone */}
      <span aria-live="polite" className="sr-only">
        {copyState === 'copied' ? 'Copied to clipboard' : copyState === 'failed' ? 'Copy failed' : ''}
      </span>
      <pre>
        <NodeViewContent<'code'> as="code" />
      </pre>
    </NodeViewWrapper>
  );
}

/**
 * Extends TipTap's built-in CodeBlock with a React node view that adds
 * a "Copy" button in the top-right corner of each code block.
 *
 * Usage: add this to getBaseExtensions() and pass `codeBlock: false`
 * to StarterKit to prevent the built-in from registering.
 */
export const CodeBlockExtension = CodeBlock.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView);
  },
});
