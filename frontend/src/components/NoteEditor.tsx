import { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { notesApi, aiApi } from '../lib/api';
import { Save, Trash2, Sparkles, FileText as FileTextIcon, Tags } from 'lucide-react';
import { TagInput } from './TagInput';

interface Note {
  id: string;
  title: string;
  content: string | null;
  createdAt: string;
  updatedAt: string;
  folder: { id: string; name: string } | null;
  tags: Array<{ id: string; name: string }>;
}

interface NoteEditorProps {
  noteId: string | null;
  onNoteDeleted: () => void;
}

export function NoteEditor({ noteId, onNoteDeleted }: NoteEditorProps) {
  const [note, setNote] = useState<Note | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<Array<{ id: string; name: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [aiLoading, setAiLoading] = useState<'summarize' | 'title' | 'tags' | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load note when noteId changes
  useEffect(() => {
    if (noteId) {
      loadNote(noteId);
    } else {
      setNote(null);
      setTitle('');
      setContent('');
      setTags([]);
    }
  }, [noteId]);

  // Auto-save when content changes
  useEffect(() => {
    if (!note) return;

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout for auto-save (2 seconds after last change)
    saveTimeoutRef.current = setTimeout(() => {
      saveNote();
    }, 2000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [title, content, tags]);

  const loadNote = async (id: string) => {
    setIsLoading(true);
    try {
      const response = await notesApi.get(id);
      const loadedNote = response.data.note;
      setNote(loadedNote);
      setTitle(loadedNote.title);
      setContent(loadedNote.content || '');
      setTags(loadedNote.tags || []);
      setLastSaved(new Date(loadedNote.updatedAt));
    } catch (error) {
      console.error('Failed to load note:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveNote = async () => {
    if (!note || isSaving) return; // Prevent concurrent saves

    const currentTagNames = tags.map((t) => t.name);
    const noteTagNames = (note.tags || []).map((t) => t.name);
    const tagsChanged = JSON.stringify(currentTagNames.sort()) !== JSON.stringify(noteTagNames.sort());

    if (title === note.title && content === (note.content || '') && !tagsChanged) return;

    setIsSaving(true);
    try {
      const response = await notesApi.update(note.id, {
        title,
        content,
        tags: currentTagNames,
      });
      const updatedNote = response.data.note;
      setLastSaved(new Date(updatedNote.updatedAt));
      // Update local state with canonical data from server (important for tag IDs)
      setNote(updatedNote);
      setTitle(updatedNote.title);
      setContent(updatedNote.content || '');
      setTags(updatedNote.tags || []);
    } catch (error) {
      console.error('Failed to save note:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteNote = async () => {
    if (!note) return;
    if (!confirm(`Delete "${note.title}"?`)) return;

    try {
      await notesApi.delete(note.id);
      onNoteDeleted();
    } catch (error) {
      console.error('Failed to delete note:', error);
      alert('Failed to delete note');
    }
  };

  const handleManualSave = () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveNote();
  };

  const handleAISummarize = async () => {
    if (!content.trim()) {
      setAiError('Please add some content to summarize');
      return;
    }

    setAiLoading('summarize');
    setAiError(null);

    try {
      const response = await aiApi.summarize({ content });
      const summary = response.data.summary;

      // Insert summary at the beginning of content
      const newContent = `**AI Summary:**\n${summary}\n\n---\n\n${content}`;
      setContent(newContent);
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'Failed to generate summary';
      setAiError(errorMsg);
    } finally {
      setAiLoading(null);
    }
  };

  const handleAISuggestTitle = async () => {
    if (!content.trim()) {
      setAiError('Please add some content to generate a title');
      return;
    }

    setAiLoading('title');
    setAiError(null);

    try {
      const response = await aiApi.suggestTitle({ content });
      const suggestedTitle = response.data.title;

      // Only set if title is empty or user confirms
      if (!title.trim()) {
        setTitle(suggestedTitle);
      } else {
        if (confirm(`Replace current title with: "${suggestedTitle}"?`)) {
          setTitle(suggestedTitle);
        }
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'Failed to suggest title';
      setAiError(errorMsg);
    } finally {
      setAiLoading(null);
    }
  };

  const handleAISuggestTags = async () => {
    if (!content.trim()) {
      setAiError('Please add some content to suggest tags');
      return;
    }

    setAiLoading('tags');
    setAiError(null);

    try {
      const response = await aiApi.suggestTags({ content });
      const suggestedTags = response.data.tags;

      // Merge with existing tags (avoid duplicates)
      const existingTagNames = tags.map((t) => t.name.toLowerCase());
      const newTagObjects = suggestedTags
        .filter((tagName: string) => !existingTagNames.includes(tagName.toLowerCase()))
        .map((tagName: string) => ({ id: '', name: tagName }));

      if (newTagObjects.length > 0) {
        setTags([...tags, ...newTagObjects]);
      } else {
        setAiError('All suggested tags are already added');
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'Failed to suggest tags';
      setAiError(errorMsg);
    } finally {
      setAiLoading(null);
    }
  };

  if (!noteId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No note selected</h3>
          <p className="text-gray-500">Select a note or create a new one to get started</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Loading note...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* Editor Header */}
      <div className="px-6 py-4 border-b border-gray-200 space-y-3">
        <div className="flex items-center justify-between">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1 text-2xl font-bold text-gray-900 focus:outline-none"
            placeholder="Untitled Note"
          />
          <div className="flex items-center space-x-3 ml-4">
            {/* Save Status */}
            <div className="flex items-center space-x-2">
              {isSaving ? (
                <span className="text-sm text-gray-500">Saving...</span>
              ) : lastSaved ? (
                <span className="text-sm text-gray-500">
                  Saved {formatSaveTime(lastSaved)}
                </span>
              ) : null}
              <button
                onClick={handleManualSave}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md"
                title="Save now (Ctrl+S)"
              >
                <Save className="w-4 h-4" />
              </button>
            </div>

            {/* Delete Button */}
            <button
              onClick={handleDeleteNote}
              className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md"
              title="Delete note"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tags */}
        <TagInput
          tags={tags}
          onChange={(tagNames) => {
            // Convert tag names to tag objects, preserving existing IDs
            const newTags = tagNames.map((name) => {
              const existing = tags.find((t) => t.name === name);
              return existing || { id: '', name };
            });
            setTags(newTags);
          }}
        />

        {/* AI Actions */}
        <div className="flex items-center space-x-2 pt-2">
          <Sparkles className="w-4 h-4 text-purple-600" />
          <span className="text-sm font-medium text-gray-700">AI Actions:</span>

          <button
            onClick={handleAISummarize}
            disabled={!content.trim() || aiLoading === 'summarize'}
            className="px-3 py-1 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
            title="Generate summary and add to beginning of note"
          >
            {aiLoading === 'summarize' ? (
              <>
                <span className="inline-block animate-spin">⏳</span>
                <span>Summarizing...</span>
              </>
            ) : (
              <>
                <FileTextIcon className="w-3 h-3" />
                <span>Summarize</span>
              </>
            )}
          </button>

          <button
            onClick={handleAISuggestTitle}
            disabled={!content.trim() || aiLoading === 'title'}
            className="px-3 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
            title="Suggest a title based on content"
          >
            {aiLoading === 'title' ? (
              <>
                <span className="inline-block animate-spin">⏳</span>
                <span>Generating...</span>
              </>
            ) : (
              <>
                <FileTextIcon className="w-3 h-3" />
                <span>Suggest Title</span>
              </>
            )}
          </button>

          <button
            onClick={handleAISuggestTags}
            disabled={!content.trim() || aiLoading === 'tags'}
            className="px-3 py-1 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
            title="Suggest relevant tags"
          >
            {aiLoading === 'tags' ? (
              <>
                <span className="inline-block animate-spin">⏳</span>
                <span>Suggesting...</span>
              </>
            ) : (
              <>
                <Tags className="w-3 h-3" />
                <span>Suggest Tags</span>
              </>
            )}
          </button>

          {aiError && (
            <span className="text-xs text-red-600">{aiError}</span>
          )}
        </div>
      </div>

      {/* Monaco Editor */}
      <div className="flex-1 overflow-hidden">
        <Editor
          height="100%"
          defaultLanguage="markdown"
          value={content}
          onChange={(value) => setContent(value || '')}
          theme="vs-light"
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: 'off',
            wordWrap: 'on',
            padding: { top: 16, bottom: 16 },
            scrollBeyondLastLine: false,
            renderLineHighlight: 'none',
            overviewRulerBorder: false,
            hideCursorInOverviewRuler: true,
          }}
        />
      </div>
    </div>
  );
}

// Helper function
function FileText({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}

function formatSaveTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);

  if (diffSecs < 10) return 'just now';
  if (diffSecs < 60) return `${diffSecs}s ago`;
  if (diffMins < 60) return `${diffMins}m ago`;
  return date.toLocaleTimeString();
}
