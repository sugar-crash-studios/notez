import { useState, useEffect, useRef } from 'react';
import { Bot, ArrowLeft, FileText, Tag, Folder, Search, ChevronDown } from 'lucide-react';
import { serviceAccountsApi } from '../lib/api';
import { useToast } from './Toast';

interface FolderItem {
  id: string;
  name: string;
  icon: string;
  noteCount: number;
}

interface TagItem {
  id: string;
  name: string;
  usageCount: number;
}

interface NoteItem {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  folderId: string | null;
  folder: { id: string; name: string } | null;
  tags: Array<{ id: string; name: string }>;
}

interface ServiceAccountWorkspaceProps {
  accountId: string;
  username: string;
  onBack: () => void;
  onSelectNote: (noteId: string) => void;
  selectedNoteId: string | null;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function ServiceAccountWorkspace({
  accountId,
  username,
  onBack,
  onSelectNote,
  selectedNoteId,
}: ServiceAccountWorkspaceProps) {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'content' | 'activity'>('content');

  // Folder/tag state
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [unfiledCount, setUnfiledCount] = useState(0);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);

  // Notes state
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [notesTotal, setNotesTotal] = useState(0);
  const [notesOffset, setNotesOffset] = useState(0);
  const [isLoadingNotes, setIsLoadingNotes] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Sidebar state
  const [isLoadingSidebar, setIsLoadingSidebar] = useState(true);

  const NOTES_LIMIT = 50;

  // Load folders and tags
  useEffect(() => {
    let cancelled = false;
    async function loadSidebar() {
      setIsLoadingSidebar(true);
      try {
        const [foldersRes, tagsRes] = await Promise.all([
          serviceAccountsApi.getAccountFolders(accountId),
          serviceAccountsApi.getAccountTags(accountId),
        ]);
        if (!cancelled) {
          setFolders(foldersRes.data.folders);
          setUnfiledCount(foldersRes.data.unfiledCount);
          setTags(tagsRes.data.tags);
        }
      } catch {
        if (!cancelled) showToast('Failed to load account data', 'error');
      } finally {
        if (!cancelled) setIsLoadingSidebar(false);
      }
    }
    loadSidebar();
    return () => { cancelled = true; };
  }, [accountId]);

