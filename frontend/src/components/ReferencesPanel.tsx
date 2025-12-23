import { useState, useEffect } from 'react';
import { X, Link2, FileText, Loader2 } from 'lucide-react';
import { referencesApi } from '../lib/api';

interface ReferenceNote {
  id: string;
  title: string;
  snippet: string;
  mentionCount: number;
  updatedAt: string;
  folder: { id: string; name: string } | null;
}

interface ReferencesResult {
  keyword: string;
  notes: ReferenceNote[];
  total: number;
}

interface ReferencesPanelProps {
  keyword: string;
  onClose: () => void;
  onNoteClick: (noteId: string) => void;
}

export function ReferencesPanel({ keyword, onClose, onNoteClick }: ReferencesPanelProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReferencesResult | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function fetchReferences() {
      setLoading(true);
      setError(null);

      try {
        const response = await referencesApi.findByKeyword(keyword);
        if (!isCancelled) {
          setResult(response.data);
        }
      } catch (err) {
        console.error('Failed to fetch references:', err);
        if (!isCancelled) {
          setError('Failed to load references');
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    fetchReferences();

    return () => {
      isCancelled = true;
    };
  }, [keyword]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-indigo-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              References: "{keyword}"
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
              <span className="ml-2 text-gray-500 dark:text-gray-400">Loading references...</span>
            </div>
          )}

          {error && (
            <div className="text-center py-8 text-red-500">
              {error}
            </div>
          )}

          {!loading && !error && result && (
            <>
              {result.notes.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No notes found linking to "{keyword}"</p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Found in {result.total} note{result.total !== 1 ? 's' : ''}
                  </p>
                  <div className="space-y-3">
                    {result.notes.map((note) => (
                      <button
                        key={note.id}
                        onClick={() => {
                          onNoteClick(note.id);
                          onClose();
                        }}
                        className="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-medium text-gray-900 dark:text-white truncate">
                            {note.title}
                          </h3>
                          <span className="text-xs text-gray-400 whitespace-nowrap">
                            {note.mentionCount}x
                          </span>
                        </div>
                        {note.folder && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {note.folder.name}
                          </p>
                        )}
                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 line-clamp-2">
                          {note.snippet}
                        </p>
                        <p className="text-xs text-gray-400 mt-2">
                          {formatDate(note.updatedAt)}
                        </p>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
