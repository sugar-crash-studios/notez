# Notez - Requirements Document

## Project Overview

**Project Name:** Notez
**Description:** A self-hosted, web-based notepad++ and Obsidian alternative with AI-powered features
**Target Deployment:** Docker container hosted on private server, accessible via Cloudflare tunnel at notez.curgghoth.com
**Version:** 1.0.0
**Last Updated:** 2025-10-13

## Executive Summary

Notez is a self-hosted web application that combines the best features of Notepad++ (powerful text editing) and Obsidian (knowledge management and linking) with AI-powered automation. The application will be accessible from anywhere via web browser, with secure authentication and multi-user support managed by an admin user.

## Technology Stack Recommendations

### Backend
- **Framework:** Node.js with Express.js or Fastify
  - *Alternative:* Python with FastAPI (if team prefers Python)
- **Database:** PostgreSQL with full-text search capabilities
  - Vector extension (pgvector) for AI embeddings
- **ORM:** Prisma (Node.js) or SQLAlchemy (Python)
- **Authentication:** JWT tokens with refresh token rotation
- **Password Hashing:** bcrypt or argon2

### Frontend
- **Framework:** React with TypeScript or Vue.js 3 with TypeScript
- **UI Components:** shadcn/ui or Ant Design
- **Text Editor:** Monaco Editor (VS Code's editor) or CodeMirror 6
- **Markdown Rendering:** react-markdown or marked.js
- **State Management:** Zustand or Redux Toolkit
- **API Client:** Axios or TanStack Query

### AI Integration
- **Supported Providers:**
  - Anthropic Claude (Claude 3.5 Sonnet, Claude 3 Opus)
  - OpenAI (GPT-4, GPT-3.5)
  - Google Gemini (Gemini Pro, Gemini Ultra)
- **Vector Search:** pgvector for semantic search
- **Embeddings:** Provider-specific embedding models

### DevOps & Infrastructure
- **Containerization:** Docker with multi-stage builds
- **Container Registry:** GitHub Container Registry (ghcr.io)
- **CI/CD:** GitHub Actions
- **Deployment:** Portainer pull webhook integration
- **Reverse Proxy:** Cloudflare Tunnel

## Core Features

### 1. Authentication & User Management

#### 1.1 First Boot Experience
- **FR-AUTH-001:** On first application startup, system shall present an "Initial Setup" screen
- **FR-AUTH-002:** Admin user must create username, email, and password (minimum requirements: 8 characters, 1 uppercase, 1 number, 1 special character)
- **FR-AUTH-003:** System shall create admin account with full privileges
- **FR-AUTH-004:** After initial setup, system shall never show setup screen again

#### 1.2 Login System
- **FR-AUTH-005:** Users shall authenticate with username/email and password
- **FR-AUTH-006:** System shall implement JWT token authentication with refresh tokens
- **FR-AUTH-007:** Tokens shall expire after configurable period (default: 1 hour access, 7 days refresh)
- **FR-AUTH-008:** System shall support "Remember Me" functionality
- **FR-AUTH-009:** Failed login attempts shall be rate-limited (max 5 attempts per 15 minutes)

#### 1.3 User Management (Admin Only)
- **FR-AUTH-010:** Admin users shall create new user accounts with username, email, and temporary password
- **FR-AUTH-011:** New users shall be forced to change password on first login
- **FR-AUTH-012:** Admin shall view list of all users with status (active/inactive)
- **FR-AUTH-013:** Admin shall deactivate/reactivate user accounts
- **FR-AUTH-014:** Admin shall reset user passwords
- **FR-AUTH-015:** Admin shall delete user accounts (soft delete with data retention)
- **FR-AUTH-016:** System shall support role-based access control (Admin, User)
- **FR-AUTH-017:** There shall be NO public registration endpoint

### 2. Note Management

#### 2.1 Note Creation & Editing
- **FR-NOTE-001:** Users shall create plain text, markdown, and code notes
- **FR-NOTE-002:** System shall support syntax highlighting for 50+ programming languages
- **FR-NOTE-003:** Editor shall provide line numbers, code folding, and minimap
- **FR-NOTE-004:** Users shall save notes manually or enable auto-save (configurable interval)
- **FR-NOTE-005:** System shall track note metadata: created date, modified date, word count, character count
- **FR-NOTE-006:** Users shall add tags to notes for organization
- **FR-NOTE-007:** Users shall set note visibility (private, shared with specific users)

#### 2.2 Note Organization
- **FR-NOTE-008:** Users shall organize notes in hierarchical folder structure (unlimited depth)
- **FR-NOTE-009:** Users shall move notes between folders via drag-and-drop
- **FR-NOTE-010:** Users shall create, rename, and delete folders
- **FR-NOTE-011:** System shall display notes in tree view and list view
- **FR-NOTE-012:** Users shall star/favorite notes for quick access
- **FR-NOTE-013:** Users shall archive notes (hide from main view but retain)

#### 2.3 Note Linking & Relationships
- **FR-NOTE-014:** Users shall create bidirectional links between notes using [[Note Title]] syntax
- **FR-NOTE-015:** System shall display backlinks showing which notes link to current note
- **FR-NOTE-016:** Users shall view graph visualization of note connections
- **FR-NOTE-017:** System shall support note aliases for multiple link names
- **FR-NOTE-018:** Users shall embed note content in other notes using ![[Note Title]]

### 3. Search & Discovery

#### 3.1 Basic Search
- **FR-SEARCH-001:** Users shall search notes by title, content, and tags
- **FR-SEARCH-002:** Search shall support boolean operators (AND, OR, NOT)
- **FR-SEARCH-003:** Users shall filter search by date range, folder, and file type
- **FR-SEARCH-004:** Search results shall highlight matching text
- **FR-SEARCH-005:** System shall provide search suggestions as user types

#### 3.2 Advanced Search
- **FR-SEARCH-006:** Users shall search using regular expressions
- **FR-SEARCH-007:** System shall support full-text search with ranking
- **FR-SEARCH-008:** Users shall save search queries for reuse
- **FR-SEARCH-009:** Users shall search within specific folders/subtrees

### 4. AI-Powered Features

#### 4.1 AI Configuration
- **FR-AI-001:** Admin shall configure AI provider (Anthropic, OpenAI, Google Gemini)
- **FR-AI-002:** Admin shall securely store API keys (encrypted at rest)
- **FR-AI-003:** System shall validate API keys on configuration
- **FR-AI-004:** Users shall select which AI provider to use for their operations
- **FR-AI-005:** System shall track AI usage per user (token consumption)

#### 4.2 Auto-Indexing
- **FR-AI-006:** System shall automatically generate embeddings for all notes
- **FR-AI-007:** Embeddings shall update when notes are modified
- **FR-AI-008:** Admin shall configure indexing schedule (real-time, hourly, daily)
- **FR-AI-009:** System shall display indexing status and queue

#### 4.3 Semantic Search
- **FR-AI-010:** Users shall search notes using natural language queries
- **FR-AI-011:** System shall return semantically similar notes ranked by relevance
- **FR-AI-012:** Results shall show similarity scores
- **FR-AI-013:** Users shall combine semantic and traditional search

#### 4.4 Auto-Grouping & Organization
- **FR-AI-014:** System shall suggest note groupings based on content similarity
- **FR-AI-015:** AI shall automatically suggest tags for notes
- **FR-AI-016:** System shall identify duplicate or highly similar notes
- **FR-AI-017:** AI shall suggest related notes while editing
- **FR-AI-018:** System shall generate topic clusters from note collection

#### 4.5 AI Assistant Features
- **FR-AI-019:** Users shall summarize notes using AI
- **FR-AI-020:** Users shall generate note titles from content
- **FR-AI-021:** Users shall extract key points and action items
- **FR-AI-022:** Users shall ask questions about note content
- **FR-AI-023:** Users shall generate note outlines from prompts
- **FR-AI-024:** System shall suggest note improvements (clarity, structure)
- **FR-AI-025:** Users shall translate notes to different languages

### 5. Editor Features (Notepad++ Inspired)

#### 5.1 Multi-Document Interface
- **FR-EDITOR-001:** Users shall open multiple notes in tabs
- **FR-EDITOR-002:** Users shall split editor view (horizontal/vertical)
- **FR-EDITOR-003:** System shall remember open tabs between sessions
- **FR-EDITOR-004:** Users shall reorder tabs via drag-and-drop
- **FR-EDITOR-005:** System shall indicate unsaved changes with tab markers

#### 5.2 Advanced Editing
- **FR-EDITOR-006:** Editor shall support multi-cursor editing
- **FR-EDITOR-007:** Users shall find and replace with regex support
- **FR-EDITOR-008:** Users shall find and replace across multiple files
- **FR-EDITOR-009:** Editor shall support block selection/column mode
- **FR-EDITOR-010:** Users shall comment/uncomment code blocks
- **FR-EDITOR-011:** System shall auto-indent and format code
- **FR-EDITOR-012:** Users shall configure tab size and spaces/tabs preference

#### 5.3 Editor Enhancements
- **FR-EDITOR-013:** System shall provide autocomplete for common words and code
- **FR-EDITOR-014:** Editor shall show matching brackets/parentheses
- **FR-EDITOR-015:** Users shall bookmark lines for quick navigation
- **FR-EDITOR-016:** System shall support text snippets/templates
- **FR-EDITOR-017:** Users shall compare two notes side-by-side (diff view)

### 6. Obsidian-Inspired Features

#### 6.1 Knowledge Graph
- **FR-GRAPH-001:** System shall generate interactive graph of note relationships
- **FR-GRAPH-002:** Users shall filter graph by tags, folders, and date
- **FR-GRAPH-003:** Graph nodes shall be sized by number of connections
- **FR-GRAPH-004:** Users shall click nodes to navigate to notes
- **FR-GRAPH-005:** Graph shall highlight selected note and immediate connections

#### 6.2 Daily Notes
- **FR-DAILY-001:** Users shall create daily notes with single click
- **FR-DAILY-002:** System shall use configurable template for daily notes
- **FR-DAILY-003:** Users shall configure daily note location and naming convention
- **FR-DAILY-004:** System shall provide calendar view of daily notes

#### 6.3 Note Templates
- **FR-TEMPLATE-001:** Users shall create reusable note templates
- **FR-TEMPLATE-002:** Templates shall support variables (date, time, user, etc.)
- **FR-TEMPLATE-003:** Users shall apply templates to new or existing notes
- **FR-TEMPLATE-004:** Admin shall create system-wide templates

### 7. Collaboration & Sharing

#### 7.1 Note Sharing
- **FR-SHARE-001:** Users shall share notes with other users (read-only or edit)
- **FR-SHARE-002:** Users shall generate shareable links with expiration
- **FR-SHARE-003:** Shared notes shall show who has access
- **FR-SHARE-004:** Users shall revoke share access at any time
- **FR-SHARE-005:** System shall notify users when notes are shared with them

#### 7.2 Version History
- **FR-VERSION-001:** System shall maintain version history for all notes
- **FR-VERSION-002:** Users shall view previous versions with timestamps
- **FR-VERSION-003:** Users shall restore previous versions
- **FR-VERSION-004:** System shall show diff between versions
- **FR-VERSION-005:** Version retention shall be configurable (default: 30 days)

### 8. User Preferences & Customization

#### 8.1 Appearance
- **FR-PREF-001:** Users shall choose between light and dark themes
- **FR-PREF-002:** Users shall customize editor font family and size
- **FR-PREF-003:** Users shall select from multiple syntax highlighting themes
- **FR-PREF-004:** System shall remember user's theme preference

#### 8.2 Editor Preferences
- **FR-PREF-005:** Users shall configure auto-save interval
- **FR-PREF-006:** Users shall set default note format (plain text, markdown, code)
- **FR-PREF-007:** Users shall configure keyboard shortcuts
- **FR-PREF-008:** Users shall enable/disable editor features (line numbers, minimap, etc.)

#### 8.3 AI Preferences
- **FR-PREF-009:** Users shall choose preferred AI provider
- **FR-PREF-010:** Users shall opt-out of automatic indexing
- **FR-PREF-011:** Users shall configure AI suggestion frequency

### 9. Admin Features

#### 9.1 System Configuration
- **FR-ADMIN-001:** Admin shall view system health and status
- **FR-ADMIN-002:** Admin shall configure application settings (name, logo, etc.)
- **FR-ADMIN-003:** Admin shall set password requirements and policies
- **FR-ADMIN-004:** Admin shall configure session timeout periods
- **FR-ADMIN-005:** Admin shall enable/disable specific features globally

#### 9.2 Monitoring & Logging
- **FR-ADMIN-006:** Admin shall view user activity logs
- **FR-ADMIN-007:** Admin shall monitor storage usage per user
- **FR-ADMIN-008:** Admin shall view AI API usage and costs
- **FR-ADMIN-009:** System shall log security events (failed logins, etc.)
- **FR-ADMIN-010:** Admin shall export logs for external analysis

#### 9.3 Backup & Maintenance
- **FR-ADMIN-011:** Admin shall trigger manual database backups
- **FR-ADMIN-012:** Admin shall configure automatic backup schedule
- **FR-ADMIN-013:** Admin shall export all user data (GDPR compliance)
- **FR-ADMIN-014:** System shall provide database maintenance tools

### 10. Import & Export

#### 10.1 Import
- **FR-IMPORT-001:** Users shall import individual text/markdown files
- **FR-IMPORT-002:** Users shall bulk import folders of files
- **FR-IMPORT-003:** System shall support import from Obsidian vaults (preserve links)
- **FR-IMPORT-004:** System shall support import from Evernote/Notion exports

#### 10.2 Export
- **FR-EXPORT-001:** Users shall export individual notes (txt, md, html, pdf)
- **FR-EXPORT-002:** Users shall export entire folders/notebooks
- **FR-EXPORT-003:** Users shall export notes with or without formatting
- **FR-EXPORT-004:** Export shall preserve folder structure

## Non-Functional Requirements

### Performance
- **NFR-PERF-001:** Page load time shall not exceed 2 seconds on standard connection
- **NFR-PERF-002:** Search results shall display within 500ms for databases up to 10,000 notes
- **NFR-PERF-003:** AI operations shall provide progress indicators for operations > 3 seconds
- **NFR-PERF-004:** System shall support concurrent users (minimum 10 simultaneous)

### Security
- **NFR-SEC-001:** All communications shall use HTTPS/TLS 1.3
- **NFR-SEC-002:** Passwords shall be hashed using bcrypt or argon2 (never stored plaintext)
- **NFR-SEC-003:** API keys shall be encrypted at rest using AES-256
- **NFR-SEC-004:** System shall implement CORS restrictions
- **NFR-SEC-005:** System shall sanitize all user input to prevent XSS/injection attacks
- **NFR-SEC-006:** Session tokens shall be httpOnly and secure
- **NFR-SEC-007:** System shall implement rate limiting on all API endpoints

### Reliability
- **NFR-REL-001:** System uptime shall target 99.5% (managed by user's infrastructure)
- **NFR-REL-002:** Database connections shall implement automatic retry logic
- **NFR-REL-003:** System shall gracefully handle AI API failures without data loss
- **NFR-REL-004:** Application shall validate data integrity on startup

### Scalability
- **NFR-SCALE-001:** Database schema shall support millions of notes per user
- **NFR-SCALE-002:** File storage shall be configurable (local, S3-compatible)
- **NFR-SCALE-003:** System shall support horizontal scaling (multiple container instances)

### Usability
- **NFR-USE-001:** Interface shall be responsive (desktop, tablet, mobile)
- **NFR-USE-002:** Application shall be accessible (WCAG 2.1 Level AA)
- **NFR-USE-003:** System shall provide inline help and tooltips
- **NFR-USE-004:** Error messages shall be clear and actionable

### Maintainability
- **NFR-MAINT-001:** Code shall maintain minimum 80% test coverage
- **NFR-MAINT-002:** All code shall be documented with inline comments
- **NFR-MAINT-003:** System shall use environment variables for configuration
- **NFR-MAINT-004:** Database migrations shall be versioned and reversible

## Deployment Architecture

### Docker Container
- Multi-stage Docker build for optimized image size
- Health check endpoint for container orchestration
- Graceful shutdown handling
- Volume mounts for persistent data (database, uploads)

### CI/CD Pipeline (GitHub Actions)
1. **Trigger:** Push to main branch
2. **Build Steps:**
   - Run unit tests
   - Run integration tests
   - Lint code
   - Build frontend assets
   - Build Docker image
   - Tag image with commit SHA and 'latest'
3. **Push:** Push image to ghcr.io
4. **Deploy:** Trigger Portainer webhook for automatic deployment

### Environment Variables
```
# Application
NODE_ENV=production
PORT=3000
BASE_URL=https://notez.curgghoth.com

# Database
DATABASE_URL=postgresql://user:pass@db:5432/notez
DATABASE_POOL_SIZE=10

# Security
JWT_SECRET=<generated-secret>
JWT_EXPIRY=3600
REFRESH_TOKEN_EXPIRY=604800
ENCRYPTION_KEY=<generated-key>

# AI Providers (optional, configured via UI)
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GEMINI_API_KEY=

# Storage
UPLOAD_PATH=/app/data/uploads
MAX_FILE_SIZE=10485760

# Features
ENABLE_REGISTRATION=false
SESSION_TIMEOUT=3600
```

### Cloudflare Tunnel Configuration
- Tunnel endpoint: notez.curgghoth.com
- Target: http://notez-container:3000
- TLS termination at Cloudflare edge

## Database Schema Overview

### Core Tables
- **users** - User accounts and authentication
- **notes** - Note content and metadata
- **folders** - Hierarchical folder structure
- **tags** - Tag definitions
- **note_tags** - Note-to-tag relationships
- **note_links** - Internal note links
- **note_shares** - Sharing permissions
- **note_versions** - Version history
- **embeddings** - AI-generated embeddings for semantic search
- **ai_configs** - AI provider configurations
- **sessions** - Active user sessions
- **audit_logs** - System activity logs

## Development Phases

### Phase 1: Foundation (MVP)
- User authentication and management
- Basic note CRUD operations
- Folder organization
- Simple search
- Text editor with syntax highlighting
- Docker deployment and CI/CD

### Phase 2: Enhanced Editing
- Multi-tab interface
- Advanced editor features (multi-cursor, find/replace)
- Note templates
- Import/export functionality
- Version history

### Phase 3: Knowledge Management
- Note linking and backlinks
- Graph visualization
- Tags and better organization
- Daily notes
- Enhanced search with filters

### Phase 4: AI Integration
- AI provider configuration
- Auto-indexing and embeddings
- Semantic search
- AI assistant features (summarization, tagging)
- Auto-grouping suggestions

### Phase 5: Collaboration & Polish
- Note sharing
- User preferences and customization
- Admin dashboard enhancements
- Mobile responsiveness
- Performance optimization

## Success Metrics

- User adoption (number of active users)
- Note creation rate (notes per user per week)
- Search usage (searches per session)
- AI feature utilization (% of users using AI features)
- System performance (response times, uptime)
- User satisfaction (qualitative feedback)

## Risks & Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| AI API costs exceed budget | High | Medium | Implement usage quotas, caching, user limits |
| Large note databases cause performance issues | High | Medium | Implement pagination, lazy loading, database indexing |
| Security vulnerabilities exposed | High | Low | Regular security audits, dependency updates, penetration testing |
| Data loss due to backup failures | High | Low | Automated backup verification, multiple backup strategies |
| Vendor lock-in with AI providers | Medium | Medium | Abstract AI provider interface, support multiple providers |

## Open Questions

1. **Storage limits:** Should there be per-user storage quotas? What should the limits be?
2. **AI rate limiting:** How should AI usage be limited per user to control costs?
3. **Collaborative editing:** Should we support real-time collaborative editing in Phase 5+?
4. **Mobile apps:** Should native mobile apps be considered for future phases?
5. **Plugin system:** Should we support user plugins/extensions for customization?
6. **Public sharing:** Should notes be shareable publicly (outside authenticated users)?
7. **Two-factor authentication:** Should 2FA be implemented for enhanced security?

## References & Inspirations

- **Notepad++:** Multi-document editing, syntax highlighting, find/replace
- **Obsidian:** Note linking, graph view, markdown support, local-first
- **Notion:** Modern UI, templates, databases
- **VS Code:** Monaco editor, extensions, keybindings
- **Evernote:** Web clipper, organization, search

---

**Document Status:** Draft v1.0
**Next Review Date:** TBD
**Approved By:** Pending