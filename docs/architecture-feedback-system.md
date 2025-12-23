# Feedback System - Light Architecture

> Focused architectural decisions for brownfield feature addition
> Created: 2025-12-21

---

## Overview

This document captures the key architectural decisions needed to implement the Feedback System feature in Notez. It focuses on integration points and design patterns that Amelia (dev agent) needs to build the feature efficiently.

**Scope:** GitHub Integration, Webhook Dispatcher, AI Enhancement Pipeline, Data Model

---

## 1. GitHub Integration Architecture

### 1.1 Authentication Strategy

**Decision:** Use Personal Access Token (PAT) stored encrypted in database.

**Rationale:**
- OAuth App would require callback URL configuration (complexity for self-hosted)
- GitHub App installation is overkill for single-repo, single-admin use case
- PAT is simple, well-understood, and matches existing API key pattern (UserAISettings)

**Token Storage:**
```
SystemSetting {
  key: "github_pat"           // Personal Access Token (encrypted)
  key: "github_repo"          // owner/repo format
  key: "github_project_id"    // Project board ID (optional)
  key: "github_default_labels" // JSON array of label names
}
```

Uses existing `encrypt()`/`decrypt()` utilities from `backend/src/utils/encryption.ts`.

### 1.2 GraphQL Client Setup

**Decision:** Use `@octokit/graphql` package for GitHub API v4.

**Rationale:**
- Lightweight, focused package (vs full Octokit suite)
- First-class GraphQL support with TypeScript types
- Handles authentication headers automatically

**Service Pattern:**
```typescript
// backend/src/services/github.service.ts
import { graphql } from '@octokit/graphql';

export class GitHubService {
  private async getClient(): Promise<typeof graphql> {
    const token = await this.getDecryptedToken();
    return graphql.defaults({
      headers: { authorization: `token ${token}` }
    });
  }

  async createIssue(input: CreateIssueInput): Promise<GitHubIssue> { ... }
  async addToProject(issueId: string, projectId: string): Promise<void> { ... }
  async testConnection(): Promise<boolean> { ... }
  async validateRepoAccess(repo: string): Promise<boolean> { ... }
}
```

### 1.3 Issue Creation Flow

```
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│   Frontend   │      │   Backend    │      │  GitHub API  │
│              │      │              │      │              │
│  Click       │      │  POST        │      │              │
│  "Publish"   │─────►│  /publish    │      │              │
│              │      │              │      │              │
│              │      │  1. Get      │      │              │
│              │      │  enhanced    │      │              │
│              │      │  content     │      │              │
│              │      │              │      │              │
│              │      │  2. Create   │      │  GraphQL     │
│              │      │  Issue ──────┼─────►│  createIssue │
│              │      │              │      │              │
│              │      │  3. Add to   │      │  GraphQL     │
│              │      │  Project ────┼─────►│  addProject  │
│              │      │              │◄─────┤  ItemV2      │
│              │      │              │      │              │
│              │      │  4. Update   │      │              │
│              │      │  submission  │      │              │
│  Display     │◄─────┤  status +    │      │              │
│  success     │      │  issue URL   │      │              │
└──────────────┘      └──────────────┘      └──────────────┘
```

### 1.4 GraphQL Mutations

**Create Issue:**
```graphql
mutation CreateIssue($input: CreateIssueInput!) {
  createIssue(input: $input) {
    issue {
      id
      number
      url
    }
  }
}
```

**Add to Project (v2):**
```graphql
mutation AddToProject($projectId: ID!, $contentId: ID!) {
  addProjectV2ItemById(input: {projectId: $projectId, contentId: $contentId}) {
    item {
      id
    }
  }
}
```

### 1.5 Error Handling

| Error | Handling |
|-------|----------|
| 401 Unauthorized | Token invalid/expired → Clear stored token, prompt reconfigure |
| 404 Not Found | Repo/project doesn't exist → Show friendly error, suggest verification |
| 403 Forbidden | Insufficient permissions → Show required scopes (repo, project) |
| Rate Limit | Queue for retry, show "GitHub busy, try again shortly" |
| Network Error | Retry 3x with exponential backoff, then fail gracefully |

---

## 2. Webhook Dispatcher Pattern

### 2.1 Design Decision

**Decision:** Single dispatcher with format adapters (Strategy pattern).

**Rationale:**
- Discord and Slack have different payload formats but similar delivery mechanics
- Single entry point simplifies testing and error handling
- Easy to add more providers later (Teams, custom webhooks)

### 2.2 Architecture

```
                           ┌─────────────────────┐
                           │  WebhookDispatcher  │
                           │                     │
  FeedbackSubmitted ──────►│  dispatch(event)    │
                           │        │            │
                           │        ▼            │
                           │  detectProvider()   │
                           │        │            │
                           └────────┼────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
             ┌──────────┐    ┌──────────┐    ┌──────────┐
             │ Discord  │    │  Slack   │    │  Custom  │
             │ Adapter  │    │ Adapter  │    │ Adapter  │
             └──────────┘    └──────────┘    └──────────┘
                    │               │               │
                    └───────────────┴───────────────┘
                                    │
                                    ▼
                              ┌──────────┐
                              │  HTTP    │
                              │  POST    │
                              └──────────┘
```

