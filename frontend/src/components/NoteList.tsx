import { useState, useEffect } from 'react';
import { notesApi } from '../lib/api';
import { FileText, Plus, Search } from 'lucide-react';

interface Note {
  id: string;
  title: string;
  content: string | null;
  createdAt: string;
  updatedAt: string;
  folder: { id: string; name: string } | null;
  tags: Array<{ id: string; name: string }>;
}

interface NoteListProps {
  folderId: string | null;
  tagId: string | null;
  selectedNoteId: string | null;
  onSelectNote: (noteId: string) => void;
}

export function NoteList({ folderId, tagId, selectedNoteId, onSelectNote }: NoteListProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadNotes();
  }, [folderId, tagId, searchQuery]);

  const loadNotes = async () => {
    setIsLoading(true);
    try {
      const params: any = { limit: 100 };
      if (folderId) {
        params.folderId = folderId;
      }
      if (tagId) {
        params.tagId = tagId;
      }
      if (searchQuery) {
        params.search = searchQuery;
      }

      const response = await notesApi.list(params);
      setNotes(response.data.notes);
    } catch (error) {
      console.error('Failed to load notes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadNotes();
  };

  const handleCreateNote = async () => {
    try {
      const response = await notesApi.create({
        title: 'Untitled Note',
        content: '',
        folderId: folderId || undefined,
      });
      const newNote = response.data.note;
      setNotes([newNote, ...notes]);
      onSelectNote(newNote.id);
    } catch (error) {
      console.error('Failed to create note:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Notes</h2>
          <button
            onClick={handleCreateNote}
            className="p-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            title="New note"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notes..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </form>
      </div>

      {/* Notes List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="px-4 py-8 text-center text-sm text-gray-500">Loading...</div>
        ) : notes.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-500">
            No notes yet. Click + to create one!
          </div>
        ) : (
          notes.map((note) => (
            <button
              key={note.id}
              onClick={() => onSelectNote(note.id)}
              className={`w-full px-4 py-3 border-b border-gray-100 hover:bg-gray-50 text-left ${
                selectedNoteId === note.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
              }`}
            >
              <div className="flex items-start space-x-2">
                <FileText className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-gray-900 truncate">{note.title}</h3>
                  {note.content && (
                    <p className="text-xs text-gray-600 line-clamp-2 mt-1">
                      {note.content.substring(0, 100)}
                    </p>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-gray-500">{formatDate(note.updatedAt)}</span>
                    {note.tags.length > 0 && (
                      <div className="flex space-x-1">
                        {note.tags.slice(0, 2).map((tag) => (
                          <span
                            key={tag.id}
                            className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded"
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
