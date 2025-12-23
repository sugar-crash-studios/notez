# Epic: Feedback System

> Implements user feedback submission, admin management, and GitHub integration
> PRD: [docs/prd.md](../prd.md)
> Architecture: [docs/architecture-feedback-system.md](../architecture-feedback-system.md)

---

## Epic Overview

**Epic ID:** FEEDBACK-EPIC-001
**Priority:** High
**Estimated Complexity:** Medium-Large

**Business Value:**
Transform Notez from a personal note app into a collaborative product where users can shape the roadmap. Bridge the gap from "user has an idea" to "tracked GitHub issue" with minimal friction.

**Success Metrics:**
- Submission takes <60 seconds
- Admin processes to GitHub issue in <2 minutes
- Notifications delivered within 30 seconds

---

## Stories

### Story 1: Database Schema & Models

**ID:** FEEDBACK-001
**Points:** 3
**Priority:** P0 (Blocker for all other stories)

**Description:**
Create the database schema for feedback submissions and notifications.

**Acceptance Criteria:**
- [ ] AC1: FeedbackSubmission model exists with all fields per architecture doc
- [ ] AC2: Notification model exists with all fields per architecture doc
- [ ] AC3: User model has relations to FeedbackSubmission and Notification
- [ ] AC4: Prisma migration applies cleanly
- [ ] AC5: Indexes created for userId, status, and type+status queries

**Technical Notes:**
- See [architecture-feedback-system.md](../architecture-feedback-system.md) Section 4
- Create migration: `npx prisma migrate dev --name add_feedback_system`

---

### Story 2: Feedback Submission API

**ID:** FEEDBACK-002
**Points:** 5
**Priority:** P0

**Description:**
Create backend API for users to submit bug reports and feature requests.

**Acceptance Criteria:**
- [ ] AC1: POST `/api/feedback` creates new submission with validated input
- [ ] AC2: Title required, max 100 chars; Description required, max 1000 chars
- [ ] AC3: Type enum (BUG, FEATURE) validated
- [ ] AC4: Category and priority are optional
- [ ] AC5: Returns created submission with ID and timestamp
- [ ] AC6: Rate limited to 10 submissions per user per hour
- [ ] AC7: GET `/api/feedback/mine` returns user's own submissions

**Dependencies:** FEEDBACK-001

**Technical Notes:**
- Zod schemas for validation
- New rate limiter middleware or decorator
- Follow existing route patterns (e.g., notes.routes.ts)

---

### Story 3: Feedback Submission UI

**ID:** FEEDBACK-003
**Points:** 5
**Priority:** P0

**Description:**
Create the user-facing feedback submission modal with bug/feature toggle.

**Acceptance Criteria:**
- [ ] AC1: "Feedback" button visible in user menu or header
- [ ] AC2: Modal opens with friendly, encouraging copy
- [ ] AC3: Toggle switches between "Report a Problem" and "Suggest Something"
- [ ] AC4: Form fields adapt language based on type selection
- [ ] AC5: Submit shows loading state, then success confirmation
- [ ] AC6: Error states handled gracefully (rate limit message, validation errors)
- [ ] AC7: Modal closes on successful submission

**Dependencies:** FEEDBACK-002

**Technical Notes:**
- Reference [temp/feature-request-ux-mockup.html](../temp/feature-request-ux-mockup.html) for design
- Use existing modal patterns from codebase
- TanStack Query mutation for submission

---

### Story 4: Admin Feedback List & Management API

**ID:** FEEDBACK-004
**Points:** 5
**Priority:** P1

**Description:**
Create admin API endpoints for viewing and managing feedback submissions.

**Acceptance Criteria:**
- [ ] AC1: GET `/api/admin/feedback` returns paginated list of all submissions
- [ ] AC2: Supports filtering by type, status, category
- [ ] AC3: GET `/api/admin/feedback/:id` returns full submission details
- [ ] AC4: PATCH `/api/admin/feedback/:id` updates status and/or adminNotes
- [ ] AC5: DELETE `/api/admin/feedback/:id` removes submission
- [ ] AC6: All endpoints require admin role
- [ ] AC7: Status changes update reviewedAt timestamp appropriately

**Dependencies:** FEEDBACK-001

**Technical Notes:**
- Admin middleware (requireAdmin or role check)
- Follow existing admin route patterns

---

### Story 5: Admin Feedback Dashboard UI

**ID:** FEEDBACK-005
**Points:** 8
**Priority:** P1

**Description:**
Create admin panel for viewing and managing feedback submissions.

**Acceptance Criteria:**
- [ ] AC1: New "Feedback" section in admin panel navigation
- [ ] AC2: List view shows all submissions with type, title, status, date, submitter
- [ ] AC3: Filters for type (bug/feature), status, category
- [ ] AC4: Click opens detail view with full description
- [ ] AC5: Status dropdown to change submission status
- [ ] AC6: Admin notes field (private, not visible to user)
- [ ] AC7: Delete button with confirmation
- [ ] AC8: Count badge shows number of NEW submissions