### 2.3 Provider Detection

**Decision:** Auto-detect provider from URL domain.

```typescript
function detectProvider(url: string): 'discord' | 'slack' | 'custom' {
  const hostname = new URL(url).hostname;
  if (hostname.includes('discord.com') || hostname.includes('discordapp.com')) {
    return 'discord';
  }
  if (hostname.includes('slack.com') || hostname.includes('hooks.slack.com')) {
    return 'slack';
  }
  return 'custom';
}
```

### 2.4 Payload Formats

**Discord Embed:**
```json
{
  "embeds": [{
    "title": "New Feature Request",
    "description": "User submitted: Allow dark mode scheduling",
    "color": 5814783,
    "fields": [
      { "name": "Type", "value": "Feature", "inline": true },
      { "name": "Category", "value": "UI", "inline": true },
      { "name": "Submitted by", "value": "sarah", "inline": true }
    ],
    "footer": { "text": "Notez Feedback System" },
    "timestamp": "2025-12-21T10:00:00Z"
  }]
}
```

**Slack Block Kit:**
```json
{
  "blocks": [
    {
      "type": "header",
      "text": { "type": "plain_text", "text": "New Feature Request" }
    },
    {
      "type": "section",
      "fields": [
        { "type": "mrkdwn", "text": "*Type:* Feature" },
        { "type": "mrkdwn", "text": "*Category:* UI" }
      ]
    },
    {
      "type": "section",
      "text": { "type": "mrkdwn", "text": "Allow dark mode scheduling" }
    }
  ]
}
```

### 2.5 Retry Strategy

```typescript
const RETRY_CONFIG = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

// Retry on: 5xx, network errors, timeouts
// Don't retry: 4xx (except 429), validation errors
```

---

## 3. AI Enhancement Pipeline

### 3.1 Integration with Existing AI Service

**Decision:** Extend existing `AIProvider` interface, not create separate service.

**Rationale:**
- Leverages existing per-user AI configuration (UserAISettings)
- Reuses encryption, provider selection, error handling
- Consistent with existing AI feature patterns

### 3.2 New Method on AIProvider Interface

```typescript
// backend/src/services/ai/types.ts

export interface AIEnhanceFeedbackOptions {
  type: 'BUG' | 'FEATURE';
  title: string;
  description: string;
  category?: string;
  priority?: string;
}

export interface AIEnhancedFeedback {
  title: string;              // Polished title
  description: string;        // Structured markdown body
  suggestedLabels: string[];  // Recommended GitHub labels
  // Type-specific sections:
  acceptanceCriteria?: string[];  // For features
  reproductionSteps?: string[];   // For bugs
}

export interface AIProvider {
  // ... existing methods ...
  enhanceFeedback(options: AIEnhanceFeedbackOptions): Promise<AIEnhancedFeedback>;
}
```

### 3.3 Prompt Engineering

**Feature Request Template:**
```
You are a product manager polishing a user's feature request for a GitHub issue.

USER INPUT:
- Title: {title}
- Description: {description}
- Category: {category}
- Priority: {priority}

Generate a professional GitHub issue with:
1. A clear, action-oriented title (max 80 chars)
2. A well-structured description with:
   - Problem Statement (what user is trying to accomplish)
   - Proposed Solution (their idea, expanded)
   - Expected Benefit
3. Acceptance Criteria (3-5 testable points)
4. Suggested labels from: [enhancement, ui, editor, ai, priority-high, priority-low]

Return as JSON: { title, description, acceptanceCriteria, suggestedLabels }
```

**Bug Report Template:**
```
You are a QA engineer structuring a user's bug report for a GitHub issue.

USER INPUT:
- Title: {title}
- Description: {description}
- Category: {category}
- Severity: {priority}

Generate a professional GitHub issue with:
1. A clear, descriptive title (max 80 chars)
2. A well-structured description with:
   - Summary (what's broken)
   - Expected Behavior
   - Actual Behavior
3. Reproduction Steps (infer from description if possible)
4. Suggested labels from: [bug, ui, editor, ai, priority-high, priority-critical]

Return as JSON: { title, description, reproductionSteps, suggestedLabels }
```

### 3.4 AI Service Method

```typescript
// backend/src/services/ai/ai.service.ts

async enhanceFeedback(userId: string, options: AIEnhanceFeedbackOptions): Promise<AIEnhancedFeedback> {
  const provider = await this.getProviderForUser(userId);
  return provider.enhanceFeedback(options);
}
```

### 3.5 Response Parsing

The AI response is JSON. If parsing fails:
1. Log the raw response for debugging
2. Return a "minimal enhancement" using original content
3. Flag in UI that AI enhancement partially failed

---

## 4. Data Model

### 4.1 New Models

