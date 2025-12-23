# Phase 2 Epic: Enhanced Note Capabilities & AI Integration

**Epic Owner:** Adam
**Created:** 2025-12-03
**Status:** Draft
**Target:** Post v1.0.0 Stable

---

## Executive Summary

Phase 2 transforms Notez from a note-taking application into a **personal knowledge engine**. This phase delivers three interconnected capabilities:

1. **Wiki-style backlinks** - Connect notes with `[[references]]` for knowledge graph building
2. **MCP Server integration** - Enable AI assistants to read from and write to Notez
3. **Foundation hardening** - Load testing and stability validation before feature expansion

### Strategic Vision

```
┌─────────────────────────────────────────────────────────────────┐
│                    AI Knowledge Engine                          │
│                                                                 │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │
│   │   CAPTURE   │──▶│   CONNECT   │───▶│    QUERY    │        │
│   │             │    │             │    │             │        │
│   │ Save convos │    │ [[Links]]   │    │ MCP Search  │        │
│   │ to Notez    │    │ Backlinks   │    │ AI Retrieval│        │
│   └─────────────┘    └─────────────┘    └─────────────┘        │
│                                                                 │
│   Phase 2.2           Phase 2.1          Phase 2.2              │
│   (MCP Write)        (Backlinks)        (MCP Read)             │
└─────────────────────────────────────────────────────────────────┘
```

**User Value:** "I can ask Claude about my notes, and save our conversations back to build my knowledge base."

---

## Prerequisites

Before Phase 2 feature work begins, the following Phase 1 items must close:

| Issue | Title | Blocker For | Status |
|-------|-------|-------------|--------|
| #64 | Authentication edge cases | MCP Integration | Open |
| #67 | Load testing (50 concurrent users) | 1.0 Stable | Open |
| #68 | Memory leak detection | 1.0 Stable | Open |

**Parallel-safe items** (can proceed alongside Phase 2):
- #69 Error boundary coverage
- #70 Edge case input testing
- #74 Avatar loading after logout/login

---

## Phase 2.1: Backlinks Foundation

**Priority:** High
**Issue:** #88
**Estimated Effort:** Medium
**Dependencies:** None (can start immediately)

### User Story

> As a Notez user, I want to type `[[keyword]]` in my notes to create clickable references, so that I can see all notes mentioning that keyword and build connections between my thoughts.

### Acceptance Criteria

- [ ] User can type `[[` to trigger wiki-link input mode
- [ ] Typing `[[keyword]]` renders as a styled, clickable link
- [ ] Clicking a wiki-link opens a references panel showing all notes containing that keyword
- [ ] Each reference shows: note title, mention count, context snippet
- [ ] Wiki-links are stored as markdown (`[[keyword]]`) for portability
- [ ] Backlinks panel shows "Mentioned in X notes" on current note

### Technical Requirements

#### Database Schema

```prisma
model NoteLink {
  id            String   @id @default(cuid())
  sourceNoteId  String
  targetKeyword String
  createdAt     DateTime @default(now())

  sourceNote    Note     @relation("sourceLinks", fields: [sourceNoteId], references: [id], onDelete: Cascade)

  @@index([targetKeyword])
  @@index([sourceNoteId])
  @@unique([sourceNoteId, targetKeyword])
}
```

#### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notes/references?keyword={keyword}` | Find notes containing keyword |
| GET | `/api/notes/:id/backlinks` | Get backlinks for a specific note |

#### Frontend Components

1. **WikiLinkExtension** - TipTap extension for `[[]]` syntax
2. **WikiLinkNode** - Renders clickable link with styling
3. **ReferencesPanel** - Modal/drawer showing matching notes
4. **BacklinksPanel** - Collapsible section in note editor

### Implementation Tasks

