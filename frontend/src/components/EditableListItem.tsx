import { useState } from 'react';
import { Pencil, Trash2, X, Check } from 'lucide-react';

interface EditableListItemProps {
  id: string;
  name: string;
  count?: number;
  icon?: React.ReactNode;
  isSelected: boolean;
  onSelect: () => void;
  onRename: (id: string, newName: string) => Promise<void>;
  onDelete: (id: string, name: string) => Promise<void>;
  className?: string;
  indent?: boolean;
  onDrop?: (id: string, noteId: string) => void;
  // For folder icon editing - render function that receives editing state
  renderIcon?: (isEditing: boolean) => React.ReactNode;
}

export function EditableListItem({
  id,
  name,
  count,
  icon,
  isSelected,
  onSelect,
  onRename,
  onDelete,
  className = '',
  indent = false,
  onDrop,
  renderIcon,
}: EditableListItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editingName, setEditingName] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);

  const handleStartEdit = () => {
    setIsEditing(true);
    setEditingName(name);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingName('');
  };

  const handleSave = async () => {
    const trimmedName = editingName.trim();
    if (!trimmedName) return;

    try {
      await onRename(id, trimmedName);
      // Only clear editing state on success
      setIsEditing(false);
      setEditingName('');
    } catch (error) {
      // Parent component shows alert; keep edit mode open for retry
      console.error('Failed to save:', error);
    }
  };

  const handleDelete = async () => {
    await onDelete(id, name);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (onDrop) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setIsDragOver(true);
    }
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDropEvent = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    if (onDrop) {
      try {
        const rawData = e.dataTransfer.getData('application/json');

        // Validate data isn't oversized (prevent DoS)
        if (rawData.length > 10000) {
          console.warn('Drop data exceeds size limit');
          return;
        }

        const data = JSON.parse(rawData);

        // Validate schema: must be object with noteId string
        if (
          data &&
          typeof data === 'object' &&
          typeof data.noteId === 'string' &&
          data.noteId.length > 0 &&
          data.noteId.length < 100 // CUID is typically 25 chars
        ) {
          onDrop(id, data.noteId);
        }
      } catch (error) {
        // Silent fail for invalid drag data (don't expose internals)
        return;
      }
    }
  };

  const baseClassName = `group w-full px-4 py-2.5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 ${
    isSelected ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-600' : ''
  } ${indent ? 'pl-12' : ''} ${isDragOver ? 'bg-green-100 dark:bg-green-900/30 border-2 border-green-500' : ''} ${className}`;

  return (
    <div
      className={baseClassName}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDropEvent}
    >
      {isEditing ? (
        // Edit mode
        <div className="flex-1 space-y-2">
          <div className="flex items-center space-x-2">
            {renderIcon ? renderIcon(true) : icon && <div className="flex-shrink-0">{icon}</div>}
            <input
              type="text"
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              className="flex-1 min-w-0 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
                if (e.key === 'Escape') handleCancelEdit();
              }}
            />
          </div>
          <div className="flex justify-end space-x-1">
            <button
              onClick={handleCancelEdit}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
              title="Cancel"
            >
              <X className="w-4 h-4 text-red-600 dark:text-red-400" />
            </button>
            <button
              onClick={handleSave}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
              title="Save"
            >
              <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
            </button>
          </div>
        </div>
      ) : (
        // View mode
        <>
          <button onClick={onSelect} className={`flex items-center space-x-3 flex-1 ${indent ? '' : ''}`}>
            {renderIcon ? renderIcon(false) : icon && <div className="flex-shrink-0">{icon}</div>}
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{name}</span>
          </button>
          <div className="flex items-center space-x-1">
            {count !== undefined && (
              <span className="text-xs text-gray-500 dark:text-gray-400 mr-2">{count}</span>
            )}
            <button
              onClick={handleStartEdit}
              className="p-1 opacity-0 group-hover:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-opacity"
              title="Rename"
            >
              <Pencil className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" />
            </button>
            <button
              onClick={handleDelete}
              className="p-1 opacity-0 group-hover:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-opacity"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