```prisma
// backend/prisma/schema.prisma

enum FeedbackType {
  BUG
  FEATURE
}

enum FeedbackStatus {
  NEW
  REVIEWED
  APPROVED
  PUBLISHED
  DECLINED
}

model FeedbackSubmission {
  id              String          @id @default(uuid())
  type            FeedbackType
  title           String          @db.VarChar(100)
  description     String          @db.Text
  category        String?         @db.VarChar(50)
  priority        String?         @db.VarChar(50)
  status          FeedbackStatus  @default(NEW)
  adminNotes      String?         @map("admin_notes") @db.Text

  // GitHub integration
  githubIssueUrl    String?       @map("github_issue_url") @db.VarChar(500)
  githubIssueNumber Int?          @map("github_issue_number")

  // AI enhancement cache
  enhancedContent   Json?         @map("enhanced_content")

  // User relation
  userId          String          @map("user_id")
  user            User            @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Timestamps
  createdAt       DateTime        @default(now()) @map("created_at")
  updatedAt       DateTime        @updatedAt @map("updated_at")
  reviewedAt      DateTime?       @map("reviewed_at")
  publishedAt     DateTime?       @map("published_at")

  @@index([userId])
  @@index([status])
  @@index([type, status])
  @@map("feedback_submissions")
}

model Notification {
  id        String    @id @default(uuid())
  type      String    @db.VarChar(50)  // NEW_FEEDBACK, STATUS_CHANGE, etc.
  title     String    @db.VarChar(200)
  message   String?   @db.Text
  isRead    Boolean   @default(false) @map("is_read")

  // Link to related entity
  linkType  String    @db.VarChar(50)  // feedback, note, etc.
  linkId    String    @map("link_id")

  // Recipient
  userId    String    @map("user_id")
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  createdAt DateTime  @default(now()) @map("created_at")
  readAt    DateTime? @map("read_at")

  @@index([userId, isRead])
  @@index([userId, createdAt])
  @@map("notifications")
}
```

### 4.2 User Model Extension

```prisma
model User {
  // ... existing fields ...

  // New relations
  feedbackSubmissions FeedbackSubmission[]
  notifications       Notification[]
}
```

### 4.3 SystemSetting Usage

GitHub and webhook configuration stored in SystemSetting (not new table):

| Key | Type | Description |
|-----|------|-------------|
| `feedback_github_token` | encrypted | Personal Access Token |
| `feedback_github_repo` | string | owner/repo format |
| `feedback_github_project` | string | Project ID (optional) |
| `feedback_github_labels` | json | Default labels array |
| `feedback_webhook_url` | string | Discord/Slack webhook URL |
| `feedback_webhook_enabled` | boolean | Toggle webhook on/off |

---

## 5. API Route Structure

### 5.1 Route Organization

```
backend/src/routes/
├── feedback.routes.ts      # User submission endpoints
├── admin/
│   ├── feedback.routes.ts  # Admin management endpoints
│   └── settings/
│       ├── github.routes.ts   # GitHub integration settings
│       └── webhook.routes.ts  # Webhook settings
└── notifications.routes.ts # Notification endpoints
```

### 5.2 Middleware

- All `/api/feedback/*` requires authentication (existing `authenticateToken`)
- All `/api/admin/*` requires admin role (existing `requireAdmin` or new middleware)
- Rate limiting on POST `/api/feedback`: 10/user/hour (new middleware)

---

## 6. Frontend Integration Points

### 6.1 New Components

```
frontend/src/components/
├── feedback/
│   ├── FeedbackButton.tsx      # Trigger in header
│   ├── FeedbackModal.tsx       # Submission form
│   └── FeedbackConfirmation.tsx
├── notifications/
│   ├── NotificationBell.tsx    # Header icon + badge
│   └── NotificationDropdown.tsx
└── admin/
    └── feedback/
        ├── FeedbackList.tsx
        ├── FeedbackDetail.tsx
        └── GitHubIssuePreview.tsx
```

### 6.2 State Management

- Use TanStack Query for feedback submissions, notifications (server state)
- Real-time badge update: Polling every 30s OR WebSocket (future)
- Local optimistic updates for marking notifications read

---

## 7. Migration Strategy

### 7.1 Database Migration

```bash
npx prisma migrate dev --name add_feedback_system
```

Creates:
- `feedback_submissions` table
- `notifications` table
- New indexes

### 7.2 Deployment Checklist

1. Apply database migration
2. Configure GitHub PAT in admin settings
3. Configure webhook URL (optional)
4. No breaking changes to existing functionality

---

## Summary of Key Decisions

| Area | Decision | Package/Pattern |
|------|----------|-----------------|
| GitHub Auth | Personal Access Token | Encrypted in SystemSetting |
| GitHub API | GraphQL v4 | `@octokit/graphql` |
| Webhook | Strategy pattern dispatcher | Auto-detect from URL |
| AI Enhancement | Extend existing AIProvider | New `enhanceFeedback()` method |
| Data Model | Two new tables | FeedbackSubmission, Notification |
| Settings Storage | Reuse SystemSetting | Key-value with encryption |

---

*Architecture document for Feedback System - Ready for Epic/Story creation*