1. Create Prisma migration for NoteLink model
2. Build TipTap WikiLink extension with input rules
3. Implement `/api/notes/references` endpoint
4. Parse and index wiki-links on note save
5. Create ReferencesPanel component
6. Add BacklinksPanel to NoteEditor
7. Style wiki-links distinctly from regular links

---

## Phase 2.2: MCP Server Integration

**Priority:** High
**Issue:** #87
**Estimated Effort:** Large
**Dependencies:** #64 (auth edge cases), #67 (load testing)

### User Story

> As a Notez user who uses AI assistants (Claude, ChatGPT), I want those assistants to access my notes and save conversations, so that my notes become a persistent AI memory layer.

### Acceptance Criteria

- [ ] User can generate API tokens from Settings
- [ ] API tokens are scoped (read, write, or both)
- [ ] MCP server package (`notez-mcp`) connects to Notez instance
- [ ] AI can search notes by keyword
- [ ] AI can retrieve full note content by ID or title
- [ ] AI can create new notes with title, content, optional folder
- [ ] AI can append content to existing notes
- [ ] Token authentication is rate-limited separately from user auth

### Use Cases

**Use Case 1: Query Knowledge Base**
```
User: "Claude, what did I write about the kitchen renovation?"
Claude: [Uses notez_search_notes("kitchen renovation")]
Claude: "You have 3 notes about the kitchen renovation. The most recent
        from November mentions cabinet delivery is delayed until January..."
```

**Use Case 2: Save Conversation**
```
User: "Claude, save this conversation to my notes"
Claude: [Uses notez_create_note with summary + key points]
Claude: "I've saved a summary of our conversation to Notez in your
        'AI Conversations' folder."
```

**Use Case 3: Build on Existing Notes**
```
User: "Claude, add these action items to my Project Phoenix note"
Claude: [Uses notez_append_to_note]
Claude: "Done! I've appended 4 action items to your Project Phoenix note."
```

### Technical Architecture

#### Authentication Model

```
┌─────────────────────────────────────────────────────────────────┐
│                    API Token Authentication                      │
│                                                                 │
│   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐   │
│   │  AI Client   │────▶│   Validate   │────▶│   Execute    │   │
│   │  (Claude)    │     │   Token      │     │   MCP Tool   │   │
│   └──────────────┘     └──────────────┘     └──────────────┘   │
│          │                    │                    │            │
│          │                    ▼                    │            │
│          │           ┌──────────────┐              │            │
│          │           │  Rate Limit  │              │            │
│          │           │  (separate)  │              │            │
│          │           └──────────────┘              │            │
│          │                                         │            │
│          └────────── Bearer {api_token} ───────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

#### Database Schema

```prisma
model ApiToken {
  id          String    @id @default(cuid())
  userId      String
  name        String
  tokenHash   String    @unique
  prefix      String    // First 8 chars for identification (ntez_xxxx...)
  scopes      String[]  // ["read", "write"]
  lastUsedAt  DateTime?
  expiresAt   DateTime?
  createdAt   DateTime  @default(now())

  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([tokenHash])
  @@index([userId])
}
```

#### MCP Tool Definitions

```typescript
// notez-mcp/src/tools.ts

