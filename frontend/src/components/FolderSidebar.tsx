import { useState, useEffect } from 'react';
import { foldersApi, tagsApi } from '../lib/api';
import { ChevronLeft, ChevronRight, Folder, FolderPlus, Tag, ChevronDown, ChevronUp, Pencil, Trash2, X, Check } from 'lucide-react';

interface FolderData {
  id: string;
  name: string;
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
  onSelectFolder: (folderId: string | null) => void;
  onSelectTag: (tagId: string | null) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function FolderSidebar({
  selectedFolderId,
  selectedTagId,
  onSelectFolder,
  onSelectTag,
  collapsed,
  onToggleCollapse,
}: FolderSidebarProps) {
  const [folders, setFolders] = useState<FolderData[]>([]);
  const [tags, setTags] = useState<TagData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [tagsExpanded, setTagsExpanded] = useState(true);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editingTagName, setEditingTagName] = useState('');

  useEffect(() => {
    loadFolders();
    loadTags();
  }, []);

  const loadFolders = async () => {
    try {
      const response = await foldersApi.list();
      setFolders(response.data.folders);
    } catch (error) {
      console.error('Failed to load folders:', error);
    } finally {
      setIsLoading(false);
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

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    try {
      await foldersApi.create({ name: newFolderName.trim() });
      setNewFolderName('');
      setShowNewFolderInput(false);
      loadFolders();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to create folder');
    }
  };

  const handleStartEditFolder = (folder: FolderData) => {
    setEditingFolderId(folder.id);
    setEditingFolderName(folder.name);
  };

  const handleCancelEditFolder = () => {
    setEditingFolderId(null);
    setEditingFolderName('');
  };

  const handleSaveFolder = async (folderId: string) => {
    if (!editingFolderName.trim()) return;

    try {
      await foldersApi.update(folderId, { name: editingFolderName.trim() });
      setEditingFolderId(null);
      setEditingFolderName('');
      loadFolders();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to rename folder');
    }
  };

  const handleDeleteFolder = async (folderId: string, folderName: string) => {
    if (!confirm(`Delete folder "${folderName}"? Notes in this folder will be moved to unfiled.`)) {
      return;
    }

    try {
      await foldersApi.delete(folderId);
      if (selectedFolderId === folderId) {
        onSelectFolder(null);
      }
      loadFolders();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to delete folder');
    }
  };

  const handleStartEditTag = (tag: TagData) => {
    setEditingTagId(tag.id);
    setEditingTagName(tag.name);
  };

  const handleCancelEditTag = () => {
    setEditingTagId(null);
    setEditingTagName('');
  };

  const handleSaveTag = async (tagId: string) => {
    if (!editingTagName.trim()) return;

    try {
      await tagsApi.rename(tagId, editingTagName.trim());
      setEditingTagId(null);
      setEditingTagName('');
      loadTags();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to rename tag');
    }
  };

  const handleDeleteTag = async (tagId: string, tagName: string) => {
    if (!confirm(`Delete tag "${tagName}"? This will remove it from all notes.`)) {
      return;
    }

    try {
      await tagsApi.delete(tagId);
      if (selectedTagId === tagId) {
        onSelectTag(null);
      }
      loadTags();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to delete tag');
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
    <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
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
          <form onSubmit={handleCreateFolder} className="flex space-x-1">
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name"
              className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <button
              type="submit"
              className="px-2 py-1 text-sm bg-blue-600 dark:bg-blue-500 text-white rounded hover:bg-blue-700"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => {
                setShowNewFolderInput(false);
                setNewFolderName('');
              }}
              className="px-2 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              Cancel
            </button>
          </form>
        </div>
      )}

      {/* Folder List */}
      <div className="flex-1 overflow-y-auto">
        {/* All Notes - Clear all filters */}
        <button
          onClick={() => {
            onSelectFolder(null);
            onSelectTag(null);
          }}
          className={`w-full px-4 py-2.5 flex items-center space-x-3 hover:bg-gray-50 dark:bg-gray-700 ${
            selectedFolderId === null && selectedTagId === null ? 'bg-blue-50 border-l-4 border-blue-600' : ''
          }`}
        >
          <Folder className="w-5 h-5 text-gray-400 dark:text-gray-500" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">All Notes</span>
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
            <div
              key={folder.id}
              className={`group w-full px-4 py-2.5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 ${
                selectedFolderId === folder.id ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-600' : ''
              }`}
            >
              {editingFolderId === folder.id ? (
                // Edit mode
                <div className="flex items-center space-x-2 flex-1">
                  <Folder className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                  <input
                    type="text"
                    value={editingFolderName}
                    onChange={(e) => setEditingFolderName(e.target.value)}
                    className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveFolder(folder.id);
                      if (e.key === 'Escape') handleCancelEditFolder();
                    }}
                  />
                  <button
                    onClick={() => handleSaveFolder(folder.id)}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                    title="Save"
                  >
                    <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                  </button>
                  <button
                    onClick={handleCancelEditFolder}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                    title="Cancel"
                  >
                    <X className="w-4 h-4 text-red-600 dark:text-red-400" />
                  </button>
                </div>
              ) : (
                // View mode
                <>
                  <button
                    onClick={() => onSelectFolder(folder.id)}
                    className="flex items-center space-x-3 flex-1"
                  >
                    <Folder className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{folder.name}</span>
                  </button>
                  <div className="flex items-center space-x-1">
                    <span className="text-xs text-gray-500 dark:text-gray-400 mr-2">{folder.noteCount}</span>
                    <button
                      onClick={() => handleStartEditFolder(folder)}
                      className="p-1 opacity-0 group-hover:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-opacity"
                      title="Rename folder"
                    >
                      <Pencil className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" />
                    </button>
                    <button
                      onClick={() => handleDeleteFolder(folder.id, folder.name)}
                      className="p-1 opacity-0 group-hover:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-opacity"
                      title="Delete folder"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                    </button>
                  </div>
                </>
              )}
            </div>
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
                  <div
                    key={tag.id}
                    className={`group w-full px-4 py-2 pl-12 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 ${
                      selectedTagId === tag.id ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-600' : ''
                    }`}
                  >
                    {editingTagId === tag.id ? (
                      // Edit mode
                      <div className="flex items-center space-x-2 flex-1">
                        <input
                          type="text"
                          value={editingTagName}
                          onChange={(e) => setEditingTagName(e.target.value)}
                          className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveTag(tag.id);
                            if (e.key === 'Escape') handleCancelEditTag();
                          }}
                        />
                        <button
                          onClick={() => handleSaveTag(tag.id)}
                          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                          title="Save"
                        >
                          <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                        </button>
                        <button
                          onClick={handleCancelEditTag}
                          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                          title="Cancel"
                        >
                          <X className="w-4 h-4 text-red-600 dark:text-red-400" />
                        </button>
                      </div>
                    ) : (
                      // View mode
                      <>
                        <button
                          onClick={() => onSelectTag(tag.id)}
                          className="flex-1 text-left"
                        >
                          <span className="text-sm text-gray-700 dark:text-gray-200">{tag.name}</span>
                        </button>
                        <div className="flex items-center space-x-1">
                          <span className="text-xs text-gray-500 dark:text-gray-400 mr-2">{tag.noteCount}</span>
                          <button
                            onClick={() => handleStartEditTag(tag)}
                            className="p-1 opacity-0 group-hover:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-opacity"
                            title="Rename tag"
                          >
                            <Pencil className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" />
                          </button>
                          <button
                            onClick={() => handleDeleteTag(tag.id, tag.name)}
                            className="p-1 opacity-0 group-hover:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-opacity"
                            title="Delete tag"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
