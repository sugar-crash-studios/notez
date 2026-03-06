# Notez Development Patterns

> Reference guide for consistent development practices
> Generated: 2025-11-29

## Backend Patterns

### Project Structure

```
backend/src/
├── index.ts              # Entry point, server setup
├── config/               # Configuration
├── lib/                  # Shared utilities
│   ├── db.ts            # Prisma client singleton
│   └── database-url.ts  # URL construction
├── middleware/           # Express-style middleware
│   ├── auth.middleware.ts
│   └── validate.middleware.ts
├── routes/               # Route handlers (controllers)
├── services/             # Business logic
└── utils/                # Helpers
    ├── encryption.ts
    ├── errors.ts
    ├── jwt.utils.ts
    └── validation.schemas.ts
```

### Route Handler Pattern

Routes follow a consistent pattern using Fastify plugins:

```typescript
// backend/src/routes/example.routes.ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as exampleService from '../services/example.service.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { validateBody, validateParams } from '../middleware/validate.middleware.js';

const idParamSchema = z.object({
  id: z.string().uuid('Invalid ID format'),
});

export async function exampleRoutes(fastify: FastifyInstance) {
  // Apply auth to all routes in this plugin
  fastify.addHook('preHandler', authenticateToken);

  // GET /api/examples
  fastify.get('/examples', async (request, reply) => {
    try {
      const userId = request.user!.userId;
      const result = await exampleService.list(userId);
      return result;
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to list examples',
      });
    }
  });

  // POST /api/examples
  fastify.post(
    '/examples',
    {
      preHandler: validateBody(createExampleSchema),
    },
    async (request, reply) => {
      try {
        const userId = request.user!.userId;
        const result = await exampleService.create(userId, request.body);
        return reply.status(201).send(result);
      } catch (error) {
        // Handle specific errors
        if (error instanceof Error && error.message.includes('not found')) {
          return reply.status(404).send({
            error: 'Not Found',
            message: error.message,
          });
        }
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to create example',
        });
      }
    }
  );
}
```

### Service Layer Pattern

Services contain business logic and database access:

```typescript
// backend/src/services/example.service.ts
import { prisma } from '../lib/db.js';

export async function list(userId: string) {
  const items = await prisma.example.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
  return { items, total: items.length };
}

export async function getById(id: string, userId: string) {
  const item = await prisma.example.findFirst({
    where: { id, userId },
  });

  if (!item) {
    throw new Error('Example not found');
  }

  return item;
}

export async function create(userId: string, data: CreateInput) {
  return prisma.example.create({
    data: {
      ...data,
      userId,
    },
  });
}
```

### Validation Schema Pattern

Using Zod for runtime validation:

```typescript
// backend/src/utils/validation.schemas.ts
import { z } from 'zod';

export const createExampleSchema = z.object({
  title: z.string().min(1).max(500),
  content: z.string().optional(),
  folderId: z.string().uuid().optional().nullable(),
});

export type CreateExampleInput = z.infer<typeof createExampleSchema>;
```

### Error Handling Pattern

Consistent error responses:

```typescript
// Success responses
return { data: result };
return reply.status(201).send({ message: 'Created', data: result });

// Error responses
return reply.status(400).send({ error: 'Bad Request', message: 'Validation failed' });
return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid credentials' });
return reply.status(404).send({ error: 'Not Found', message: 'Resource not found' });
return reply.status(500).send({ error: 'Internal Server Error', message: 'Operation failed' });
```

---

## Frontend Patterns

### Project Structure

```
frontend/src/
├── main.tsx              # Entry point
├── App.tsx               # Root component with routing
├── components/           # Reusable components
├── pages/                # Route-level components
├── contexts/             # React contexts
├── lib/                  # Utilities
│   └── api.ts           # API client
└── types/                # TypeScript types
```

### Component Pattern

Functional components with TypeScript:

```tsx
// frontend/src/components/ExampleComponent.tsx
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { exampleApi } from '../lib/api';

interface ExampleComponentProps {
  id: string;
  onUpdate?: (data: Example) => void;
}

export function ExampleComponent({ id, onUpdate }: ExampleComponentProps) {
  const queryClient = useQueryClient();

  // Fetch data
  const { data, isLoading, error } = useQuery({
    queryKey: ['example', id],
    queryFn: () => exampleApi.get(id),
  });

  // Mutation
  const updateMutation = useMutation({
    mutationFn: (data: UpdateData) => exampleApi.update(id, data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['examples'] });
      onUpdate?.(result.data);
    },
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg">
      {/* Component content */}
    </div>
  );
}
```

### API Client Pattern

Axios-based API client with interceptors:

