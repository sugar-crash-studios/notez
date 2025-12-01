import { useState } from 'react';
import {
  Folder,
  FolderOpen,
  Briefcase,
  Home,
  Star,
  Heart,
  Bookmark,
  FileText,
  Code,
  Terminal,
  Book,
  Archive,
  Inbox,
  Lightbulb,
  Target,
  Flag,
  Calendar,
  Clock,
  Users,
  User,
  Settings,
  Camera,
  Music,
  Video,
  Image,
  Globe,
  MapPin,
  ShoppingBag,
  // New icons for v0.30.2
  Palette,
  Paintbrush,
  Pencil,
  Pen,
  PenTool,
  Flower2,
  Drama,
  Coffee,
  Utensils,
  Gift,
  type LucideIcon,
} from 'lucide-react';

// Map icon names to Lucide components
export const FOLDER_ICON_MAP: Record<string, LucideIcon> = {
  'folder': Folder,
  'folder-open': FolderOpen,
  'briefcase': Briefcase,
  'home': Home,
  'star': Star,
  'heart': Heart,
  'bookmark': Bookmark,
  'file-text': FileText,
  'code': Code,
  'terminal': Terminal,
  'book': Book,
  'archive': Archive,
  'inbox': Inbox,
  'lightbulb': Lightbulb,
  'target': Target,
  'flag': Flag,
  'calendar': Calendar,
  'clock': Clock,
  'users': Users,
  'user': User,
  'settings': Settings,
  'camera': Camera,
  'music': Music,
  'video': Video,
  'image': Image,
  'globe': Globe,
  'map-pin': MapPin,
  'shopping-bag': ShoppingBag,
  // New icons for v0.30.2
  'palette': Palette,
  'paintbrush': Paintbrush,
  'pencil': Pencil,
  'pen': Pen,
  'pen-tool': PenTool,
  'flower': Flower2,
  'drama': Drama,
  'coffee': Coffee,
  'utensils': Utensils,
  'gift': Gift,
};

export const FOLDER_ICONS = Object.keys(FOLDER_ICON_MAP);

interface FolderIconPickerProps {
  selectedIcon: string;
  onSelectIcon: (icon: string) => void;
  disabled?: boolean;
}

export function FolderIconPicker({ selectedIcon, onSelectIcon, disabled }: FolderIconPickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const SelectedIconComponent = FOLDER_ICON_MAP[selectedIcon] || Folder;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="p-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Select folder icon"
      >
        <SelectedIconComponent className="w-5 h-5 text-gray-700 dark:text-gray-300" />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute z-20 mt-1 left-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-2 w-64">
            <div className="grid grid-cols-7 gap-1">
              {FOLDER_ICONS.map((iconName) => {
                const IconComponent = FOLDER_ICON_MAP[iconName];
                const isSelected = iconName === selectedIcon;

                return (
                  <button
                    key={iconName}
                    type="button"
                    onClick={() => {
                      onSelectIcon(iconName);
                      setIsOpen(false);
                    }}
                    className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                      isSelected
                        ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}
                    title={iconName}
                  >
                    <IconComponent className="w-4 h-4" />
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Helper component to render a folder icon by name
interface FolderIconProps {
  icon: string;
  className?: string;
}

export function FolderIcon({ icon, className = 'w-4 h-4' }: FolderIconProps) {
  const IconComponent = FOLDER_ICON_MAP[icon] || Folder;
  return <IconComponent className={className} />;
}
