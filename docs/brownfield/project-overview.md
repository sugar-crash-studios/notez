# Notez - Project Overview

> Auto-generated brownfield documentation for AI-assisted development
> Generated: 2025-11-29

## Executive Summary

**Notez** is a self-hosted, web-based note-taking application with AI-powered features. It provides a modern, secure environment for personal note management with organizational features (folders, tags), full-text search, and AI integration for summarization, title suggestions, and tag extraction.

## Project Classification

| Attribute | Value |
|-----------|-------|
| **Project Type** | Multi-part Monorepo |
| **Architecture** | Client-Server (SPA + REST API) |
| **Primary Language** | TypeScript |
| **Deployment Model** | Docker Container (self-hosted) |
| **Database** | PostgreSQL 16 |
| **Status** | MVP Complete, Production Ready |

## Technology Stack

### Backend (`/backend`)

| Layer | Technology | Version |
|-------|------------|---------|
| Runtime | Node.js | 20 LTS |
| Framework | Fastify | 5.x |
| Language | TypeScript | 5.9.x |
| ORM | Prisma | 5.20.x |
| Database | PostgreSQL | 16 |
| Auth | JWT (@fastify/jwt) | 9.x |
| Validation | Zod | 3.23.x |
| AI SDKs | Anthropic, OpenAI, Google Generative AI | Latest |

### Frontend (`/frontend`)

| Layer | Technology | Version |
|-------|------------|---------|
| Framework | React | 19.x |
| Build Tool | Vite | 7.x |
| Language | TypeScript | 5.9.x |
| Styling | Tailwind CSS | 3.4.x |
| State (Server) | TanStack Query | 5.x |
| State (Client) | Zustand | 5.x |
| Routing | React Router | 6.x |
| HTTP Client | Axios | 1.7.x |
| Editor | TipTap | 3.x |

### DevOps

| Component | Technology |
|-----------|------------|
| Containerization | Docker (multi-stage) |
| CI/CD | GitHub Actions |
| Registry | ghcr.io |
| Orchestration | Docker Compose / Portainer |

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Browser                           │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    React SPA (Vite)                         ││
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────────────┐││
│  │  │ Editor  │ │ Sidebar │ │  Tasks  │ │   Auth Context      │││
│  │  │  Page   │ │ Folders │ │  List   │ │   Theme Context     │││
│  │  │         │ │  Tags   │ │         │ │   TanStack Query    │││
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────────────────┘││
│  └─────────────────────────────────────────────────────────────┘│
│                              │ Axios (REST/JSON)                 │
└──────────────────────────────┼───────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Fastify Server (Node.js)                      │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                      Route Layer                             ││
│  │  /api/auth  /api/notes  /api/folders  /api/tags  /api/tasks ││
│  │  /api/ai    /api/search /api/users    /health               ││
│  └─────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    Middleware Layer                          ││
│  │  authenticateToken │ validateBody │ validateParams          ││
│  └─────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                     Service Layer                            ││
│  │  AuthService │ NoteService │ FolderService │ TagService     ││
│  │  TaskService │ SearchService │ UserService │ AIService      ││
│  └─────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                      Data Layer                              ││
│  │                   Prisma ORM Client                          ││
│  └─────────────────────────────────────────────────────────────┘│
└──────────────────────────────┼───────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     PostgreSQL Database                          │
│  Users │ Sessions │ Notes │ Folders │ Tags │ Tasks │ AI Settings│
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    External AI Providers                         │
│        Anthropic Claude │ OpenAI GPT │ Google Gemini            │
└─────────────────────────────────────────────────────────────────┘
```

## Core Features

### Implemented (MVP Complete)

| Feature | Description | Backend | Frontend |
|---------|-------------|---------|----------|
| **Authentication** | JWT access + refresh tokens, first-boot setup | ✅ | ✅ |
| **Note Management** | CRUD, auto-save, soft delete, trash/restore | ✅ | ✅ |
| **Folders** | Single-level organization, drag-and-drop | ✅ | ✅ |
| **Tags** | Multi-tag per note, autocomplete | ✅ | ✅ |
| **Full-Text Search** | PostgreSQL tsvector, relevance ranking | ✅ | ✅ |
| **Tasks** | Standalone or note-linked, import from notes | ✅ | ✅ |
| **AI Features** | Summarize, suggest title, extract tags | ✅ | ✅ |
| **User Management** | Admin panel, role-based access | ✅ | ✅ |
| **Dark Mode** | System preference + manual toggle | ✅ | ✅ |
| **Mobile Responsive** | Bottom nav, adaptive layout | N/A | ✅ |

### Planned (Phase 2+)

- Note linking ([[wiki-style]])
- Backlinks and graph visualization
- Version history
- Import/export
- Semantic search with embeddings

## Data Model

### Entity Relationships

```
User (1) ─────┬───── (*) Session
              ├───── (*) Folder ────── (*) Note
              ├───── (*) Note ─────────┬── (*) NoteTag ── Tag
              ├───── (*) Tag ──────────┘
              ├───── (*) Task ─────────┬── (*) TaskTag ── Tag
              └───── (1) UserAISettings
