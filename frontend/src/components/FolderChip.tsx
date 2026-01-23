import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Folder, Plus, Check, X, Loader2 } from 'lucide-react';
import { FolderIcon } from './FolderIconPicker';
import { foldersApi } from '../lib/api';

interface FolderData {
  id: string;
  name: string;
  icon: string;
  noteCount: number;
}

interface FolderChipProps {
  folders: FolderData[];
  selectedFolderId: string | null;
  onChange: (folderId: string | null) => void;
  onRefresh?: () => void;
  disabled?: boolean;
}

export function FolderChip({ folders, selectedFolderId, onChange, onRefresh, disabled = false }: FolderChipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isCreating, setIsCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [createError, setCreateError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const newFolderInputRef = useRef<HTMLInputElement>(null);

  const selectedFolder = folders.find(f => f.id === selectedFolderId);

  // Refresh folders when dropdown opens
  useEffect(() => {
    if (isOpen && onRefresh) {
      onRefresh();
    }
  }, [isOpen, onRefresh]);

  // Focus input when creating new folder
  useEffect(() => {
    if (isCreating && newFolderInputRef.current) {
      newFolderInputRef.current.focus();
    }
  }, [isCreating]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll selected item into view during keyboard navigation
  useEffect(() => {
    if (isOpen && selectedIndex >= 0 && dropdownRef.current) {
      const optionId = `folder-option-${selectedIndex}`;
      const selectedElement = dropdownRef.current.querySelector(`#${optionId}`);
      selectedElement?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex, isOpen]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (isOpen && selectedIndex >= 0) {
        // Select the highlighted option
        if (selectedIndex === 0) {
          onChange(null); // Unfiled
        } else {
          onChange(folders[selectedIndex - 1].id);
        }
        setIsOpen(false);
        setSelectedIndex(-1);
      } else {
        setIsOpen(!isOpen);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setSelectedIndex(-1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setSelectedIndex(0);
      } else {
        // +1 for Unfiled option at top
        const maxIndex = folders.length;
        setSelectedIndex(prev => (prev < maxIndex ? prev + 1 : prev));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (isOpen) {
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
      }
    }
  };

  const handleSelect = (folderId: string | null) => {
    onChange(folderId);
    setIsOpen(false);
    setSelectedIndex(-1);
    setIsCreating(false);
    setNewFolderName('');
    setCreateError('');
  };

  const handleStartCreate = () => {
    setIsCreating(true);
    setNewFolderName('');
    setCreateError('');
  };

  const handleCancelCreate = () => {
    setIsCreating(false);
    setNewFolderName('');
    setCreateError('');
  };

  const handleCreateFolder = async () => {
    const trimmedName = newFolderName.trim();
    if (!trimmedName) {
      setCreateError('Folder name is required');
      return;
    }

    setIsSubmitting(true);
    setCreateError('');

    try {
      const response = await foldersApi.create({ name: trimmedName });
      const newFolder = response.data;
      // Refresh the folders list
      if (onRefresh) {
        onRefresh();
      }
      // Select the newly created folder
      onChange(newFolder.id);
      setIsOpen(false);
      setIsCreating(false);
      setNewFolderName('');
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to create folder';
      setCreateError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCreateFolder();
    } else if (e.key === 'Escape') {
      handleCancelCreate();
    }
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Chip Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={`
          inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm
          border transition-colors
          ${disabled
            ? 'opacity-60 cursor-not-allowed bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600'
            : 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600'
          }
          ${isOpen ? 'ring-2 ring-blue-500 border-blue-500' : ''}
        `}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {selectedFolder ? (
          <FolderIcon icon={selectedFolder.icon} className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        ) : (
          <Folder className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        )}
        <span className="text-gray-700 dark:text-gray-200 max-w-[120px] truncate">
          {selectedFolder?.name || 'Unfiled'}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-500 dark:text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-1 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-64 overflow-y-auto"
          role="listbox"
          aria-activedescendant={selectedIndex >= 0 ? `folder-option-${selectedIndex}` : undefined}
        >
          {/* Unfiled option */}
          <button
            id="folder-option-0"
            type="button"
            onClick={() => handleSelect(null)}
            className={`
              w-full text-left px-3 py-2 text-sm flex items-center gap-2
              hover:bg-gray-100 dark:hover:bg-gray-700
              ${selectedIndex === 0 ? 'bg-blue-50 dark:bg-blue-900/30' : ''}
              ${!selectedFolderId ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-700 dark:text-gray-200'}
            `}
            role="option"
            aria-selected={selectedIndex === 0}
          >
            <Folder className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span>Unfiled</span>
            {!selectedFolderId && (
              <span className="ml-auto text-blue-600 dark:text-blue-400">✓</span>
            )}
          </button>

          {/* Divider */}
          {folders.length > 0 && (
            <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
          )}

          {/* Folder options */}
          {folders.map((folder, index) => (
            <button
              id={`folder-option-${index + 1}`}
              key={folder.id}
              type="button"
              onClick={() => handleSelect(folder.id)}
              className={`
                w-full text-left px-3 py-2 text-sm flex items-center gap-2
                hover:bg-gray-100 dark:hover:bg-gray-700
                ${selectedIndex === index + 1 ? 'bg-blue-50 dark:bg-blue-900/30' : ''}
                ${selectedFolderId === folder.id ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-700 dark:text-gray-200'}
              `}
              role="option"
              aria-selected={selectedIndex === index + 1}
            >
              <FolderIcon icon={folder.icon} className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              <span className="truncate">{folder.name}</span>
              {selectedFolderId === folder.id && (
                <span className="ml-auto text-blue-600 dark:text-blue-400">✓</span>
              )}
            </button>
          ))}

          {/* Divider before create option */}
          <div className="border-t border-gray-200 dark:border-gray-700 my-1" />

          {/* Create new folder option */}
          {isCreating ? (
            <div className="px-3 py-2">
              <div className="flex items-center gap-2">
                <input
                  ref={newFolderInputRef}
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={handleCreateKeyDown}
                  placeholder="Folder name"
                  maxLength={255}
                  disabled={isSubmitting}
                  className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={handleCreateFolder}
                  disabled={isSubmitting || !newFolderName.trim()}
                  className="p-1 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Create folder"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleCancelCreate}
                  disabled={isSubmitting}
                  className="p-1 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded disabled:opacity-50"
                  title="Cancel"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {createError && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{createError}</p>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={handleStartCreate}
              className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
            >
              <Plus className="w-4 h-4" />
              <span>Create new folder</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
