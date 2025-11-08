import { useState, useEffect } from 'react';
import { X, FileText, Loader2 } from 'lucide-react';
import { tasksApi, foldersApi } from '../lib/api';
import type { ExtractedTask } from '../types';

interface TaskImportDialogProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface Folder {
  id: string;
  name: string;
}

export default function TaskImportDialog({ onClose, onSuccess }: TaskImportDialogProps) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');
  const [extractedTasks, setExtractedTasks] = useState<ExtractedTask[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadFolders();
  }, []);

  const loadFolders = async () => {
    try {
      const response = await foldersApi.list();
      setFolders(response.data.folders);
    } catch (error) {
      console.error('Failed to load folders:', error);
    }
  };

  const handleScan = async () => {
    setIsScanning(true);
    setError('');
    setExtractedTasks([]);

    try {
      const params: any = {};
      if (selectedFolderId) {
        params.folderId = selectedFolderId;
      }

      const response = await tasksApi.scan(params);
      setExtractedTasks(response.data.tasks);

      if (response.data.tasks.length === 0) {
        setError('No unchecked tasks found in notes.');
      }
    } catch (error: any) {
      console.error('Failed to scan notes:', error);
      setError(error.response?.data?.message || 'Failed to scan notes for tasks');
    } finally {
      setIsScanning(false);
    }
  };

  const handleImport = async () => {
    if (extractedTasks.length === 0) return;

    setIsImporting(true);
    setError('');

    try {
      const params: any = {};
      if (selectedFolderId) {
        params.folderId = selectedFolderId;
      }

      await tasksApi.import(params);
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Failed to import tasks:', error);
      setError(error.response?.data?.message || 'Failed to import tasks');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Import Tasks from Notes
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Scan your notes to find all unchecked task items (markdown format: - [ ] Task).
            Tasks will be imported as standalone tasks with links back to their original notes.
          </p>

          {error && (
            <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-md text-sm">
              {error}
            </div>
          )}

          {/* Folder Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Scan notes in folder (optional)
            </label>
            <select
              value={selectedFolderId}
              onChange={(e) => setSelectedFolderId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">All notes</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          </div>

          {/* Scan Button */}
          {extractedTasks.length === 0 && (
            <button
              onClick={handleScan}
              disabled={isScanning}
              className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isScanning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Scanning notes...
                </>
              ) : (
                'Scan for Tasks'
              )}
            </button>
          )}

          {/* Results */}
          {extractedTasks.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Found {extractedTasks.length} task{extractedTasks.length === 1 ? '' : 's'}
                </h3>
                <button
                  onClick={() => setExtractedTasks([])}
                  className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  Clear
                </button>
              </div>

              <div className="max-h-96 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-md">
                {extractedTasks.map((task, index) => (
                  <div
                    key={index}
                    className="p-3 border-b border-gray-200 dark:border-gray-700 last:border-b-0"
                  >
                    <div className="flex items-start gap-2">
                      <FileText className="w-4 h-4 text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {task.title}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          From: <span className="font-medium">{task.noteTitle}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Import Actions */}
              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => setExtractedTasks([])}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={isImporting}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    `Import ${extractedTasks.length} Task${extractedTasks.length === 1 ? '' : 's'}`
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