  // Load notes when folder/tag/search changes
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsLoadingNotes(true);
      setNotesOffset(0);
      try {
        const params: { folderId?: string; limit: number; offset: number } = {
          limit: NOTES_LIMIT,
          offset: 0,
        };
        if (selectedFolderId === 'unfiled') {
          params.folderId = 'unfiled';
        } else if (selectedFolderId) {
          params.folderId = selectedFolderId;
        }
        const res = await serviceAccountsApi.getAccountNotes(accountId, params);
        if (!cancelled) {
          let filtered = res.data.notes;
          // Client-side tag filter (backend doesn't support tag filter yet)
          if (selectedTagId) {
            filtered = filtered.filter((n: NoteItem) =>
              n.tags.some((t) => t.id === selectedTagId)
            );
          }
          // Client-side search filter
          if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter((n: NoteItem) =>
              n.title.toLowerCase().includes(q)
            );
          }
          setNotes(filtered);
          setNotesTotal(res.data.total);
        }
      } catch {
        if (!cancelled) showToast('Failed to load notes', 'error');
      } finally {
        if (!cancelled) setIsLoadingNotes(false);
      }
    }, 200);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [accountId, selectedFolderId, selectedTagId, searchQuery]);

  // Load more notes
  const handleLoadMore = async () => {
    const newOffset = notesOffset + NOTES_LIMIT;
    try {
      const params: { folderId?: string; limit: number; offset: number } = {
        limit: NOTES_LIMIT,
        offset: newOffset,
      };
      if (selectedFolderId === 'unfiled') {
        params.folderId = 'unfiled';
      } else if (selectedFolderId) {
        params.folderId = selectedFolderId;
      }
      const res = await serviceAccountsApi.getAccountNotes(accountId, params);
      setNotes((prev) => [...prev, ...res.data.notes]);
      setNotesOffset(newOffset);
    } catch {
      showToast('Failed to load more notes', 'error');
    }
  };

  const totalNoteCount = folders.reduce((sum, f) => sum + f.noteCount, 0) + unfiledCount;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <button
          onClick={onBack}
          className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
          aria-label="Back to Service Accounts"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <Bot className="w-5 h-5 text-purple-500 dark:text-purple-400" />
        <span className="font-medium text-gray-900 dark:text-white">{username}</span>

        {/* Tabs */}
        <div className="flex ml-auto gap-1">
          <button
            onClick={() => setActiveTab('content')}
            className={`px-3 py-1 text-sm rounded ${
              activeTab === 'content'
                ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            Content
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`px-3 py-1 text-sm rounded ${
              activeTab === 'activity'
                ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            Activity
          </button>
        </div>
      </div>

      {/* Content */}
      {activeTab === 'content' ? (
        <div className="flex flex-1 min-h-0">
          {/* Sidebar: Folders + Tags */}
          <div className="w-52 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-y-auto">
            {isLoadingSidebar ? (
              <div className="p-3 space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-7 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="py-2">
                {/* Folders Section */}
                <div className="px-3 py-1 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                  Folders
                </div>

                {/* All Notes */}
                <button
                  onClick={() => { setSelectedFolderId(null); setSelectedTagId(null); }}
                  className={`w-full px-3 py-1.5 flex items-center gap-2 text-sm text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                    !selectedFolderId && !selectedTagId ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium' : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">All Notes</span>
                  <span className="ml-auto text-xs text-gray-400">{totalNoteCount}</span>
                </button>

                {/* Individual folders */}
                {folders.map((folder) => (
                  <button
                    key={folder.id}
                    onClick={() => { setSelectedFolderId(folder.id); setSelectedTagId(null); }}
                    className={`w-full px-3 py-1.5 flex items-center gap-2 text-sm text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                      selectedFolderId === folder.id ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium' : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <Folder className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{folder.name}</span>
                    <span className="ml-auto text-xs text-gray-400">{folder.noteCount}</span>
                  </button>
                ))}

                {/* Unfiled */}
                {unfiledCount > 0 && (
                  <button
                    onClick={() => { setSelectedFolderId('unfiled'); setSelectedTagId(null); }}
                    className={`w-full px-3 py-1.5 flex items-center gap-2 text-sm text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                      selectedFolderId === 'unfiled' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium' : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">Unfiled</span>
                    <span className="ml-auto text-xs text-gray-400">{unfiledCount}</span>
                  </button>
                )}

                {folders.length === 0 && unfiledCount === 0 && (
                  <p className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500">No folders</p>
                )}

                {/* Tags Section */}
                {tags.length > 0 && (
                  <>
                    <div className="px-3 py-1 mt-3 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                      Tags
                    </div>
                    {tags.map((tag) => (
                      <button
                        key={tag.id}
                        onClick={() => { setSelectedTagId(tag.id); setSelectedFolderId(null); }}
                        className={`w-full px-3 py-1.5 flex items-center gap-2 text-sm text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                          selectedTagId === tag.id ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium' : 'text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        <Tag className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{tag.name}</span>
                        <span className="ml-auto text-xs text-gray-400">{tag.usageCount}</span>
                      </button>
                    ))}
                  </>
                )}

                {/* Stats */}
                <div className="px-3 py-2 mt-3 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-400 dark:text-gray-500">
                  {totalNoteCount} notes &middot; {folders.length} folders &middot; {tags.length} tags
                </div>
              </div>
            )}
          </div>

          {/* Note List */}
          <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-gray-800">
            {/* Search */}
            <div className="p-3 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {selectedFolderId === 'unfiled'
                    ? 'Unfiled Notes'
                    : selectedFolderId
                      ? folders.find((f) => f.id === selectedFolderId)?.name ?? 'Notes'
                      : selectedTagId
                        ? tags.find((t) => t.id === selectedTagId)?.name ?? 'Tagged Notes'
                        : 'All Notes'}
                </span>
                <span className="text-xs text-gray-400">
                  {notes.length}{notesTotal > notes.length ? ` of ${notesTotal}` : ''} notes
                </span>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search notes..."
                  className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="flex-1 overflow-y-auto">
              {isLoadingNotes ? (
                <div className="p-4 text-sm text-gray-500 dark:text-gray-400 text-center">Loading...</div>
              ) : notes.length === 0 ? (
                <div className="p-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                  {searchQuery ? 'No notes match your search.' : 'No notes found.'}
                </div>
              ) : (
                <>
                  {notes.map((note) => (
                    <button
                      key={note.id}
                      onClick={() => onSelectNote(note.id)}
                      className={`w-full px-4 py-3 border-b border-gray-100 dark:border-gray-700 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                        selectedNoteId === note.id ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-600' : ''
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <Bot className="w-3.5 h-3.5 text-purple-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {note.title}
                          </h3>
                          {note.tags.length > 0 && (
                            <div className="flex gap-1 mt-1 flex-wrap">
                              {note.tags.slice(0, 3).map((tag) => (
                                <span
                                  key={tag.id}
                                  className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded"
                                >
                                  {tag.name}
                                </span>
                              ))}
                              {note.tags.length > 3 && (
                                <span className="text-xs text-gray-400">+{note.tags.length - 3}</span>
                              )}
                            </div>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {formatRelativeTime(note.updatedAt)}
                            </span>
                            {note.folder && (
                              <span className="text-xs text-gray-400 dark:text-gray-500 truncate">
                                {note.folder.name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}

                  {/* Load More */}
                  {notes.length < notesTotal && (
                    <div className="p-3 text-center">
                      <button
                        onClick={handleLoadMore}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Load more...
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Activity Tab Placeholder */
        <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500">
          <div className="text-center">
            <p className="text-sm">Activity timeline coming in v1.20.0</p>
          </div>
        </div>
      )}
    </div>
  );
}
