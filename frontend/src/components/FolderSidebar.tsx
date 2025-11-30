import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { foldersApi, tagsApi, notesApi } from '../lib/api';
import { ChevronLeft, ChevronRight, Folder, FolderPlus, Tag, ChevronDown, ChevronUp, FileQuestion, Trash2, CheckSquare, Sparkles } from 'lucide-react';
import { EditableListItem } from './EditableListItem';
import { FolderIcon, FolderIconPicker } from './FolderIconPicker';
import { WhatsNewModal, hasNewVersion } from './WhatsNewModal';

interface FolderData {
  id: string;
  name: string;
  icon: string;
  noteCount: number;
  createdAt: string;
  updatedAt: string;
}

interface TagData {
  id: string;
  name: string;
  noteCount: number;
}

interface FolderSidebarProps {
  selectedFolderId: string | null;
  selectedTagId: string | null;
  selectedView: 'notes' | 'tasks';
  onSelectFolder: (folderId: string | null) => void;
  onSelectTag: (tagId: string | null) => void;
  onSelectView: (view: 'notes' | 'tasks') => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onNoteMoved?: () => void;
}

export interface FolderSidebarHandle {
  refreshFolders: () => void;
  refreshTags: () => void;
  refreshAll: () => void;
}

export const FolderSidebar = forwardRef<FolderSidebarHandle, FolderSidebarProps>(({
  selectedFolderId,
  selectedTagId,
  selectedView,
  onSelectFolder,
  onSelectTag,
  onSelectView,
  collapsed,
  onToggleCollapse,
  onNoteMoved,
}, ref) => {
  const [folders, setFolders] = useState<FolderData[]>([]);
  const [tags, setTags] = useState<TagData[]>([]);
  const [unfiledCount, setUnfiledCount] = useState(0);
  const [deletedCount, setDeletedCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderIcon, setNewFolderIcon] = useState('folder');
  const [tagsExpanded, setTagsExpanded] = useState(true);
  const [isDragOverUnfiled, setIsDragOverUnfiled] = useState(false);
  // Track editing state for folder icons
  const [editingFolderIcons, setEditingFolderIcons] = useState<Record<string, string>>({});
  // What's New modal state
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const currentVersion = import.meta.env.VITE_APP_VERSION || '0.0.0';
  const [showNewBadge, setShowNewBadge] = useState(() => hasNewVersion(currentVersion));

  useEffect(() => {
    const loadAll = async () => {
      setIsLoading(true);
      await Promise.all([loadFolders(), loadTags(), loadStats()]);
      setIsLoading(false);
    };
    loadAll();
  }, []);

  // Expose refresh methods to parent
  useImperativeHandle(ref, () => ({
    refreshFolders: async () => {
      setIsLoading(true);
      await Promise.all([loadFolders(), loadStats()]);
      setIsLoading(false);
    },
    refreshTags: async () => {
      setIsLoading(true);
      await loadTags();
      setIsLoading(false);
    },
    refreshAll: async () => {
      setIsLoading(true);
      await Promise.all([loadFolders(), loadTags(), loadStats()]);
      setIsLoading(false);
    }
  }));

  const loadFolders = async () => {
    try {
      const response = await foldersApi.list();
      setFolders(response.data.folders);
    } catch (error) {
      console.error('Failed to load folders:', error);
    }
  };

  const loadTags = async () => {
    try {
      const response = await tagsApi.list();
      setTags(response.data.tags);
    } catch (error) {
      console.error('Failed to load tags:', error);
    }
  };

  const loadStats = async () => {
    try {
      const response = await notesApi.stats();
      setUnfiledCount(response.data.unfiledNotes || 0);
      setDeletedCount(response.data.deletedNotes || 0);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    try {
      await foldersApi.create({ name: newFolderName.trim(), icon: newFolderIcon });
      setNewFolderName('');
      setNewFolderIcon('folder');
      setShowNewFolderInput(false);
      loadFolders();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to create folder');
    }
  };

  const handleRenameFolder = async (folderId: string, newName: string) => {
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return;

    const editedIcon = editingFolderIcons[folderId];
    const nameChanged = newName !== folder.name;
    const iconChanged = editedIcon && editedIcon !== folder.icon;

    // Clear editing icon state
    setEditingFolderIcons(prev => {
      const next = { ...prev };
      delete next[folderId];
      return next;
    });

    // If nothing changed, no need to call API
    if (!nameChanged && !iconChanged) {
      return;
    }

    // Build payload with only changed fields
    const payload: { name?: string; icon?: string } = {};
    if (nameChanged) payload.name = newName;
    if (iconChanged) payload.icon = editedIcon;

    // Optimistic update
    const originalFolders = folders;
    const updatedFolders = folders.map((f) =>
      f.id === folderId ? { ...f, ...payload } : f
    );
    setFolders(updatedFolders);

    try {
      await foldersApi.update(folderId, payload);
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to update folder');
      setFolders(originalFolders); // Revert on error
    }
  };

  const handleDeleteFolder = async (folderId: string, folderName: string) => {
    if (!confirm(`Delete folder "${folderName}"? Notes in this folder will be moved to unfiled.`)) {
      return;
    }

    // Optimistic update
    const originalFolders = folders;
    setFolders(folders.filter((f) => f.id !== folderId));
    if (selectedFolderId === folderId) {
      onSelectFolder(null);
    }

    try {
      await foldersApi.delete(folderId);
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to delete folder');
      setFolders(originalFolders); // Revert on error
    }
  };

  const handleRenameTag = async (tagId: string, newName: string) => {
    // Optimistic update
    const originalTags = tags;
    const updatedTags = tags.map((t) =>
      t.id === tagId ? { ...t, name: newName } : t
    );
    setTags(updatedTags);

    try {
      await tagsApi.rename(tagId, newName);
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to rename tag');
      setTags(originalTags); // Revert on error
    }
  };

  const handleDeleteTag = async (tagId: string, tagName: string) => {
    if (!confirm(`Delete tag "${tagName}"? This will remove it from all notes.`)) {
      return;
    }

    // Optimistic update
    const originalTags = tags;
    setTags(tags.filter((t) => t.id !== tagId));
    if (selectedTagId === tagId) {
      onSelectTag(null);
    }

    try {
      await tagsApi.delete(tagId);
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to delete tag');
      setTags(originalTags); // Revert on error
    }
  };

  const handleNoteDrop = async (folderId: string, noteId: string) => {
    try {
      // Update note's folder
      await notesApi.update(noteId, { folderId: folderId === 'unfiled' ? null : folderId });

      // Refresh counts and folders in parallel for faster UI update
      await Promise.all([loadStats(), loadFolders()]);

      // Notify parent to refresh note list immediately
      onNoteMoved?.();
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to move note';
      alert(errorMessage);
      // Refresh to revert any optimistic updates
      await Promise.all([loadStats(), loadFolders()]);
      onNoteMoved?.();
    }
  };

  if (collapsed) {
    return (
      <div className="w-12 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col items-center py-4">
        <button
          onClick={onToggleCollapse}
          className="p-2 hover:bg-gray-100 dark:bg-gray-700 rounded-md"
          title="Expand sidebar"
        >
          <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400 dark:text-gray-500" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-full md:w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full">
      {/* Sidebar Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h2 className="font-semibold text-gray-900 dark:text-white">Folders</h2>
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setShowNewFolderInput(true)}
            className="p-1.5 hover:bg-gray-100 dark:bg-gray-700 rounded-md"
            title="New folder"
          >
            <FolderPlus className="w-4 h-4 text-gray-600 dark:text-gray-400 dark:text-gray-500" />
          </button>
          <button
            onClick={onToggleCollapse}
            className="p-1.5 hover:bg-gray-100 dark:bg-gray-700 rounded-md"
            title="Collapse sidebar"
          >
            <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-400 dark:text-gray-500" />
          </button>
        </div>
      </div>

      {/* New Folder Input */}
      {showNewFolderInput && (
        <div className="p-2 border-b border-gray-200 dark:border-gray-700">
          <form onSubmit={handleCreateFolder} className="space-y-2">
            <div className="flex items-center space-x-2">
              <FolderIconPicker
                selectedIcon={newFolderIcon}
                onSelectIcon={setNewFolderIcon}
              />
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Folder name"
                className="flex-1 min-w-0 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>
            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => {
                  setShowNewFolderInput(false);
                  setNewFolderName('');
                  setNewFolderIcon('folder');
                }}
                className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1 text-sm bg-blue-600 dark:bg-blue-500 text-white rounded hover:bg-blue-700"
              >
                Add
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Folder List */}
      <div className="flex-1 overflow-y-auto">
        {/* All Notes - Clear all filters */}
        <button
          onClick={() => {
            onSelectView('notes');
            onSelectFolder(null);
            onSelectTag(null);
          }}
          className={`w-full px-4 py-2.5 flex items-center space-x-3 hover:bg-gray-50 dark:hover:bg-gray-700 ${
            selectedView === 'notes' && selectedFolderId === null && selectedTagId === null ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-600' : ''
          }`}
        >
          <Folder className="w-5 h-5 text-gray-400 dark:text-gray-500" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">All Notes</span>
        </button>

        {/* Tasks View */}
        <button
          onClick={() => onSelectView('tasks')}
          className={`w-full px-4 py-2.5 flex items-center space-x-3 hover:bg-gray-50 dark:hover:bg-gray-700 ${
            selectedView === 'tasks' ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-600' : ''
          }`}
        >
          <CheckSquare className="w-5 h-5 text-gray-400 dark:text-gray-500" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Tasks</span>
        </button>

        {/* Unfiled Notes */}
        <button
          onClick={() => {
            onSelectView('notes');
            onSelectFolder('unfiled');
            onSelectTag(null);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            setIsDragOverUnfiled(true);
          }}
          onDragLeave={() => setIsDragOverUnfiled(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOverUnfiled(false);
            try {
              const rawData = e.dataTransfer.getData('application/json');

              // Validate data isn't oversized
              if (rawData.length > 10000) {
                return;
              }

              const data = JSON.parse(rawData);

              // Validate schema: must be object with noteId string
              if (
                data &&
                typeof data === 'object' &&
                typeof data.noteId === 'string' &&
                data.noteId.length > 0 &&
                data.noteId.length < 100
              ) {
                handleNoteDrop('unfiled', data.noteId);
              }
            } catch (error) {
              // Silent fail for invalid drag data
              return;
            }
          }}
          className={`w-full px-4 py-2.5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 ${
            selectedFolderId === 'unfiled' ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-600' : ''
          } ${isDragOverUnfiled ? 'bg-green-100 dark:bg-green-900/30 border-2 border-green-500' : ''}`}
        >
          <div className="flex items-center space-x-3">
            <FileQuestion className="w-5 h-5 text-gray-400 dark:text-gray-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Unfiled</span>
          </div>
          {unfiledCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full">
              {unfiledCount}
            </span>
          )}
        </button>

        {/* Trash */}
        <button
          onClick={() => {
            onSelectView('notes');
            onSelectFolder('trash');
            onSelectTag(null);
          }}
          className={`w-full px-4 py-2.5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 ${
            selectedFolderId === 'trash' ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-600' : ''
          }`}
        >
          <div className="flex items-center space-x-3">
            <Trash2 className="w-5 h-5 text-gray-400 dark:text-gray-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Trash</span>
          </div>
          {deletedCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-red-200 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full">
              {deletedCount}
            </span>
          )}
        </button>

        {/* Folder Items */}
        {isLoading ? (
          <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">Loading...</div>
        ) : folders.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">
            No folders yet. Create one to get started!
          </div>
        ) : (
          folders.map((folder) => (
            <EditableListItem
              key={folder.id}
              id={folder.id}
              name={folder.name}
              count={folder.noteCount}
              renderIcon={(isEditing) => {
                if (isEditing) {
                  // Show icon picker when editing
                  const currentEditIcon = editingFolderIcons[folder.id] ?? folder.icon;
                  return (
                    <FolderIconPicker
                      selectedIcon={currentEditIcon}
                      onSelectIcon={(icon) => setEditingFolderIcons(prev => ({ ...prev, [folder.id]: icon }))}
                    />
                  );
                }
                // Show static icon in view mode
                return <FolderIcon icon={folder.icon} className="w-5 h-5 text-gray-400 dark:text-gray-500" />;
              }}
              isSelected={selectedFolderId === folder.id}
              onSelect={() => onSelectFolder(folder.id)}
              onRename={handleRenameFolder}
              onDelete={handleDeleteFolder}
              onDrop={handleNoteDrop}
            />
          ))
        )}

        {/* Tags Section */}
        <div className="mt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setTagsExpanded(!tagsExpanded)}
            className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-gray-50 dark:bg-gray-700"
          >
            <div className="flex items-center space-x-3">
              <Tag className="w-5 h-5 text-gray-400 dark:text-gray-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Tags</span>
            </div>
            {tagsExpanded ? (
              <ChevronUp className="w-4 h-4 text-gray-400 dark:text-gray-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400 dark:text-gray-500" />
            )}
          </button>

          {tagsExpanded && (
            <div>
              {tags.length === 0 ? (
                <div className="px-4 py-4 text-center text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">
                  No tags yet. Add tags to your notes!
                </div>
              ) : (
                tags.map((tag) => (
                  <EditableListItem
                    key={tag.id}
                    id={tag.id}
                    name={tag.name}
                    count={tag.noteCount}
                    isSelected={selectedTagId === tag.id}
                    onSelect={() => onSelectTag(tag.id)}
                    onRename={handleRenameTag}
                    onDelete={handleDeleteTag}
                    indent={true}
                  />
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Version Footer */}
      <div className="mt-auto border-t border-gray-200 dark:border-gray-700 px-4 py-2 bg-gray-50 dark:bg-gray-900">
        <button
          onClick={() => {
            setShowWhatsNew(true);
            setShowNewBadge(false);
          }}
          className="w-full flex items-center justify-center gap-2 text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          {showNewBadge && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-full text-[10px] font-medium animate-pulse">
              <Sparkles className="w-3 h-3" />
              NEW
            </span>
          )}
          <span>v{currentVersion}</span>
        </button>
      </div>

      {/* What's New Modal */}
      <WhatsNewModal
        isOpen={showWhatsNew}
        onClose={() => setShowWhatsNew(false)}
        currentVersion={currentVersion}
      />
    </div>
  );
});