```typescript
// frontend/src/lib/api.ts
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:3000' : '');

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 with token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;
      try {
        const { data } = await axios.post(`${API_BASE_URL}/api/auth/refresh`, {},
          { withCredentials: true });
        localStorage.setItem('accessToken', data.accessToken);
        error.config.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(error.config);
      } catch {
        localStorage.removeItem('accessToken');
        window.dispatchEvent(new Event('auth-failure'));
      }
    }
    return Promise.reject(error);
  }
);

// API namespaces
export const exampleApi = {
  list: () => api.get('/api/examples'),
  get: (id: string) => api.get(`/api/examples/${id}`),
  create: (data: CreateData) => api.post('/api/examples', data),
  update: (id: string, data: UpdateData) => api.patch(`/api/examples/${id}`, data),
  delete: (id: string) => api.delete(`/api/examples/${id}`),
};
```

### Context Pattern

React context for global state:

```tsx
// frontend/src/contexts/ExampleContext.tsx
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface ExampleContextType {
  value: string;
  setValue: (v: string) => void;
}

const ExampleContext = createContext<ExampleContextType | undefined>(undefined);

export function ExampleProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState('');

  return (
    <ExampleContext.Provider value={{ value, setValue }}>
      {children}
    </ExampleContext.Provider>
  );
}

export function useExample() {
  const context = useContext(ExampleContext);
  if (!context) {
    throw new Error('useExample must be used within ExampleProvider');
  }
  return context;
}
```

### Page Component Pattern

```tsx
// frontend/src/pages/ExamplePage.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ExampleComponent } from '../components/ExampleComponent';

export function ExamplePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <nav className="bg-white dark:bg-gray-800 border-b">
        {/* Navigation */}
      </nav>
      <main className="container mx-auto p-4">
        <ExampleComponent id={selectedId} />
      </main>
    </div>
  );
}
```

---

## Styling Patterns

### Tailwind CSS Conventions

```tsx
// Dark mode support
<div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">

// Responsive design
<div className="hidden md:block">  {/* Hidden on mobile */}
<div className="block md:hidden">  {/* Shown only on mobile */}

// Common button styles
<button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md">

// Card pattern
<div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">

// Form input
<input className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500" />
```

---

## Database Patterns

### Prisma Query Patterns

```typescript
// Include relations
const note = await prisma.note.findUnique({
  where: { id },
  include: {
    folder: true,
    tags: { include: { tag: true } },
  },
});

// Filter by user ownership
const notes = await prisma.note.findMany({
  where: { userId, deleted: false },
  orderBy: { updatedAt: 'desc' },
});

// Pagination
const notes = await prisma.note.findMany({
  where: { userId },
  take: limit,
  skip: offset,
});

// Count total
const total = await prisma.note.count({ where: { userId } });

// Transaction
await prisma.$transaction([
  prisma.noteTag.deleteMany({ where: { noteId } }),
  prisma.note.delete({ where: { id: noteId } }),
]);
```

### Many-to-Many with Tags

```typescript
// Add tags to note
await prisma.note.update({
  where: { id: noteId },
  data: {
    tags: {
      deleteMany: {},  // Remove existing
      create: tagIds.map(tagId => ({ tagId })),
    },
  },
});

// Query notes with specific tag
const notes = await prisma.note.findMany({
  where: {
    userId,
    tags: { some: { tagId } },
  },
});
```

---

## Authentication Patterns

### JWT Token Flow

1. Login → Server returns access token + sets refresh token cookie
2. Access token stored in localStorage (1 hour expiry)
3. Refresh token in httpOnly cookie (7 days expiry)
4. Axios interceptor adds `Authorization: Bearer {token}` to requests
5. On 401, interceptor calls `/api/auth/refresh`
6. New tokens issued, original request retried

### Protected Route Pattern

```tsx
// frontend/src/components/ProtectedRoute.tsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
```

---

## AI Integration Pattern

### Provider Abstraction

```typescript
// backend/src/services/ai/types.ts
export interface AIProvider {
  summarize(content: string, maxLength?: number): Promise<string>;
  suggestTitle(content: string): Promise<string>;
  suggestTags(content: string, existingTags?: string[]): Promise<string[]>;
  testConnection(): Promise<boolean>;
  listModels?(): Promise<string[]>;
}

// backend/src/services/ai/providers/anthropic.provider.ts
export class AnthropicProvider implements AIProvider {
  private client: Anthropic;

  constructor(apiKey: string, model?: string) {
    this.client = new Anthropic({ apiKey });
    this.model = model || 'claude-3-sonnet-20240229';
  }

  async summarize(content: string, maxLength = 200): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: maxLength,
      messages: [{ role: 'user', content: `Summarize: ${content}` }],
    });
    return response.content[0].text;
  }
}
```

---

## File Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| Route files | `{resource}.routes.ts` | `notes.routes.ts` |
| Service files | `{resource}.service.ts` | `note.service.ts` |
| React components | `PascalCase.tsx` | `NoteEditor.tsx` |
| React pages | `{Name}Page.tsx` | `EditorPage.tsx` |
| Contexts | `{Name}Context.tsx` | `AuthContext.tsx` |
| Utility files | `camelCase.ts` | `validation.schemas.ts` |
| Test files | `{file}.test.ts` | `note.service.test.ts` |