const tools = {
  notez_search_notes: {
    description: "Search notes by keyword or phrase",
    parameters: {
      query: { type: "string", required: true },
      limit: { type: "number", default: 10 }
    }
  },

  notez_get_note: {
    description: "Retrieve a note by ID or exact title",
    parameters: {
      noteId: { type: "string" },
      title: { type: "string" }
      // One of noteId or title required
    }
  },

  notez_create_note: {
    description: "Create a new note",
    parameters: {
      title: { type: "string", required: true },
      content: { type: "string", required: true },
      folderId: { type: "string" },
      tags: { type: "array", items: { type: "string" } }
    }
  },

  notez_append_to_note: {
    description: "Append content to an existing note",
    parameters: {
      noteId: { type: "string" },
      title: { type: "string" },
      content: { type: "string", required: true }
      // One of noteId or title required
    }
  },

  notez_list_recent: {
    description: "List recently modified notes",
    parameters: {
      limit: { type: "number", default: 10 }
    }
  }
}
```

#### API Endpoints

| Method | Endpoint | Scope | Description |
|--------|----------|-------|-------------|
| GET | `/api/mcp/notes/search` | read | Search notes |
| GET | `/api/mcp/notes/:id` | read | Get note by ID |
| GET | `/api/mcp/notes/by-title/:title` | read | Get note by title |
| POST | `/api/mcp/notes` | write | Create note |
| PATCH | `/api/mcp/notes/:id/append` | write | Append to note |
| GET | `/api/mcp/notes/recent` | read | List recent notes |

### Implementation Tasks

1. Create ApiToken Prisma model and migration
2. Build token generation UI in Settings
3. Implement token validation middleware
4. Create `/api/mcp/*` route namespace
5. Implement MCP tool handlers
6. Create `notez-mcp` npm package
7. Write MCP server connection logic
8. Add separate rate limiting for API tokens
9. Document MCP setup for users

### Future Enhancements (Phase 3+)

- `notez_semantic_search` - When pgvector embeddings land
- `notez_find_related` - Find notes similar to a given note
- `notez_summarize_topic` - Synthesize notes about a topic

---

## Phase 2.3: Enhanced Backlinks

**Priority:** Medium
**Dependencies:** Phase 2.1 (Backlinks Foundation)

### Features

1. **Autocomplete** - When typing `[[`, dropdown suggests existing keywords
2. **Unlinked Mentions** - Show notes containing "keyword" without `[[keyword]]`
3. **Bidirectional Links** - If note titled "Ryan" exists, show all `[[Ryan]]` references

### Acceptance Criteria

- [ ] Typing `[[` shows autocomplete dropdown with existing keywords
- [ ] Dropdown is filterable and keyboard-navigable
- [ ] Backlinks panel shows "Unlinked mentions" section
- [ ] Can convert unlinked mention to wiki-link with one click

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Wiki-link adoption | 50+ links created in first month | Database count |
| MCP daily usage | 10+ API calls/day | API logs |
| Backlink discovery | Users click backlinks to navigate | Analytics |
| Load test passing | 50 concurrent users, <500ms p95 | k6 results |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| MCP auth security gap | High | Gate behind #64 completion, security review |
| Wiki-link parsing edge cases | Medium | Comprehensive regex testing, escape handling |
| Performance with many links | Medium | Index optimization, pagination |
| Token abuse | High | Strict rate limiting, token expiration |

---

## Definition of Done

### Phase 2.1 Complete When:
- [ ] Wiki-links render and are clickable
- [ ] References panel shows all matching notes
- [ ] Backlinks panel shows incoming links
- [ ] No performance regression on note save

### Phase 2.2 Complete When:
- [ ] API tokens can be created/revoked
- [ ] All MCP tools function correctly
- [ ] notez-mcp package published
- [ ] Documentation written for setup
- [ ] Rate limiting verified under load

### Phase 2 Complete When:
- [ ] All Phase 1 hardening issues closed
- [ ] v1.0.0 stable released
- [ ] Backlinks and MCP shipped
- [ ] User guide updated

---

## Appendix: Conversation Note Template

When AI saves a conversation to Notez, use this structure:

```markdown
# Conversation: [Topic]

**Date:** YYYY-MM-DD
**Participants:** User, [AI Name]

## Summary
[2-3 sentence summary of the conversation]

## Key Points
- Point 1
- Point 2
- Point 3

## Decisions Made
- Decision 1
- Decision 2

## Action Items
- [ ] Task 1
- [ ] Task 2

---

<details>
<summary>Full Transcript</summary>

[Optional: Include raw conversation if user requests]

</details>
```

---

*Document generated from multi-agent planning session, 2025-12-03*