**Dependencies:** FEEDBACK-004

**Technical Notes:**
- Add route to existing admin layout
- Reference mockup for design patterns

---

### Story 6: Notification System Backend

**ID:** FEEDBACK-006
**Points:** 5
**Priority:** P1

**Description:**
Create notification system for alerting admins of new submissions.

**Acceptance Criteria:**
- [ ] AC1: Notification created when new feedback submitted
- [ ] AC2: GET `/api/notifications` returns user's notifications (paginated)
- [ ] AC3: GET `/api/notifications/unread-count` returns count for badge
- [ ] AC4: PATCH `/api/notifications/:id/read` marks notification as read
- [ ] AC5: POST `/api/notifications/mark-all-read` marks all as read
- [ ] AC6: Only admins receive feedback notifications

**Dependencies:** FEEDBACK-001

**Technical Notes:**
- NotificationService to create notifications
- Called from FeedbackService after submission created

---

### Story 7: Notification Bell UI

**ID:** FEEDBACK-007
**Points:** 5
**Priority:** P1

**Description:**
Add notification bell to header with unread count and dropdown.

**Acceptance Criteria:**
- [ ] AC1: Bell icon visible in header (admin users only)
- [ ] AC2: Red badge shows unread count (hidden when 0)
- [ ] AC3: Click opens dropdown with recent notifications
- [ ] AC4: Each notification clickable, navigates to relevant item
- [ ] AC5: "Mark all read" action in dropdown
- [ ] AC6: Clicking notification marks it as read
- [ ] AC7: Badge updates after marking read

**Dependencies:** FEEDBACK-006

**Technical Notes:**
- Poll every 30s for unread count (simple first, WebSocket later)
- TanStack Query for notification data

---

### Story 8: Webhook Dispatcher

**ID:** FEEDBACK-008
**Points:** 5
**Priority:** P2

**Description:**
Create webhook system to send notifications to Discord/Slack.

**Acceptance Criteria:**
- [ ] AC1: WebhookService dispatches to configured URL on new submission
- [ ] AC2: Auto-detects Discord vs Slack from URL domain
- [ ] AC3: Formats payload appropriately (Discord embed, Slack blocks)
- [ ] AC4: Retries 3x with exponential backoff on failure
- [ ] AC5: Logs webhook delivery status (success/failure)
- [ ] AC6: Webhook URL stored in SystemSetting

**Dependencies:** FEEDBACK-001

**Technical Notes:**
- See architecture doc Section 2
- Strategy pattern for payload formatters

---

### Story 9: Webhook Settings UI

**ID:** FEEDBACK-009
**Points:** 3
**Priority:** P2

**Description:**
Add admin settings page for configuring webhook notifications.

**Acceptance Criteria:**
- [ ] AC1: Settings section for "Webhook Notifications"
- [ ] AC2: Input field for webhook URL (HTTPS required)
- [ ] AC3: Toggle to enable/disable webhooks
- [ ] AC4: "Test Webhook" button sends test message
- [ ] AC5: Shows success/error feedback for test
- [ ] AC6: Save persists to SystemSetting

**Dependencies:** FEEDBACK-008

---

### Story 10: GitHub Integration Backend

**ID:** FEEDBACK-010
**Points:** 8
**Priority:** P1

**Description:**
Create GitHub service for creating issues and adding to project boards.

**Acceptance Criteria:**
- [ ] AC1: GitHubService uses @octokit/graphql for API calls
- [ ] AC2: Decrypts PAT from SystemSetting using existing encryption
- [ ] AC3: createIssue() creates issue in configured repo
- [ ] AC4: addToProject() adds issue to configured project board
- [ ] AC5: testConnection() validates token and repo access
- [ ] AC6: Handles errors gracefully (401, 403, 404, rate limit)
- [ ] AC7: POST `/api/admin/feedback/:id/publish` creates issue and updates submission

**Dependencies:** FEEDBACK-001, FEEDBACK-004

**Technical Notes:**
- See architecture doc Section 1
- Install @octokit/graphql package

---

### Story 11: GitHub Settings UI

**ID:** FEEDBACK-011
**Points:** 5
**Priority:** P1

**Description:**
Add admin settings page for GitHub integration configuration.

**Acceptance Criteria:**
- [ ] AC1: Settings section for "GitHub Integration"
- [ ] AC2: Input for Personal Access Token (masked display)
- [ ] AC3: Input for repository (owner/repo format with validation)
- [ ] AC4: Input for project board ID (optional)
- [ ] AC5: Multi-select for default labels
- [ ] AC6: "Test Connection" button validates settings
- [ ] AC7: Shows repo name and permissions on successful test
- [ ] AC8: Save encrypts token and persists to SystemSetting

