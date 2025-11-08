import axios from 'axios';

// API base URL - use environment variable or default to relative path for production
// In production (same-origin), use '' (relative) so API calls go to same domain
// In development (different ports), use localhost:3000
const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3000' : '');

// Create axios instance with default config
export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Important for cookies (refresh token)
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add access token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and we haven't tried to refresh yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Try to refresh the token
        const response = await axios.post(
          `${API_BASE_URL}/api/auth/refresh`,
          {},
          { withCredentials: true }
        );

        const { accessToken } = response.data;

        // Store new access token
        localStorage.setItem('accessToken', accessToken);

        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed, clear tokens and signal auth failure
        localStorage.removeItem('accessToken');
        // Dispatch custom event to notify AuthContext
        window.dispatchEvent(new Event('auth-failure'));
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// API endpoints
export const authApi = {
  setupNeeded: () => api.get('/api/auth/setup-needed'),

  setup: (data: { username: string; email: string; password: string }) =>
    api.post('/api/auth/setup', data),

  login: (credentials: { usernameOrEmail: string; password: string }) =>
    api.post('/api/auth/login', credentials),

  logout: () => api.post('/api/auth/logout'),

  refresh: () => api.post('/api/auth/refresh'),

  me: () => api.get('/api/auth/me'),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.post('/api/auth/change-password', data),
};

export const notesApi = {
  list: (params?: { folderId?: string; tagId?: string; search?: string; limit?: number; offset?: number }) =>
    api.get('/api/notes', { params }),

  get: (id: string) => api.get(`/api/notes/${id}`),

  create: (data: { title: string; content?: string; folderId?: string; tags?: string[] }) =>
    api.post('/api/notes', data),

  update: (id: string, data: { title?: string; content?: string; folderId?: string | null; tags?: string[] }) =>
    api.patch(`/api/notes/${id}`, data),

  delete: (id: string) => api.delete(`/api/notes/${id}`),

  stats: () => api.get('/api/notes/stats'),

  // Trash operations
  listTrash: () =>
    api.get('/api/notes/trash').catch((error) => {
      console.error('Failed to list trash notes:', error);
      throw error;
    }),

  restore: (id: string) =>
    api.post(`/api/notes/${id}/restore`).catch((error) => {
      console.error('Failed to restore note:', error);
      throw error;
    }),

  permanentDelete: (id: string) =>
    api.delete(`/api/notes/${id}/permanent`).catch((error) => {
      console.error('Failed to permanently delete note:', error);
      throw error;
    }),
};

export const foldersApi = {
  list: () => api.get('/api/folders'),

  get: (id: string) => api.get(`/api/folders/${id}`),

  create: (data: { name: string }) => api.post('/api/folders', data),

  update: (id: string, data: { name: string }) => api.patch(`/api/folders/${id}`, data),

  delete: (id: string) => api.delete(`/api/folders/${id}`),

  stats: () => api.get('/api/folders/stats'),
};

export const usersApi = {
  list: (includeInactive?: boolean) => api.get('/api/users', { params: { includeInactive } }),

  get: (id: string) => api.get(`/api/users/${id}`),

  create: (data: { username: string; email: string; password: string; role?: string }) =>
    api.post('/api/users', data),

  update: (id: string, data: { username?: string; email?: string; role?: string; isActive?: boolean }) =>
    api.patch(`/api/users/${id}`, data),

  delete: (id: string) => api.delete(`/api/users/${id}`),

  resetPassword: (id: string, newPassword: string) =>
    api.post(`/api/users/${id}/reset-password`, { newPassword }),

  stats: () => api.get('/api/users/stats'),
};

export const systemApi = {
  getInfo: () => api.get('/api/system/info'),
};

export const tagsApi = {
  list: () => api.get('/api/tags'),

  get: (id: string) => api.get(`/api/tags/${id}`),

  search: (query?: string, limit?: number) =>
    api.get('/api/tags/search', { params: { q: query, limit } }),

  rename: (id: string, name: string) => api.patch(`/api/tags/${id}`, { name }),

  delete: (id: string) => api.delete(`/api/tags/${id}`),

  stats: () => api.get('/api/tags/stats'),
};

export const aiApi = {
  // AI Settings (Admin only)
  getSettings: () => api.get('/api/ai/settings'),

  saveSettings: (data: { provider: 'anthropic' | 'openai' | 'gemini'; apiKey: string; model?: string }) =>
    api.put('/api/ai/settings', data),

  testConnection: (data: { provider: 'anthropic' | 'openai' | 'gemini'; apiKey: string; model?: string }) =>
    api.post('/api/ai/test-connection', data),

  listModels: (data: { provider: 'anthropic' | 'openai' | 'gemini'; apiKey: string; model?: string }) =>
    api.post('/api/ai/list-models', data),

  // AI Features
  summarize: (data: { content: string; maxLength?: number }) =>
    api.post('/api/ai/summarize', data),

  suggestTitle: (data: { content: string; maxLength?: number }) =>
    api.post('/api/ai/suggest-title', data),

  suggestTags: (data: { content: string; maxTags?: number }) =>
    api.post('/api/ai/suggest-tags', data),
};

export const searchApi = {
  search: (params: { q: string; folderId?: string; limit?: number; offset?: number }) =>
    api.get('/api/search', { params }),
};

export const tasksApi = {
  list: (params?: {
    status?: string | string[];
    priority?: string;
    folderId?: string;
    noteId?: string;
    tagId?: string;
    overdue?: boolean;
    limit?: number;
    offset?: number;
  }) => api.get('/api/tasks', { params }),

  get: (id: string) => api.get(`/api/tasks/${id}`),

  create: (data: {
    title: string;
    description?: string;
    status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    dueDate?: string;
    noteId?: string;
    folderId?: string;
    tags?: string[];
  }) => api.post('/api/tasks', data),

  update: (
    id: string,
    data: {
      title?: string;
      description?: string;
      status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
      priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
      dueDate?: string | null;
      noteId?: string | null;
      folderId?: string | null;
      tags?: string[];
    }
  ) => api.put(`/api/tasks/${id}`, data),

  updateStatus: (id: string, status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED') =>
    api.patch(`/api/tasks/${id}/status`, { status }),

  delete: (id: string) => api.delete(`/api/tasks/${id}`),

  stats: () => api.get('/api/tasks/stats'),

  // Task import operations
  scan: (data?: { folderId?: string; noteIds?: string[] }) =>
    api.post('/api/tasks/scan', data || {}),

  import: (data: { tasks: Array<{
    noteId: string;
    noteTitle: string;
    title: string;
    checked: boolean;
    folderId?: string | null;
  }> }) =>
    api.post('/api/tasks/import', data),
};
