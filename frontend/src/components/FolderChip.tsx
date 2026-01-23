import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Folder } from 'lucide-react';
import { FolderIcon } from './FolderIconPicker';

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
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedFolder = folders.find(f => f.id === selectedFolderId);

  // Refresh folders when dropdown opens
  useEffect(() => {
    if (isOpen && onRefresh) {
      onRefresh();
    }
  }, [isOpen, onRefresh]);

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

          {/* Empty state */}
          {folders.length === 0 && (
            <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 text-center">
              No folders created yet
            </div>
          )}
        </div>
      )}
    </div>
  );
}
