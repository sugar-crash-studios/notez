import { useState, useEffect, useRef } from 'react';
import { Loader2, Circle, PlayCircle, CheckCircle2, XCircle, Clock, AlertCircle, FileText, Link2 } from 'lucide-react';
import { tasksApi } from '../lib/api';
import type { Task, TaskStatus, TaskPriority } from '../types';

interface KanbanBoardProps {
  onNoteClick?: (noteId: string) => void;
  onTaskClick?: (task: Task) => void;
}

interface KanbanColumn {
  status: TaskStatus;
  title: string;
  icon: React.ReactNode;
  bgColor: string;
  headerColor: string;
}

const COLUMNS: KanbanColumn[] = [
  {
    status: 'PENDING',
    title: 'Pending',
    icon: <Circle className="w-4 h-4" />,
    bgColor: 'bg-gray-50 dark:bg-gray-900/50',
    headerColor: 'text-gray-600 dark:text-gray-400',
  },
  {
    status: 'IN_PROGRESS',
    title: 'In Progress',
    icon: <PlayCircle className="w-4 h-4" />,
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    headerColor: 'text-blue-600 dark:text-blue-400',
  },
  {
    status: 'COMPLETED',
    title: 'Completed',
    icon: <CheckCircle2 className="w-4 h-4" />,
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    headerColor: 'text-green-600 dark:text-green-400',
  },
  {
    status: 'CANCELLED',
    title: 'Cancelled',
    icon: <XCircle className="w-4 h-4" />,
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    headerColor: 'text-red-600 dark:text-red-400',
  },
];

const priorityColors: Record<TaskPriority, string> = {
  LOW: 'border-l-gray-400',
  MEDIUM: 'border-l-blue-400',
  HIGH: 'border-l-orange-400',
  URGENT: 'border-l-red-500',
};

const priorityBadgeColors: Record<TaskPriority, string> = {
  LOW: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  MEDIUM: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400',
  HIGH: 'bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400',
  URGENT: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400',
};

