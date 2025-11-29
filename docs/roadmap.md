# Notez Development Roadmap

This document outlines planned features for Notez beyond the current MVP implementation.

Last Updated: 2025-11-29

---

## Recently Completed (Current Release v0.28.x)

### Note Organization Improvements

- ✅ **Move notes to folders** - Dropdown selector in note editor
- ✅ **Drag-and-drop organization** - Drag notes to folders in sidebar
- ✅ **Auto-save cursor fix** - Fixed cursor jumping during typing when auto-save triggers
- ✅ **Task management system** - Standalone tasks with import from notes
- ✅ **Editor scroll fix** - Fixed mousewheel scrolling in large notes
- ✅ **Formatting improvements** - Improved keyboard shortcut reliability

---

## Phase 1: Stability & Security (4 weeks) - PRIORITY

> **Goal:** Prepare for public release with security hardening and testing foundation

### 1.1 Security Hardening

**Status:** Immediate Priority
**Effort:** Low
**Impact:** Critical

- [ ] Add security headers via `@fastify/helmet`
  - HSTS (HTTP Strict Transport Security)
  - CSP (Content Security Policy)
  - X-Frame-Options
  - X-Content-Type-Options
- [ ] Implement rate limiting via `@fastify/rate-limit`
  - Login endpoint: 5 attempts per 15 minutes
  - API endpoints: 100 requests per minute
- [ ] Add account lockout mechanism
  - Lock account after 5 failed login attempts
  - Auto-unlock after 30 minutes or admin reset
- [ ] Remove default secret fallbacks in production

### 1.2 Database Optimization

**Status:** Immediate Priority
**Effort:** Low
**Impact:** Medium

- [ ] Add missing foreign key indexes

```sql
CREATE INDEX idx_notes_user_id ON notes(user_id);
CREATE INDEX idx_notes_folder_id ON notes(folder_id);
CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_folders_user_id ON folders(user_id);
```

### 1.3 Testing Foundation

**Status:** High Priority
**Effort:** Medium
**Impact:** Critical

- [ ] Set up Vitest for backend and frontend
- [ ] Implement authentication flow tests
- [ ] Implement note CRUD tests
- [ ] Implement search functionality tests
- [ ] Add React Error Boundaries
- [ ] Target: 40% coverage before public release

### 1.4 CI/CD Improvements

**Status:** High Priority
**Effort:** Low-Medium
**Impact:** Medium

- [ ] Add test step to GitHub Actions workflow
- [ ] Add linting step (ESLint + TypeScript check)
- [ ] Add security scanning (Trivy)
- [ ] Configure Portainer webhook for auto-deploy
- [ ] Add database migration safety step

---

## Phase 2: Enhanced Note Capabilities (6 weeks)

> **Goal:** Add features that enhance daily note-taking workflow

### 2.1 Note Linking (Wiki-Style)

**Status:** Planned
**Priority:** High
**Description:** Enable `[[Note Title]]` syntax to link between notes

**Implementation:**

- Add TipTap extension for `[[]]` syntax detection
- Backend: Parse and store note links in junction table
- Frontend: Autocomplete for note titles when typing `[[`
- Backlinks panel showing "Notes that link here"

**Acceptance Criteria:**

- [ ] User can type `[[` to get note title suggestions
- [ ] Clicking a link navigates to the linked note
- [ ] Backlinks panel shows incoming links
- [ ] Broken links are visually indicated

### 2.2 Image Paste Support

**Status:** Planned
**Priority:** Medium
**Description:** Allow users to paste images directly into notes

**Technical Requirements:**

- **Storage:** Local filesystem initially, S3 optional
- **Database:** New `Media` table
- **Editor:** TipTap `@tiptap/extension-image`
- **Security:** File type validation, size limits (10MB)
- **Performance:** Thumbnail generation, lazy loading

**Acceptance Criteria:**

- [ ] User can paste images from clipboard
- [ ] Images are uploaded and stored securely
- [ ] Images display correctly in editor
- [ ] Size limits are enforced
- [ ] Image deletion works correctly

### 2.3 Version History (Basic)

**Status:** Planned
**Priority:** Medium
**Description:** Track note changes and enable restore

**Implementation:**

- Store note snapshots on significant saves (>50 character change)
- Keep last 10 versions per note
- Simple diff view between versions
- One-click restore

**Acceptance Criteria:**

- [ ] Versions are automatically captured
- [ ] User can view version history
- [ ] User can restore previous version
- [ ] Storage is efficient (delta compression optional)

---

## Phase 3: Organization & Scale (8 weeks)

> **Goal:** Support larger note collections and advanced workflows

### 3.1 Multi-Workspace Support

**Status:** Planned
**Priority:** Medium
**Description:** Separate workspaces for different contexts (Work, Home, Projects)

**Key Features:**

- Workspace switcher in navigation
- Isolated folders, notes, tasks per workspace
- Workspace-specific settings
- Quick-switch keyboard shortcut

**Implementation Complexity:** High - touches many parts of application

### 3.2 Advanced Search (Semantic)

**Status:** Planned
**Priority:** Medium
**Description:** AI-powered semantic search using embeddings

**Implementation:**

- Generate embeddings for note content
- Store in pgvector
- Hybrid search: full-text + semantic
- "Find similar notes" feature

### 3.3 Import/Export

**Status:** Planned
**Priority:** Medium
**Description:** Bulk data management

**Features:**

- Export all notes as markdown files (zip)
- Export to JSON for backup
- Import from markdown files
- Import from other apps (Notion, Obsidian format)

### 3.4 API Documentation

**Status:** Planned
**Priority:** Low
**Description:** OpenAPI/Swagger specification

- Auto-generated from route schemas
- Interactive documentation UI
- API versioning support

---

## Phase 4: Collaboration & Mobile (TBD)

> **Goal:** Enable team usage and mobile access

### 4.1 Note Sharing

**Status:** Future
**Description:** Share notes with read-only links

- Generate shareable URLs
- Optional password protection
- Expiration dates
- View analytics

### 4.2 Mobile Apps

**Status:** Future
**Description:** Native iOS/Android applications

- React Native implementation
- Offline support with sync
- Push notifications for tasks
- Quick capture widget

### 4.3 Real-Time Collaboration

**Status:** Future
**Description:** Multi-user editing

- Operational transformation or CRDT
- Presence indicators
- Comments and suggestions
- Role-based permissions

---

## Backlog (Unscheduled)

These features are tracked but not yet prioritized:

- **Rich text toolbar** - Visual formatting buttons
- **Note templates** - Predefined structures
- **Browser extension** - Quick capture from web
- **Note encryption** - End-to-end encryption
- **Nested folders** - Multi-level folder hierarchy
- **Daily notes** - Auto-generated daily note template
- **Graph visualization** - Visual note connections
- **Webhooks** - Integration with external services

---

## Version History

| Version | Date | Description |
|---------|------|-------------|
| v0.28.x | 2025-11 | MVP release with task management |
| v0.29.x | TBD | Phase 1: Security & stability |
| v0.30.x | TBD | Phase 2: Enhanced note capabilities |
| v0.31.x | TBD | Phase 3: Organization & scale |

---

## Contributing

Feature requests and bug reports are welcome! Please check the existing roadmap before suggesting new features.

Priority is given to:

1. Security and stability improvements
2. Features that improve daily workflow
3. Features requested by multiple users
4. Features aligned with self-hosted philosophy
