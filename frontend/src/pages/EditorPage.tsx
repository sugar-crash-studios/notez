import { useState } from 'react';
import { FolderSidebar } from '../components/FolderSidebar';
import { NoteList } from '../components/NoteList';
import { NoteEditor } from '../components/NoteEditor';
import { useAuth } from '../contexts/AuthContext';

export function EditorPage() {
  const { user, logout } = useAuth();
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Top Navigation */}
      <nav className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-bold text-gray-900">Notez</h1>
        </div>
        <div className="flex items-center space-x-4">
          {user?.role === 'admin' && (
            <a
              href="/admin"
              className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 border border-blue-600 rounded-md hover:bg-blue-50"
            >
              Admin Panel
            </a>
          )}
          <span className="text-sm text-gray-600">
            {user?.username}
          </span>
          <button
            onClick={logout}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:text-gray-900 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Logout
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Folder Sidebar */}
        <FolderSidebar
          selectedFolderId={selectedFolderId}
          selectedTagId={selectedTagId}
          onSelectFolder={(folderId) => {
            setSelectedFolderId(folderId);
            setSelectedTagId(null);
            setSelectedNoteId(null); // Reset note selection when folder changes
          }}
          onSelectTag={(tagId) => {
            setSelectedTagId(tagId);
            setSelectedFolderId(null);
            setSelectedNoteId(null); // Reset note selection when tag changes
          }}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        {/* Note List */}
        <NoteList
          folderId={selectedFolderId}
          tagId={selectedTagId}
          selectedNoteId={selectedNoteId}
          onSelectNote={setSelectedNoteId}
        />

        {/* Note Editor */}
        <NoteEditor
          noteId={selectedNoteId}
          onNoteDeleted={() => setSelectedNoteId(null)}
        />
      </div>
    </div>
  );
}
