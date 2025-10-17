import { useState, useEffect, useRef } from 'react';
import { Search, X, FileText, Loader2 } from 'lucide-react';
import { searchApi } from '../lib/api';
import { useNavigate } from 'react-router-dom';
import DOMPurify from 'dompurify';

interface SearchResult {
  id: string;
  title: string;
  content: string | null;
  snippet: string;
  folder: {
    id: string;
    name: string;
  } | null;
  tags: {
    id: string;
    name: string;
  }[];
}

export function SearchBar() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close search on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearching(true);
        setError(null);
        const response = await searchApi.search({ q: query, limit: 10 });
        setResults(response.data.results);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Search failed');
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const handleResultClick = (noteId: string) => {
    setIsOpen(false);
    setQuery('');
    setResults([]);
    // Navigate to note (assuming we'll add this functionality)
    navigate(`/?note=${noteId}`);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setError(null);
  };

  return (
    <div ref={searchRef} className="relative">
      {/* Search Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
        title="Search notes (Ctrl+K)"
      >
        <Search className="w-5 h-5" />
      </button>

      {/* Search Overlay */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
          {/* Search Input */}
          <div className="p-3 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search notes..."
                className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {query && (
                <button
                  onClick={handleClear}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Results */}
          <div className="max-h-96 overflow-y-auto">
            {isSearching ? (
              <div className="p-8 text-center">
                <Loader2 className="w-6 h-6 text-blue-600 animate-spin mx-auto" />
                <p className="text-sm text-gray-600 mt-2">Searching...</p>
              </div>
            ) : error ? (
              <div className="p-8 text-center">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            ) : results.length > 0 ? (
              <div className="py-2">
                {results.map((result) => (
                  <button
                    key={result.id}
                    onClick={() => handleResultClick(result.id)}
                    className="w-full px-4 py-3 hover:bg-gray-50 text-left transition-colors border-b border-gray-100 last:border-b-0"
                  >
                    <div className="flex items-start space-x-3">
                      <FileText className="w-4 h-4 text-gray-400 mt-1 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-gray-900 truncate">
                          {result.title}
                        </h4>
                        {result.snippet && (
                          <p
                            className="text-xs text-gray-600 mt-1 line-clamp-2"
                            dangerouslySetInnerHTML={{
                              __html: DOMPurify.sanitize(result.snippet, {
                                ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'mark'],
                                ALLOWED_ATTR: []
                              })
                            }}
                          />
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          {result.folder && (
                            <span className="text-xs text-gray-500">
                              📁 {result.folder.name}
                            </span>
                          )}
                          {result.tags.length > 0 && (
                            <div className="flex gap-1">
                              {result.tags.slice(0, 3).map((tag) => (
                                <span
                                  key={tag.id}
                                  className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded"
                                >
                                  {tag.name}
                                </span>
                              ))}
                              {result.tags.length > 3 && (
                                <span className="text-xs text-gray-500">
                                  +{result.tags.length - 3}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : query ? (
              <div className="p-8 text-center">
                <Search className="w-8 h-8 text-gray-300 mx-auto" />
                <p className="text-sm text-gray-600 mt-2">No notes found</p>
              </div>
            ) : (
              <div className="p-8 text-center">
                <Search className="w-8 h-8 text-gray-300 mx-auto" />
                <p className="text-sm text-gray-600 mt-2">Start typing to search</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