**Dependencies:** FEEDBACK-010

---

### Story 12: AI Enhancement Pipeline

**ID:** FEEDBACK-012
**Points:** 8
**Priority:** P1

**Description:**
Add AI enhancement capability to polish submissions for GitHub.

**Acceptance Criteria:**
- [ ] AC1: New enhanceFeedback() method on AIProvider interface
- [ ] AC2: Implemented for all three providers (Anthropic, OpenAI, Gemini)
- [ ] AC3: Bug reports get structured description + reproduction steps
- [ ] AC4: Feature requests get structured description + acceptance criteria
- [ ] AC5: Suggests appropriate labels based on content
- [ ] AC6: POST `/api/admin/feedback/:id/enhance` returns enhanced content
- [ ] AC7: Enhanced content cached in submission.enhancedContent

**Dependencies:** FEEDBACK-004

**Technical Notes:**
- See architecture doc Section 3 for prompts
- Follow existing provider pattern

---

### Story 13: GitHub Issue Creator UI

**ID:** FEEDBACK-013
**Points:** 8
**Priority:** P1

**Description:**
Create the "Create GitHub Issue" workflow in admin panel.

**Acceptance Criteria:**
- [ ] AC1: "Create GitHub Issue" button on approved submissions
- [ ] AC2: Click triggers AI enhancement (shows loading)
- [ ] AC3: Preview modal shows enhanced title, description, labels
- [ ] AC4: All fields editable before publish
- [ ] AC5: "Reset" button regenerates AI content
- [ ] AC6: "Publish" button creates issue + adds to board
- [ ] AC7: Success shows link to created issue
- [ ] AC8: Submission status updates to PUBLISHED with issue URL

**Dependencies:** FEEDBACK-010, FEEDBACK-011, FEEDBACK-012

---

### Story 14: User Requested Badge

**ID:** FEEDBACK-014
**Points:** 3
**Priority:** P2

**Description:**
Add "User Requested" badge for shipped feedback items.

**Acceptance Criteria:**
- [ ] AC1: Published submissions can be marked as "shipped"
- [ ] AC2: Badge component displays "User Requested" with icon
- [ ] AC3: Badge links to original submission (admin) or shows submitter name
- [ ] AC4: Badge visible in relevant UI locations (What's New, changelog)
- [ ] AC5: User's own shipped submissions highlighted in /feedback/mine

**Dependencies:** FEEDBACK-004, FEEDBACK-005

---

## Story Dependency Graph

```
FEEDBACK-001 (Schema)
    │
    ├── FEEDBACK-002 (Submit API) ──► FEEDBACK-003 (Submit UI)
    │
    ├── FEEDBACK-004 (Admin API) ──┬── FEEDBACK-005 (Admin UI)
    │                              │
    │                              ├── FEEDBACK-010 (GitHub Backend) ──► FEEDBACK-011 (GitHub Settings)
    │                              │                                          │
    │                              ├── FEEDBACK-012 (AI Enhancement) ─────────┤
    │                              │                                          │
    │                              └── FEEDBACK-014 (Badge) ◄─────────────────┘
    │                                                                         │
    ├── FEEDBACK-006 (Notif API) ──► FEEDBACK-007 (Notif Bell)               │
    │                                                                         │
    └── FEEDBACK-008 (Webhook) ───► FEEDBACK-009 (Webhook Settings)          │
                                                                              │
                                    FEEDBACK-013 (Issue Creator) ◄────────────┘
```

## Sprint Suggestion

**Sprint 1 (Foundation):**
- FEEDBACK-001: Schema (3 pts)
- FEEDBACK-002: Submit API (5 pts)
- FEEDBACK-003: Submit UI (5 pts)
- FEEDBACK-004: Admin API (5 pts)
- FEEDBACK-006: Notification API (5 pts)

**Sprint 2 (Admin Experience):**
- FEEDBACK-005: Admin Dashboard (8 pts)
- FEEDBACK-007: Notification Bell (5 pts)
- FEEDBACK-010: GitHub Backend (8 pts)
- FEEDBACK-011: GitHub Settings (5 pts)

**Sprint 3 (GitHub Magic):**
- FEEDBACK-012: AI Enhancement (8 pts)
- FEEDBACK-013: Issue Creator (8 pts)
- FEEDBACK-008: Webhook Dispatcher (5 pts)
- FEEDBACK-009: Webhook Settings (3 pts)
- FEEDBACK-014: User Badge (3 pts)

---

**Total Points:** 71
**Estimated Sprints:** 3 (if sprint velocity ~25 pts)

---

*Epic ready for sprint planning and implementation*