export default function KanbanBoard({ onNoteClick, onTaskClick }: KanbanBoardProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [draggingTask, setDraggingTask] = useState<Task | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const dragCounter = useRef<Record<string, number>>({});

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    setIsLoading(true);
    try {
      // Load all tasks without status filter for kanban view
      const response = await tasksApi.list({ limit: 200 });
      setTasks(response.data.tasks);
    } catch (error) {
      console.error('Failed to load tasks:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getTasksByStatus = (status: TaskStatus) => {
    return tasks.filter((task) => task.status === status);
  };

  const handleDragStart = (e: React.DragEvent, task: Task) => {
    setDraggingTask(task);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', task.id);
    // Add dragging class after a short delay for visual feedback
    setTimeout(() => {
      const element = document.getElementById(`kanban-card-${task.id}`);
      element?.classList.add('opacity-50');
    }, 0);
  };

  const handleDragEnd = () => {
    setDraggingTask(null);
    setDragOverColumn(null);
    dragCounter.current = {};
    // Remove opacity from all cards
    const elements = document.querySelectorAll('[id^="kanban-card-"]');
    elements.forEach((el) => el.classList.remove('opacity-50'));
  };

  const handleDragEnter = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    dragCounter.current[status] = (dragCounter.current[status] || 0) + 1;
    if (draggingTask && draggingTask.status !== status) {
      setDragOverColumn(status);
    }
  };

  const handleDragLeave = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    dragCounter.current[status] = (dragCounter.current[status] || 0) - 1;
    if (dragCounter.current[status] <= 0) {
      dragCounter.current[status] = 0;
      if (dragOverColumn === status) {
        setDragOverColumn(null);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, newStatus: TaskStatus) => {
    e.preventDefault();
    setDragOverColumn(null);
    dragCounter.current = {};

    if (!draggingTask || draggingTask.status === newStatus) {
      return;
    }

    const taskId = draggingTask.id;
    setIsUpdating(taskId);

    // Optimistic update
    setTasks((prevTasks) =>
      prevTasks.map((task) =>
        task.id === taskId ? { ...task, status: newStatus } : task
      )
    );

    try {
      await tasksApi.updateStatus(taskId, newStatus);
    } catch (error) {
      console.error('Failed to update task status:', error);
      // Revert on failure
      loadTasks();
    } finally {
      setIsUpdating(null);
      setDraggingTask(null);
    }
  };

  const formatDueDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const isOverdue = (task: Task) => {
    return (
      task.dueDate &&
      new Date(task.dueDate) < new Date() &&
      task.status !== 'COMPLETED' &&
      task.status !== 'CANCELLED'
    );
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading tasks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-100 dark:bg-gray-900 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Kanban Board</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Drag tasks between columns to update their status
        </p>
      </div>

      {/* Kanban Columns */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
        <div className="flex gap-4 h-full min-w-max">
          {COLUMNS.map((column) => {
            const columnTasks = getTasksByStatus(column.status);
            const isDragOver = dragOverColumn === column.status;

            return (
              <div
                key={column.status}
                className={`flex flex-col w-72 rounded-lg ${column.bgColor} ${
                  isDragOver ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-gray-900' : ''
                } transition-all`}
                onDragEnter={(e) => handleDragEnter(e, column.status)}
                onDragLeave={(e) => handleDragLeave(e, column.status)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, column.status)}
              >
                {/* Column Header */}
                <div className={`flex items-center gap-2 px-3 py-2 ${column.headerColor}`}>
                  {column.icon}
                  <span className="font-medium">{column.title}</span>
                  <span className="ml-auto text-sm bg-white dark:bg-gray-800 px-2 py-0.5 rounded-full">
                    {columnTasks.length}
                  </span>
                </div>

                {/* Column Content */}
                <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2">
                  {columnTasks.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">
                      {isDragOver ? 'Drop here' : 'No tasks'}
                    </div>
                  ) : (
                    columnTasks.map((task) => (
                      <div
                        id={`kanban-card-${task.id}`}
                        key={task.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, task)}
                        onDragEnd={handleDragEnd}
                        onClick={() => onTaskClick?.(task)}
                        className={`
                          bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700
                          border-l-4 ${priorityColors[task.priority]}
                          p-3 cursor-grab active:cursor-grabbing
                          hover:shadow-md transition-shadow
                          ${isUpdating === task.id ? 'opacity-50' : ''}
                          ${isOverdue(task) ? 'ring-1 ring-red-500' : ''}
                        `}
                      >
                        {/* Task Title */}
                        <h3 className="font-medium text-sm text-gray-900 dark:text-white line-clamp-2">
                          {task.title}
                        </h3>

                        {/* Task Meta */}
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                          {/* Priority Badge */}
                          <span className={`px-1.5 py-0.5 rounded ${priorityBadgeColors[task.priority]}`}>
                            {task.priority.charAt(0) + task.priority.slice(1).toLowerCase()}
                          </span>

                          {/* Due Date */}
                          {task.dueDate && (
                            <span
                              className={`flex items-center gap-1 ${
                                isOverdue(task)
                                  ? 'text-red-600 dark:text-red-400 font-medium'
                                  : 'text-gray-500 dark:text-gray-400'
                              }`}
                            >
                              {isOverdue(task) ? (
                                <AlertCircle className="w-3 h-3" />
                              ) : (
                                <Clock className="w-3 h-3" />
                              )}
                              {formatDueDate(task.dueDate)}
                            </span>
                          )}
                        </div>

                        {/* Additional Info Row */}
                        <div className="mt-2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                          {/* Folder */}
                          {task.folder && (
                            <span className="truncate max-w-[80px]" title={task.folder.name}>
                              {task.folder.name}
                            </span>
                          )}

                          {/* Note Link */}
                          {task.note && onNoteClick && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onNoteClick(task.note!.id);
                              }}
                              className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400"
                              title={`From note: ${task.note.title}`}
                            >
                              <FileText className="w-3 h-3" />
                            </button>
                          )}

                          {/* Links indicator */}
                          {task.links && task.links.length > 0 && (
                            <span className="flex items-center gap-1" title={`${task.links.length} link(s)`}>
                              <Link2 className="w-3 h-3" />
                              {task.links.length}
                            </span>
                          )}

                          {/* Tags */}
                          {task.tags && task.tags.length > 0 && (
                            <div className="flex gap-1 ml-auto">
                              {task.tags.slice(0, 1).map((tag) => (
                                <span
                                  key={tag.id}
                                  className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs"
                                >
                                  {tag.name}
                                </span>
                              ))}
                              {task.tags.length > 1 && (
                                <span className="text-xs">+{task.tags.length - 1}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
