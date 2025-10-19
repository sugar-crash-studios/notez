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
}: EditableListItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editingName, setEditingName] = useState('');

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

    setIsEditing(false);
    setEditingName('');
    await onRename(id, trimmedName);
  };

  const handleDelete = async () => {
    await onDelete(id, name);
  };

  const baseClassName = `group w-full px-4 py-2.5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 ${
    isSelected ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-600' : ''
  } ${indent ? 'pl-12' : ''} ${className}`;

  return (
    <div className={baseClassName}>
      {isEditing ? (
        // Edit mode
        <div className="flex items-center space-x-2 flex-1">
          {icon && <div className="flex-shrink-0">{icon}</div>}
          <input
            type="text"
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') handleCancelEdit();
            }}
          />
          <button
            onClick={handleSave}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
            title="Save"
          >
            <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
          </button>
          <button
            onClick={handleCancelEdit}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
            title="Cancel"
          >
            <X className="w-4 h-4 text-red-600 dark:text-red-400" />
          </button>
        </div>
      ) : (
        // View mode
        <>
          <button onClick={onSelect} className={`flex items-center space-x-3 flex-1 ${indent ? '' : ''}`}>
            {icon && <div className="flex-shrink-0">{icon}</div>}
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
