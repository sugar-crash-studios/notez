import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FolderSidebar, FolderSidebarHandle } from '../components/FolderSidebar';
import { NoteList, NoteListHandle } from '../components/NoteList';
import { NoteEditor } from '../components/NoteEditor';
import { SearchBar } from '../components/SearchBar';
import { ThemeToggle } from '../components/ThemeToggle';
import { useAuth } from '../contexts/AuthContext';
import { Settings } from 'lucide-react';

export function EditorPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const noteListRef = useRef<NoteListHandle>(null);
  const sidebarRef = useRef<FolderSidebarHandle>(null);

  // Handle URL query parameter for note selection (from search)
  useEffect(() => {
    const noteId = searchParams.get('note');
    if (noteId) {
      setSelectedNoteId(noteId);
      // Clear the query parameter after setting the note
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  return (
    <div className="h-screen flex flex-col bg-gray-100 dark:bg-gray-900">
      {/* Top Navigation */}
      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Notez</h1>
        </div>
        <div className="flex items-center space-x-4">
          <SearchBar />
          <ThemeToggle />
          <button
            onClick={() => navigate('/settings')}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
          {user?.role === 'admin' && (
            <a
              href="/admin"
              className="px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 border border-blue-600 dark:border-blue-400 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20"
            >
              Admin Panel
            </a>
          )}
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {user?.username}
          </span>
          <button
            onClick={logout}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Logout
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Folder Sidebar */}
        <FolderSidebar
          ref={sidebarRef}
          selectedFolderId={selectedFolderId}
          selectedTagId={selectedTagId}
          onSelectFolder={(folderId) => {
            setSelectedFolderId(folderId);
            // Don't clear tag - allow combined filtering
            setSelectedNoteId(null); // Reset note selection when filter changes
          }}
          onSelectTag={(tagId) => {
            setSelectedTagId(tagId);
            // Don't clear folder - allow combined filtering
            setSelectedNoteId(null); // Reset note selection when filter changes
          }}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        {/* Note List */}
        <NoteList
          ref={noteListRef}
          folderId={selectedFolderId}
          tagId={selectedTagId}
          selectedNoteId={selectedNoteId}
          onSelectNote={setSelectedNoteId}
          onNoteCreated={() => {
            // Refresh sidebar counts after note creation
            sidebarRef.current?.refreshFolders();
          }}
        />

        {/* Note Editor */}
        <NoteEditor
          noteId={selectedNoteId}
          onNoteDeleted={(noteId) => {
            setSelectedNoteId(null);
            noteListRef.current?.removeNote(noteId);
            // Refresh sidebar counts after deletion
            sidebarRef.current?.refreshAll();
          }}
          onTagsChanged={() => {
            // Refresh tag counts when tags are added/removed
            sidebarRef.current?.refreshTags();
          }}
        />
      </div>
    </div>
  );
}
