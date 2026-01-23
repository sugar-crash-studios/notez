// Task types
export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface TaskLink {
  id: string;
  url: string;
  title?: string | null;
  createdAt: string;
}

export interface Task {
  id: string;
  userId: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string | null;
  noteId?: string | null;
  noteTitle?: string | null;
  folderId?: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  folder?: {
    id: string;
    name: string;
  } | null;
  note?: {
    id: string;
    title: string;
  } | null;
  tags?: Array<{
    id: string;
    name: string;
  }>;
  links?: TaskLink[];
}

export interface TaskStats {
  totalTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
  completedTasks: number;
  overdueTasks: number;
}

export interface ExtractedTask {
  noteId: string;
  noteTitle: string;
  title: string;
  checked: boolean;
  folderId?: string | null;
}