```

### Key Models

| Model | Purpose | Key Fields |
|-------|---------|------------|
| **User** | Account management | username, email, role, passwordHash |
| **Note** | Core content | title, content, searchVector, deleted |
| **Folder** | Organization | name, userId |
| **Tag** | Categorization | name, userId |
| **Task** | Todo management | title, status, priority, dueDate, noteId |
| **UserAISettings** | AI configuration | provider, encryptedApiKey, model |

## API Overview

### Authentication Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/auth/setup-needed` | Check if first-boot setup required |
| POST | `/api/auth/setup` | Create first admin user |
| POST | `/api/auth/login` | Authenticate user |
| POST | `/api/auth/logout` | Invalidate session |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/change-password` | Change password |
| GET | `/api/auth/me` | Get current user |

### Resource Endpoints

| Resource | Endpoints | Auth |
|----------|-----------|------|
| Notes | GET, POST, PATCH, DELETE `/api/notes` | Required |
| Folders | GET, POST, PATCH, DELETE `/api/folders` | Required |
| Tags | GET, POST, PATCH, DELETE `/api/tags` | Required |
| Tasks | GET, POST, PUT, PATCH, DELETE `/api/tasks` | Required |
| Search | GET `/api/search` | Required |
| AI | GET/PUT `/api/ai/settings`, POST `/api/ai/*` | Required |
| Users | GET, POST, PATCH, DELETE `/api/users` | Admin |

## Security Model

### Authentication Flow

1. User submits credentials to `/api/auth/login`
2. Backend validates, returns JWT access token (1h) + sets refresh token cookie (7d)
3. Frontend stores access token in localStorage
4. Axios interceptor adds `Authorization: Bearer {token}` to requests
5. On 401, interceptor attempts token refresh via `/api/auth/refresh`
6. Refresh token is httpOnly, signed, sameSite=strict cookie

### Security Features

- Password hashing: bcrypt
- API key encryption: AES-256-GCM (at rest)
- CORS configured per environment
- Non-root Docker container
- Input validation via Zod schemas

## Development Guide

### Prerequisites

- Node.js 20+
- PostgreSQL 16+
- npm or yarn

### Local Development

```bash
# Backend
cd backend
npm install
cp .env.example .env  # Configure database
npx prisma migrate dev
npm run dev

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection |
| `JWT_ACCESS_SECRET` | Yes | Access token signing |
| `JWT_REFRESH_SECRET` | Yes | Refresh token signing |
| `COOKIE_SECRET` | Yes | Cookie signing |
| `ENCRYPTION_KEY` | Yes | AI key encryption (32+ chars) |

## Testing Status

| Area | Coverage | Framework |
|------|----------|-----------|
| Backend Unit | **0%** | Not configured |
| Backend Integration | **0%** | Not configured |
| Frontend Unit | **0%** | Not configured |
| E2E | **0%** | Not configured |

**⚠️ Critical Gap:** No automated tests exist. This is a priority area for improvement.

## Deployment

### Docker Build

```bash
docker build -t notez .
```

### Docker Compose

```yaml
services:
  notez:
    image: ghcr.io/{owner}/notez:latest
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://...
      - JWT_ACCESS_SECRET=...
    depends_on:
      - postgres
```

### CI/CD

- **Trigger:** Push to `main` or version tags
- **Actions:** Build multi-arch image (amd64/arm64), push to ghcr.io
- **Tags:** `latest`, `sha-{commit}`, `v{version}`

## Known Issues & Technical Debt

1. **No automated tests** - Critical gap for maintainability
2. **No shared types** - Frontend/backend type contracts are implicit
3. **TipTap vs Monaco** - README mentions Monaco but TipTap is used
4. **No rate limiting** - Mentioned as "ready" but not implemented
5. **No API versioning** - All routes under `/api/`

## Related Documentation

- [MVP Specification](./mvp-specification.md)
- [Requirements](./requirements.md)
- [Roadmap](./roadmap.md)
- [User Guide](./USER-GUIDE.md)
- [Deployment Guide](../DEPLOYMENT.md)
- [API Reference](./brownfield/api-reference.md)
- [Data Model Reference](./brownfield/data-model.md)
