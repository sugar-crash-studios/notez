/**
 * Tests for CodeBlockView — the React node view inside CodeBlockExtension.
 *
 * We test the exported `CodeBlockView` component directly rather than going
 * through the full TipTap extension machinery, which requires a real DOM and
 * ProseMirror environment.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { CodeBlockView, LARGE_BLOCK_THRESHOLD, LABEL_PREVIEW_LENGTH } from './CodeBlockExtension';
import type { NodeViewProps } from '@tiptap/react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal NodeViewProps stub. */
function makeProps(overrides: Partial<NodeViewProps> = {}): NodeViewProps {
  return {
    node: { textContent: 'console.log("hello");' } as NodeViewProps['node'],
    editor: null as unknown as NodeViewProps['editor'],
    getPos: vi.fn().mockReturnValue(0),
    decorations: [] as unknown as NodeViewProps['decorations'],
    innerDecorations: [] as unknown as NodeViewProps['innerDecorations'],
    selected: false,
    extension: {} as NodeViewProps['extension'],
    HTMLAttributes: {},
    updateAttributes: vi.fn(),
    deleteNode: vi.fn(),
    view: {} as NodeViewProps['view'],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// NodeViewWrapper and NodeViewContent just render plain wrappers in tests.
vi.mock('@tiptap/react', async (importActual) => {
  const actual = await importActual<typeof import('@tiptap/react')>();
  return {
    ...actual,
    NodeViewWrapper: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div data-testid="node-view-wrapper" {...props}>{children}</div>
    ),
    NodeViewContent: ({ as: Tag = 'div' }: { as?: string }) => (
      <Tag data-testid="node-view-content" />
    ),
  };
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CodeBlockView', () => {
  let writeTextMock: ReturnType<typeof vi.fn>;
  let originalClipboard: Clipboard;

  beforeEach(() => {
    writeTextMock = vi.fn().mockResolvedValue(undefined);
    originalClipboard = navigator.clipboard;
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      configurable: true,
      writable: true,
    });
    vi.clearAllMocks();
  });

  it('renders a Copy button in idle state without aria-disabled', () => {
    render(<CodeBlockView {...makeProps()} />);
    const btn = screen.getByRole('button', { name: /copy code/i });
    expect(btn).toBeInTheDocument();
    // aria-disabled is omitted entirely in idle — aria-disabled="false" would
    // trigger "dimmed" announcements in some AT implementations.
    expect(btn).not.toHaveAttribute('aria-disabled');
  });

  it('shows "Copied!" and announces to screen readers after a successful copy', async () => {
    render(<CodeBlockView {...makeProps()} />);
    const btn = screen.getByRole('button', { name: /copy code/i });

    await act(async () => {
      fireEvent.click(btn);
      await Promise.resolve(); // flush clipboard microtask
    });

    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveTextContent('Copied!');
    });

    expect(screen.getByRole('button')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByTestId('copy-feedback')).toHaveTextContent('Copied to clipboard');
  });

  it('shows "Copy failed" and announces to screen readers after a clipboard error', async () => {
    writeTextMock.mockRejectedValue(new DOMException('NotAllowedError'));

    render(<CodeBlockView {...makeProps()} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /copy code/i }));
      await Promise.resolve(); // let the rejection settle
    });

    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveTextContent('Copy failed');
    });

    expect(screen.getByRole('button')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByTestId('copy-feedback')).toHaveTextContent('Copy failed');
  });

  it('does not write to clipboard and keeps live region empty for an empty block', async () => {
    const props = makeProps({
      node: { textContent: '   ' } as NodeViewProps['node'],
    });

    render(<CodeBlockView {...props} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /copy code/i }));
    });

    expect(writeTextMock).not.toHaveBeenCalled();
    expect(screen.getByRole('button')).toHaveTextContent('Copy');
    // No spurious "Copied to clipboard" announcement should occur.
    expect(screen.getByTestId('copy-feedback')).toHaveTextContent('');
  });

  it('strips bidi/zero-width characters before writing to clipboard', async () => {
    const poisoned = 'safe\u202Ehidden\u200Btext';
    const props = makeProps({
      node: { textContent: poisoned } as NodeViewProps['node'],
    });

    render(<CodeBlockView {...props} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /copy code/i }));
      await Promise.resolve();
    });

    expect(writeTextMock).toHaveBeenCalledWith('safehiddentext');
  });

  it('prevents re-entrancy — second click while active is a no-op', async () => {
    render(<CodeBlockView {...makeProps()} />);
    const btn = screen.getByRole('button', { name: /copy code/i });

    await act(async () => {
      fireEvent.click(btn);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveTextContent('Copied!');
    });

    // Button must carry aria-disabled="true" while active.
    expect(screen.getByRole('button')).toHaveAttribute('aria-disabled', 'true');

    // handleCopy's early-return guard fires — a second click is a no-op.
    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
    });

    expect(writeTextMock).toHaveBeenCalledTimes(1);
  });

  it('reads fresh text from editor state when nodeAt returns a codeBlock', async () => {
    const freshContent = 'fresh content from editor';
    const mockEditor = {
      state: {
        doc: {
          nodeAt: vi.fn().mockReturnValue({
            textContent: freshContent,
            type: { name: 'codeBlock' },
          }),
        },
      },
    };

    const props = makeProps({
      editor: mockEditor as unknown as NodeViewProps['editor'],
      node: { textContent: 'stale content' } as NodeViewProps['node'],
      getPos: vi.fn().mockReturnValue(42),
    });

    render(<CodeBlockView {...props} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /copy code/i }));
      await Promise.resolve();
    });

    expect(writeTextMock).toHaveBeenCalledWith(freshContent);
  });

  it('reads fresh text when getPos() returns 0 (falsy but valid position)', async () => {
    // getPos() === 0 must not be treated as "no position" — 0 is the valid
    // root position in a ProseMirror document.
    const freshContent = 'content at position zero';
    const mockEditor = {
      state: {
        doc: {
          nodeAt: vi.fn().mockReturnValue({
            textContent: freshContent,
            type: { name: 'codeBlock' },
          }),
        },
      },
    };

    const props = makeProps({
      editor: mockEditor as unknown as NodeViewProps['editor'],
      node: { textContent: 'stale content' } as NodeViewProps['node'],
      getPos: vi.fn().mockReturnValue(0),
    });

    render(<CodeBlockView {...props} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /copy code/i }));
      await Promise.resolve();
    });

    expect(writeTextMock).toHaveBeenCalledWith(freshContent);
  });

  it('strips bidi chars from fresh node content when fresh node is used', async () => {
    // Verifies sanitization runs on the fresh node's textContent, not the
    // stale prop — tests the composition of fresh-read + sanitization.
    const poisonedFresh = 'fresh\u202Epoisoned\u200Btext';
    const mockEditor = {
      state: {
        doc: {
          nodeAt: vi.fn().mockReturnValue({
            textContent: poisonedFresh,
            type: { name: 'codeBlock' },
          }),
        },
      },
    };

    const props = makeProps({
      editor: mockEditor as unknown as NodeViewProps['editor'],
      node: { textContent: 'stale content' } as NodeViewProps['node'],
      getPos: vi.fn().mockReturnValue(42),
    });

    render(<CodeBlockView {...props} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /copy code/i }));
      await Promise.resolve();
    });

    expect(writeTextMock).toHaveBeenCalledWith('freshpoisonedtext');
  });

  it('falls back to stale node when nodeAt returns a non-codeBlock node type', async () => {
    // Defensive guard: if the document was restructured between render and click,
    // nodeAt may return a paragraph or other node at the old position.
    const mockEditor = {
      state: {
        doc: {
          nodeAt: vi.fn().mockReturnValue({
            textContent: 'wrong node content',
            type: { name: 'paragraph' },
          }),
        },
      },
    };

    const props = makeProps({
      editor: mockEditor as unknown as NodeViewProps['editor'],
      node: { textContent: 'stale content' } as NodeViewProps['node'],
      getPos: vi.fn().mockReturnValue(42),
    });

    render(<CodeBlockView {...props} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /copy code/i }));
      await Promise.resolve();
    });

    // Must use the stale node's content, not the wrong node's content.
    expect(writeTextMock).toHaveBeenCalledWith('stale content');
  });

  it('falls back to stale node when getPos is not a function', async () => {
    // 42 is a realistic non-function value (e.g., getPos provided as a number
    // rather than a factory in some TipTap internal paths).
    const props = makeProps({
      getPos: 42 as unknown as NodeViewProps['getPos'],
      node: { textContent: 'fallback content' } as NodeViewProps['node'],
    });

    render(<CodeBlockView {...props} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /copy code/i }));
      await Promise.resolve();
    });

    expect(writeTextMock).toHaveBeenCalledWith('fallback content');
  });

  it('shows "Copying…" for large blocks but does NOT announce via live region', async () => {
    // The live region omits 'copying' intentionally — the button label change
    // already conveys the state, and announcing via live region simultaneously
    // causes double-announcement in some AT.
    const largeContent = 'x'.repeat(LARGE_BLOCK_THRESHOLD + 1);
    const props = makeProps({
      node: { textContent: largeContent } as NodeViewProps['node'],
    });

    // Hold the clipboard promise open so we can observe the intermediate state.
    let resolveClipboard!: () => void;
    writeTextMock.mockReturnValue(new Promise<void>(r => { resolveClipboard = r; }));

    render(<CodeBlockView {...props} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /copy code/i }));
    });

    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveTextContent('Copying…');
    });
    expect(screen.getByRole('button')).toHaveAttribute('aria-disabled', 'true');
    // Live region is silent during 'copying' to avoid double-announcement.
    expect(screen.getByTestId('copy-feedback')).toHaveTextContent('');

    // Resolve the write and confirm we transition to 'Copied!'.
    await act(async () => {
      resolveClipboard();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveTextContent('Copied!');
    });
    expect(screen.getByTestId('copy-feedback')).toHaveTextContent('Copied to clipboard');
  });

  it('aria-label contains a sanitized code preview in idle state', () => {
    const content = 'const x = 1;';
    render(<CodeBlockView {...makeProps({ node: { textContent: content } as NodeViewProps['node'] })} />);
    // aria-label in idle includes up to LABEL_PREVIEW_LENGTH chars of code preview.
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-label', `Copy code: ${content}`);
  });

  it('aria-label matches visible button text in "copied" state', async () => {
    render(<CodeBlockView {...makeProps()} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /copy code/i }));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveTextContent('Copied!');
    });

    // Label must match visible text (WCAG 2.5.3).
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Copied to clipboard');
  });

  it('aria-label matches visible button text in "failed" state', async () => {
    writeTextMock.mockRejectedValue(new DOMException('NotAllowedError'));
    render(<CodeBlockView {...makeProps()} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /copy code/i }));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveTextContent('Copy failed');
    });

    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Copy failed');
  });

  it('aria-label matches visible button text in "copying" state', async () => {
    const largeContent = 'x'.repeat(LARGE_BLOCK_THRESHOLD + 1);
    let resolveClipboard!: () => void;
    writeTextMock.mockReturnValue(new Promise<void>(r => { resolveClipboard = r; }));

    render(<CodeBlockView {...makeProps({ node: { textContent: largeContent } as NodeViewProps['node'] })} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /copy code/i }));
    });

    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveTextContent('Copying…');
    });

    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Copying code');

    // Clean up — resolve so the component settles before unmount.
    await act(async () => {
      resolveClipboard();
      await Promise.resolve();
    });
  });

  it('does not call setCopyState after the component unmounts', async () => {
    // Holds the clipboard promise open while we unmount.
    let resolveClipboard!: () => void;
    writeTextMock.mockReturnValue(new Promise<void>(r => { resolveClipboard = r; }));

    const { unmount } = render(<CodeBlockView {...makeProps()} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /copy code/i }));
    });

    // Set up spy BEFORE unmount so it covers the full post-unmount resolution.
    const consoleError = vi.spyOn(console, 'error');

    // Unmount while the clipboard write is still pending.
    unmount();

    // Resolve after unmount — mountedRef guard must suppress setCopyState.
    await act(async () => {
      resolveClipboard();
      await Promise.resolve();
    });

    // No React "state update on unmounted component" warning or similar error.
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  // -------------------------------------------------------------------------
  // Reset timer tests — fake timers scoped to this describe block so they
  // cannot leak into other tests if an assertion throws mid-test.
  // -------------------------------------------------------------------------
  describe('reset timer', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      // Explicitly reset mock implementation in each nested test so that
      // mockRejectedValue set in one test cannot bleed into the next even if
      // test ordering or setup changes.
      writeTextMock.mockResolvedValue(undefined);
    });
    afterEach(() => vi.useRealTimers());

    it('resets to idle 3 s after "Copied!" state', async () => {
      render(<CodeBlockView {...makeProps()} />);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /copy code/i }));
        await Promise.resolve(); // flush clipboard microtask (unaffected by fake timers)
      });

      // Confirm terminal state before advancing time.
      expect(screen.getByRole('button')).toHaveTextContent('Copied!');

      await act(async () => {
        vi.advanceTimersByTime(3100);
      });

      expect(screen.getByRole('button')).toHaveTextContent('Copy');
    });

    it('resets to idle 3 s after "Copy failed" state', async () => {
      writeTextMock.mockRejectedValue(new DOMException('NotAllowedError'));

      render(<CodeBlockView {...makeProps()} />);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /copy code/i }));
        await Promise.resolve();
      });

      expect(screen.getByRole('button')).toHaveTextContent('Copy failed');

      await act(async () => {
        vi.advanceTimersByTime(3100);
      });

      expect(screen.getByRole('button')).toHaveTextContent('Copy');
    });

    it('transitions "copying" to "failed" after 10 s if clipboard promise never settles', async () => {
      // Simulate a frozen clipboard permission dialog — the promise never resolves.
      writeTextMock.mockReturnValue(new Promise<void>(() => {}));

      const largeContent = 'x'.repeat(LARGE_BLOCK_THRESHOLD + 1);
      render(<CodeBlockView {...makeProps({ node: { textContent: largeContent } as NodeViewProps['node'] })} />);

      // setCopyState('copying') fires synchronously (before the first await in
      // handleCopy). act() flushes that batch — no waitFor needed, which would
      // deadlock when timers are faked.
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /copy code/i }));
      });

      expect(screen.getByRole('button')).toHaveTextContent('Copying…');

      // Safety timeout fires after 10 s.
      await act(async () => {
        vi.advanceTimersByTime(10_100);
      });

      expect(screen.getByRole('button')).toHaveTextContent('Copy failed');
    });
  });
});
