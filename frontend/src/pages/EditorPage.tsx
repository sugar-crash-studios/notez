import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FolderSidebar, type FolderSidebarHandle } from '../components/FolderSidebar';
import { NoteList, type NoteListHandle } from '../components/NoteList';
import { NoteEditor } from '../components/NoteEditor';
import TaskList from '../components/TaskList';
import KanbanBoard from '../components/KanbanBoard';
import TaskForm from '../components/TaskForm';
import { AppHeader } from '../components/AppHeader';
import { Menu, FileText, Edit3, CheckSquare, LayoutList, Columns } from 'lucide-react';
import type { Task } from '../types';

// localStorage keys
const SIDEBAR_COLLAPSED_KEY = 'notez-sidebar-collapsed';
const TASK_VIEW_MODE_KEY = 'notez-task-view-mode';

export function EditorPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedView, setSelectedView] = useState<'notes' | 'tasks'>('notes');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    // Initialize from localStorage
    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    return saved === 'true';
  });
  const [taskViewMode, setTaskViewMode] = useState<'list' | 'kanban'>(() => {
    const saved = localStorage.getItem(TASK_VIEW_MODE_KEY);
    return (saved === 'kanban' ? 'kanban' : 'list') as 'list' | 'kanban';
  });
  const [mobileView, setMobileView] = useState<'sidebar' | 'list' | 'editor'>('list');
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [kanbanKey, setKanbanKey] = useState(0); // For refreshing kanban
  const noteListRef = useRef<NoteListHandle>(null);
  const sidebarRef = useRef<FolderSidebarHandle>(null);

  // Persist sidebar collapsed state
  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  // Persist task view mode
  useEffect(() => {
    localStorage.setItem(TASK_VIEW_MODE_KEY, taskViewMode);
  }, [taskViewMode]);

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
      <AppHeader />

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
        <div className={`${mobileView === 'list' ? 'block' : 'hidden'} xl:block ${selectedView === 'tasks' && taskViewMode === 'kanban' ? 'xl:w-80' : ''}`}>
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
            <div className="flex flex-col h-full">
              {/* Task View Mode Toggle */}
              <div className="hidden xl:flex items-center justify-end gap-1 p-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setTaskViewMode('list')}
                  className={`p-1.5 rounded ${
                    taskViewMode === 'list'
                      ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                  title="List view"
                >
                  <LayoutList className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setTaskViewMode('kanban')}
                  className={`p-1.5 rounded ${
                    taskViewMode === 'kanban'
                      ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                  title="Kanban view"
                >
                  <Columns className="w-4 h-4" />
                </button>
              </div>
              <TaskList onNoteClick={handleNoteClick} />
            </div>
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
                // Refresh folder counts if folder changed
                if (updates.folderId !== undefined) {
                  sidebarRef.current?.refreshFolders();
                }
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

        {/* Kanban Board - Only visible on desktop when tasks view + kanban mode */}
        {selectedView === 'tasks' && taskViewMode === 'kanban' && (
          <div className="hidden xl:flex flex-1 flex-col min-h-0">
            <KanbanBoard
              key={kanbanKey}
              onNoteClick={handleNoteClick}
              onTaskClick={(task) => setEditingTask(task)}
            />
          </div>
        )}
      </div>

      {/* Task Edit Modal */}
      {editingTask && (
        <TaskForm
          task={editingTask}
          onClose={() => setEditingTask(null)}
          onSuccess={() => {
            setEditingTask(null);
            // Refresh kanban board
            setKanbanKey((k) => k + 1);
          }}
        />
      )}

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
