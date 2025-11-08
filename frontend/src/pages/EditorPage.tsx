import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FolderSidebar, type FolderSidebarHandle } from '../components/FolderSidebar';
import { NoteList, type NoteListHandle } from '../components/NoteList';
import { NoteEditor } from '../components/NoteEditor';
import TaskList from '../components/TaskList';
import { SearchBar } from '../components/SearchBar';
import { ThemeToggle } from '../components/ThemeToggle';
import { useAuth } from '../contexts/AuthContext';
import { Settings, Menu, FileText, Edit3, CheckSquare } from 'lucide-react';

export function EditorPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedView, setSelectedView] = useState<'notes' | 'tasks'>('notes');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileView, setMobileView] = useState<'sidebar' | 'list' | 'editor'>('list');
  const noteListRef = useRef<NoteListHandle>(null);
  const sidebarRef = useRef<FolderSidebarHandle>(null);

  // Handle URL query parameter for note selection (from search)
  useEffect(() => {
    const noteId = searchParams.get('note');
    if (noteId) {
      setSelectedNoteId(noteId);
      setSelectedView('notes');
      setMobileView('editor'); // Switch to editor on mobile when note is selected
      // Clear the query parameter after setting the note
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  // Auto-switch to editor view on mobile when a note is selected
  useEffect(() => {
    if (selectedNoteId && selectedView === 'notes') {
      setMobileView('editor');
    }
  }, [selectedNoteId, selectedView]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+N - Create new note
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        // Trigger note creation through noteListRef
        noteListRef.current?.refresh(); // This will be replaced with createNote method if we add it
        // For now, we'll keep the querySelector as a fallback
        const createButton = document.querySelector('[title="New note"]') as HTMLButtonElement;
        createButton?.click();
      }

      // Ctrl+F - Focus search (currently using querySelector, could be improved with SearchBar ref)
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
        searchInput?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleNoteClick = (noteId: string) => {
    setSelectedView('notes');
    setSelectedNoteId(noteId);
    setMobileView('editor');
  };

  return (
    <div className="h-screen flex flex-col bg-gray-100 dark:bg-gray-900">
      {/* Top Navigation */}
      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-2 md:space-x-4">
          <h1 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white">Notez</h1>
        </div>
        <div className="flex items-center space-x-2 md:space-x-4">
          <div className="hidden sm:block">
            <SearchBar />
          </div>
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
              className="hidden md:inline-block px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 border border-blue-600 dark:border-blue-400 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20"
            >
              Admin Panel
            </a>
          )}
          <span className="hidden md:inline text-sm text-gray-600 dark:text-gray-400">
            {user?.username}
          </span>
          <button
            onClick={logout}
            className="px-2 md:px-3 py-1.5 text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Logout
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden pb-20 xl:pb-0 ">
        {/* Folder Sidebar - Hidden on mobile unless mobileView === 'sidebar' */}
        <div className={`${mobileView === 'sidebar' ? 'block' : 'hidden'} xl:block`}>
          <FolderSidebar
            ref={sidebarRef}
            selectedFolderId={selectedFolderId}
            selectedTagId={selectedTagId}
            selectedView={selectedView}
            onSelectFolder={(folderId) => {
              setSelectedFolderId(folderId);
              setSelectedNoteId(null);
              setSelectedView('notes'); // Switch to notes view when folder is selected
              setMobileView('list'); // Switch to list view on mobile after selecting folder
            }}
            onSelectTag={(tagId) => {
              setSelectedTagId(tagId);
              setSelectedNoteId(null);
              setSelectedView('notes'); // Switch to notes view when tag is selected
              setMobileView('list'); // Switch to list view on mobile after selecting tag
            }}
            onSelectView={(view) => {
              setSelectedView(view);
              setSelectedNoteId(null);
              setMobileView('list'); // Switch to list view on mobile after selecting view
            }}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
            onNoteMoved={() => {
              // Refresh note list when a note is moved via drag-and-drop
              noteListRef.current?.refresh();
            }}
          />
        </div>

        {/* Note List or Task List - Hidden on mobile unless mobileView === 'list' */}
        <div className={`${mobileView === 'list' ? 'block' : 'hidden'} xl:block`}>
          {selectedView === 'notes' ? (
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
          ) : (
            <TaskList onNoteClick={handleNoteClick} />
          )}
        </div>

        {/* Note Editor - Hidden on mobile unless mobileView === 'editor' */}
        {selectedView === 'notes' && (
          <div className={`flex-1 flex-col min-h-0 ${mobileView === 'editor' ? 'flex' : 'hidden'} xl:flex`}>
            <NoteEditor
              noteId={selectedNoteId}
              onNoteDeleted={(noteId) => {
                setSelectedNoteId(null);
                setMobileView('list'); // Return to list view on mobile after deleting
                noteListRef.current?.removeNote(noteId);
                sidebarRef.current?.refreshAll();
              }}
              onTagsChanged={() => {
                sidebarRef.current?.refreshTags();
              }}
              onNoteUpdated={(noteId, updates) => {
                noteListRef.current?.updateNote(noteId, updates);
              }}
              onNoteRestored={(noteId) => {
                setSelectedNoteId(null);
                setMobileView('list'); // Return to list view on mobile after restoring
                noteListRef.current?.removeNote(noteId); // Remove from trash list
                sidebarRef.current?.refreshAll(); // Refresh counts
              }}
            />
          </div>
        )}
      </div>

      {/* Mobile Bottom Navigation - Only visible on small screens */}
      <div className="xl:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex justify-around py-4 px-2 min-h-[60px] z-50">
        <button
          onClick={() => setMobileView('sidebar')}
          className={`flex flex-col items-center px-4 py-2 rounded-md ${
            mobileView === 'sidebar'
              ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
              : 'text-gray-600 dark:text-gray-400'
          }`}
        >
          <Menu className="w-5 h-5" />
          <span className="text-xs mt-1">Folders</span>
        </button>
        <button
          onClick={() => {
            setMobileView('list');
            setSelectedView('notes');
          }}
          className={`flex flex-col items-center px-4 py-2 rounded-md ${
            mobileView === 'list' && selectedView === 'notes'
              ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
              : 'text-gray-600 dark:text-gray-400'
          }`}
        >
          <FileText className="w-5 h-5" />
          <span className="text-xs mt-1">Notes</span>
        </button>
        <button
          onClick={() => {
            setMobileView('list');
            setSelectedView('tasks');
          }}
          className={`flex flex-col items-center px-4 py-2 rounded-md ${
            mobileView === 'list' && selectedView === 'tasks'
              ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
              : 'text-gray-600 dark:text-gray-400'
          }`}
        >
          <CheckSquare className="w-5 h-5" />
          <span className="text-xs mt-1">Tasks</span>
        </button>
        <button
          onClick={() => setMobileView('editor')}
          className={`flex flex-col items-center px-4 py-2 rounded-md ${
            mobileView === 'editor'
              ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
              : 'text-gray-600 dark:text-gray-400'
          }`}
          disabled={!selectedNoteId || selectedView !== 'notes'}
        >
          <Edit3 className="w-5 h-5" />
          <span className="text-xs mt-1">Editor</span>
        </button>
      </div>
    </div>
  );
}
