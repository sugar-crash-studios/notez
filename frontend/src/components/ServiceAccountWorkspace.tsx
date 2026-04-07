import { useState, useEffect } from 'react';
import { Bot, ArrowLeft, FileText, Tag, Folder, Search, CheckSquare, FolderPlus, ChevronRight, ChevronDown } from 'lucide-react';
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

interface ActivityItem {
  type: 'note' | 'task' | 'folder';
  action: 'created' | 'updated';
  id: string;
  title: string;
  folder: { id: string; name: string } | null;
  timestamp: string;
  tags?: Array<{ id: string; name: string }>;
  status?: string;
}

type GroupedActivity = {
  kind: 'single';
  key: string;
  item: ActivityItem;
} | {
  kind: 'group';
  key: string;
  action: string;
  type: string;
  folder: { id: string; name: string } | null;
  items: ActivityItem[];
  timestamp: string;
};

type ActivityFilter = {
  actionType: 'all' | 'created' | 'updated';
  contentType: 'all' | 'note' | 'task' | 'folder';
};

/** Group consecutive same-type/action/folder items within 5 minutes */
export function groupActivityItems(items: ActivityItem[]): GroupedActivity[] {
  const groups: GroupedActivity[] = [];
  let i = 0;

  while (i < items.length) {
    const current = items[i];
    const batch: ActivityItem[] = [current];

    // Collect consecutive items with same action + type + folderId within 5 minutes
    while (i + 1 < items.length) {
      const next = items[i + 1];
      const timeDiff = Math.abs(new Date(current.timestamp).getTime() - new Date(next.timestamp).getTime());
      const sameGroup =
        next.action === current.action &&
        next.type === current.type &&
        (next.folder?.id ?? null) === (current.folder?.id ?? null) &&
        timeDiff <= 5 * 60 * 1000;

      if (!sameGroup) break;
      batch.push(next);
      i++;
    }

    if (batch.length === 1) {
      groups.push({ kind: 'single', key: `${batch[0].type}-${batch[0].id}`, item: batch[0] });
    } else {
      groups.push({
        kind: 'group',
        key: `group-${current.action}-${current.type}-${current.folder?.id ?? 'null'}-${current.timestamp}`,
        action: current.action,
        type: current.type,
        folder: current.folder,
        items: batch,
        timestamp: batch[0].timestamp,
      });
    }
    i++;
  }

  return groups;
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

  // Notes state - rawNotes holds server data, filteredNotes is derived
  const [rawNotes, setRawNotes] = useState<NoteItem[]>([]);
  const [notesTotal, setNotesTotal] = useState(0);
  const [notesOffset, setNotesOffset] = useState(0);
  const [isLoadingNotes, setIsLoadingNotes] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Sidebar state
  const [isLoadingSidebar, setIsLoadingSidebar] = useState(true);
  const [foldersCollapsed, setFoldersCollapsed] = useState(false);
  const [tagsCollapsed, setTagsCollapsed] = useState(false);

  const NOTES_LIMIT = 50;

  // Derive filtered notes from raw notes (tag + search are client-side)
  const filteredNotes = rawNotes.filter((n) => {
    if (selectedTagId && !n.tags.some((t) => t.id === selectedTagId)) return false;
    if (searchQuery && !n.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

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

  // Load notes when folder changes (tag/search filtering is client-side via filteredNotes)
  useEffect(() => {
    let cancelled = false;
    async function loadNotes() {
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
          setRawNotes(res.data.notes);
          setNotesTotal(res.data.total);
        }
      } catch {
        if (!cancelled) showToast('Failed to load notes', 'error');
      } finally {
        if (!cancelled) setIsLoadingNotes(false);
      }
    }
    loadNotes();
    return () => { cancelled = true; };
  }, [accountId, selectedFolderId]);

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
      setRawNotes((prev) => [...prev, ...res.data.notes]);
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
          <div className="w-56 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-y-auto">
            {isLoadingSidebar ? (
              <div className="p-3 space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-7 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="py-2">
                {/* Folders Section */}
                <button
                  onClick={() => setFoldersCollapsed(!foldersCollapsed)}
                  className="w-full px-3 py-1 flex items-center justify-between text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  aria-expanded={!foldersCollapsed}
                  id="folders-label"
                >
                  <span>Folders</span>
                  {foldersCollapsed
                    ? <ChevronRight className="w-3 h-3" />
                    : <ChevronDown className="w-3 h-3" />
                  }
                </button>

                {!foldersCollapsed && (
                  <div role="listbox" aria-labelledby="folders-label">
                    {/* All Notes */}
                    <button
                      role="option"
                      aria-selected={!selectedFolderId && !selectedTagId}
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
                        role="option"
                        aria-selected={selectedFolderId === folder.id}
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
                        role="option"
                        aria-selected={selectedFolderId === 'unfiled'}
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
                  </div>
                )}

                {/* Tags Section */}
                {tags.length > 0 && (
                  <div className="mt-2">
                    <button
                      onClick={() => setTagsCollapsed(!tagsCollapsed)}
                      className="w-full px-3 py-1 flex items-center justify-between text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                      aria-expanded={!tagsCollapsed}
                      id="tags-label"
                    >
                      <span>Tags</span>
                      {tagsCollapsed
                        ? <ChevronRight className="w-3 h-3" />
                        : <ChevronDown className="w-3 h-3" />
                      }
                    </button>
                    {!tagsCollapsed && (
                      <div role="listbox" aria-labelledby="tags-label">
                        {tags.map((tag) => (
                          <button
                            key={tag.id}
                            role="option"
                            aria-selected={selectedTagId === tag.id}
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
                      </div>
                    )}
                  </div>
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
                  {filteredNotes.length}{rawNotes.length < notesTotal ? ` of ${notesTotal}` : ''} notes
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
              ) : filteredNotes.length === 0 ? (
                <div className="p-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                  {searchQuery || selectedTagId ? 'No notes match your filters.' : 'No notes found.'}
                </div>
              ) : (
                <>
                  {filteredNotes.map((note) => (
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

                  {/* Load More - based on raw (unfiltered) count vs server total */}
                  {rawNotes.length < notesTotal && (
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
        /* Activity Tab */
        <ActivityTimeline
          accountId={accountId}
          onSelectNote={onSelectNote}
        />
      )}
    </div>
  );
}

// ─── Activity Timeline ─────────────────────────────────────────────────

function getDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const itemDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (itemDate.getTime() === today.getTime()) return 'Today';
  if (itemDate.getTime() === yesterday.getTime()) return 'Yesterday';
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

function getTimeStr(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

const typeIcons = {
  note: FileText,
  task: CheckSquare,
  folder: FolderPlus,
};

function ActivityTimeline({ accountId, onSelectNote }: { accountId: string; onSelectNote: (id: string) => void }) {
  const { showToast } = useToast();
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<ActivityFilter>({ actionType: 'all', contentType: 'all' });
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      try {
        const res = await serviceAccountsApi.getAccountActivity(accountId, { limit: 50 });
        if (!cancelled) {
          setItems(res.data.items);
          setHasMore(res.data.hasMore);
          setNextCursor(res.data.nextCursor);
        }
      } catch {
        if (!cancelled) showToast('Failed to load activity', 'error');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [accountId]);

  const handleLoadMore = async () => {
    if (!nextCursor) return;
    try {
      const res = await serviceAccountsApi.getAccountActivity(accountId, { limit: 50, before: nextCursor });
      // Deduplicate by type+id since lte cursor may return overlapping items
      setItems((prev) => {
        const seen = new Set(prev.map((i) => `${i.type}-${i.id}`));
        const newItems = res.data.items.filter((i: ActivityItem) => !seen.has(`${i.type}-${i.id}`));
        return [...prev, ...newItems];
      });
      setHasMore(res.data.hasMore);
      setNextCursor(res.data.nextCursor);
    } catch {
      showToast('Failed to load more activity', 'error');
    }
  };

  // Apply filters
  const filtered = items.filter((item) => {
    if (filter.actionType !== 'all' && item.action !== filter.actionType) return false;
    if (filter.contentType !== 'all' && item.type !== filter.contentType) return false;
    return true;
  });

  // Group
  const grouped = groupActivityItems(filtered);

  // Group by date
  const dateGroups: Array<{ label: string; items: GroupedActivity[] }> = [];
  for (const g of grouped) {
    const ts = g.kind === 'single' ? g.item.timestamp : g.timestamp;
    const label = getDateLabel(ts);
    const existing = dateGroups.find((dg) => dg.label === label);
    if (existing) {
      existing.items.push(g);
    } else {
      dateGroups.push({ label, items: [g] });
    }
  }

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  if (isLoading) {
    return <div className="p-4 text-sm text-gray-500 dark:text-gray-400 text-center">Loading activity...</div>;
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Filters */}
      <div className="flex items-center gap-2 p-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <span className="text-xs text-gray-500 dark:text-gray-400">Filters:</span>
        <select
          value={filter.actionType}
          onChange={(e) => setFilter((f) => ({ ...f, actionType: e.target.value as ActivityFilter['actionType'] }))}
          className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
          aria-label="Filter by action"
        >
          <option value="all">All actions</option>
          <option value="created">Created</option>
          <option value="updated">Updated</option>
        </select>
        <select
          value={filter.contentType}
          onChange={(e) => setFilter((f) => ({ ...f, contentType: e.target.value as ActivityFilter['contentType'] }))}
          className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
          aria-label="Filter by content type"
        >
          <option value="all">All types</option>
          <option value="note">Notes</option>
          <option value="task">Tasks</option>
          <option value="folder">Folders</option>
        </select>
        <span className="text-xs text-gray-400 ml-auto" aria-live="polite">
          {filtered.length} items
        </span>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-4 text-sm text-gray-500 dark:text-gray-400 text-center">
            {items.length === 0 ? 'No activity yet.' : 'No activity matches your filters.'}
          </div>
        ) : (
          <>
            {dateGroups.map((dg) => (
              <div key={dg.label}>
                <div className="sticky top-0 px-4 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                  {dg.label}
                </div>
                {dg.items.map((g) => {
                  if (g.kind === 'single') {
                    const item = g.item;
                    const Icon = typeIcons[item.type];
                    const isClickable = item.type === 'note';
                    const Element = isClickable ? 'button' : 'div';
                    return (
                      <Element
                        key={g.key}
                        {...(isClickable ? { onClick: () => onSelectNote(item.id) } : {})}
                        className={`w-full px-4 py-2.5 flex items-start gap-3 text-left border-b border-gray-100 dark:border-gray-700 ${
                          isClickable ? 'hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer' : ''
                        }`}
                      >
                        <span className="text-xs text-gray-400 dark:text-gray-500 w-12 flex-shrink-0 pt-0.5">
                          {getTimeStr(item.timestamp)}
                        </span>
                        <Icon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-gray-400" aria-hidden="true" />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm text-gray-900 dark:text-white">
                            <span className={`font-medium ${item.action === 'created' ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'}`}>
                              {item.action === 'created' ? 'Created' : 'Updated'}
                            </span>
                            {' '}{item.title}
                          </span>
                          {item.folder && (
                            <span className="text-xs text-gray-400 dark:text-gray-500 ml-2">
                              in {item.folder.name}
                            </span>
                          )}
                          {item.tags && item.tags.length > 0 && (
                            <div className="flex gap-1 mt-0.5">
                              {item.tags.slice(0, 3).map((t) => (
                                <span key={t.id} className="text-xs px-1 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded">
                                  {t.name}
                                </span>
                              ))}
                            </div>
                          )}
                          {item.status && (
                            <span className="text-xs text-gray-400 dark:text-gray-500 ml-2">({item.status})</span>
                          )}
                        </div>
                      </Element>
                    );
                  } else {
                    // Group
                    const isExpanded = expandedGroups.has(g.key);
                    const Icon = typeIcons[g.type as keyof typeof typeIcons] ?? FileText;
                    return (
                      <div key={g.key} className="border-b border-gray-100 dark:border-gray-700">
                        <button
                          onClick={() => toggleGroup(g.key)}
                          className="w-full px-4 py-2.5 flex items-start gap-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50"
                          aria-expanded={isExpanded}
                        >
                          <span className="text-xs text-gray-400 dark:text-gray-500 w-12 flex-shrink-0 pt-0.5">
                            {getTimeStr(g.timestamp)}
                          </span>
                          <Icon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-gray-400" aria-hidden="true" />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm text-gray-900 dark:text-white">
                              <span className={`font-medium ${g.action === 'created' ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'}`}>
                                {g.action === 'created' ? 'Created' : 'Updated'}
                              </span>
                              {' '}{g.items.length} {g.type}s
                              {g.folder && <span className="text-gray-400"> in {g.folder.name}</span>}
                            </span>
                          </div>
                          <ChevronRight className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                        </button>
                        {isExpanded && (
                          <div className="pl-12 bg-gray-50 dark:bg-gray-900/30">
                            {g.items.map((item) => (
                              <button
                                key={`${item.type}-${item.id}`}
                                onClick={() => item.type === 'note' && onSelectNote(item.id)}
                                className={`w-full px-4 py-1.5 flex items-center gap-2 text-left text-sm ${
                                  item.type === 'note' ? 'hover:bg-gray-100 dark:hover:bg-gray-700/50 cursor-pointer' : 'cursor-default'
                                }`}
                              >
                                <span className="text-xs text-gray-400 w-12 flex-shrink-0">{getTimeStr(item.timestamp)}</span>
                                <span className="text-gray-700 dark:text-gray-300 truncate">{item.title}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  }
                })}
              </div>
            ))}

            {hasMore && (
              <div className="p-3 text-center">
                <button onClick={handleLoadMore} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
                  Load more...
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
