# Notez - Product Requirements Document

**Author:** SpasticPalate
**Date:** 2025-12-21
**Version:** 1.0
**Feature:** Feedback System (Bug Reports & Feature Requests)

---

## Executive Summary

Notez transforms from a personal note-taking application into a collaborative product with built-in user feedback capabilities. This feature enables any logged-in user to submit bug reports or feature requests through a friendly, non-intimidating interface. Administrators receive real-time notifications (in-app + optional Discord/Slack webhooks), can review and manage submissions in a dedicated admin panel, and leverage AI assistance to polish approved items into professional GitHub issues with automatic project board placement.

### What Makes This Special

**"Give your users a voice in the product roadmap - from idea to GitHub issue in seconds."**

The magic is the seamless, zero-friction pipeline:

1. **Friendly Form** → Non-technical users feel comfortable submitting ideas or reporting issues
2. **Instant Alerts** → Admin knows immediately via in-app bell or Discord/Slack ping
3. **AI Polish** → Rough ideas become well-structured GitHub issues automatically
4. **One-Click Publish** → Issue created AND placed on project board in a single action

This bridges the gap between "my wife has an idea" and "tracked issue in my backlog" with minimal overhead.

---

## Project Classification

**Technical Type:** Web Application (extending existing Notez SPA + REST API)
**Domain:** General (no regulatory requirements)
**Complexity:** Low-Medium (CRUD operations + external integrations)

This is a brownfield feature addition to the existing Notez application:

- Leverages existing authentication, user management, and admin panel infrastructure
- Adds new database models, API endpoints, and frontend components
- Integrates with external services (GitHub API, Discord/Slack webhooks)
- Uses existing AI infrastructure for content enhancement

---

## Success Criteria

**Primary Success Metric:**
Users actively submit feedback and admin can efficiently process it to GitHub.

**Specific Criteria:**

1. **Adoption** - Wife (primary user) submits at least one request/report within first week
2. **Friction** - Submission takes under 60 seconds from clicking "Suggest" to confirmation
3. **Processing** - Admin can go from new request to published GitHub issue in under 2 minutes
4. **Notification Reliability** - Admin is notified within 30 seconds of submission (in-app or webhook)
5. **Quality** - AI-enhanced GitHub issues require minimal manual editing before publish

**Anti-Success (What We're Avoiding):**

- Submissions that sit unreviewed for weeks
- GitHub issues that require significant rewriting
- Users confused about whether to report a bug or request a feature

---

## Product Scope

### MVP - Minimum Viable Product

The essential features that deliver core value:

1. **Unified Feedback Form** - Single form supporting both bug reports and feature requests via type toggle
2. **Admin Dashboard** - List view with filtering by type/status, detail view, status management
3. **In-App Notifications** - Bell icon with unread badge, notification dropdown with direct links
4. **Webhook Alerts** - Single URL configuration supporting Discord and Slack formats
5. **GitHub Integration** - Create issues in configured repo with automatic project board placement
6. **AI Enhancement** - Polish user submissions into professional GitHub issues with preview/edit
7. **User Requested Badge** - Visual token on shipped features/fixes that originated from user feedback, showing users their voice matters

### Growth Features (Post-MVP)

Features that enhance the experience once core is proven:

1. **Email Notifications** - Alternative alert channel for multi-user deployments
2. **User Submission History** - "My Feedback" page showing user's own submissions and their status
3. **Upvoting System** - Allow users to vote on others' feature requests
4. **Public Roadmap View** - Display approved features in a public-facing pipeline view

### Vision (Future)

Long-term possibilities:

1. **Multi-Platform Integration** - GitLab Issues, Jira, Linear support
2. **In-App Changelog** - "What's New" feed populated from shipped GitHub issues (badge system from MVP extends here)
3. **User Segments** - Different submission flows for different user types/roles
4. **Feedback Analytics** - Dashboard showing submission trends, categories, resolution rates

---

## User Experience Principles

### Design Philosophy

**"One Form, Two Paths"** - Users shouldn't stress about categorization. The form adapts based on a simple, friendly toggle.

**Visual Personality:** Warm, encouraging, non-intimidating. This is a conversation, not a support ticket.

**Key Emotion:** *"They actually WANT my feedback!"*

### Key Interactions

#### Interaction 1: The Submit Moment

- User clicks feedback button in header/menu
- Friendly overlay appears with encouraging copy
- Toggle between "🐛 Report a Problem" and "💡 Suggest Something"
- Form adapts language: bugs get "What happened?" vs features get "What would help?"
- Submit → instant "We got it!" confirmation
- **Target:** Under 60 seconds, feels like texting a friend

#### Interaction 2: Admin's Morning Check

- Open Notez → red badge on notification bell catches eye
- Click bell → dropdown: "Sarah reported a bug: Editor crashes on paste"
- One click → full detail view with action buttons
- **Target:** 3 clicks from login to reviewing a submission

#### Interaction 3: The GitHub Magic Moment

- Admin clicks "Create GitHub Issue" on approved submission
- AI-enhanced preview appears in ~2 seconds
- Review, tweak if needed, click "Publish"
- Issue created + board placement + status updated + link stored
- **Target:** Under 30 seconds from decision to published issue

---

## Functional Requirements

### Feedback Submission

| ID | Requirement |
|----|-------------|
| FR1 | Users can access feedback form from user menu or dedicated header button |
| FR2 | Users can toggle between "Report a Bug" and "Suggest a Feature" submission types |
| FR3 | Users can provide a title (required, 100 character max) |
| FR4 | Users can provide a description (required, 1000 character max) |
| FR5 | Users can select a category (optional: UI, Editor, AI, Organization, Other) |
| FR6 | Users can indicate priority/severity (optional: Nice-to-have, Helpful, Critical) |
| FR7 | Users receive immediate visual confirmation when feedback is submitted |
| FR8 | System captures submission metadata (user ID, username, timestamp, type) |

### Admin Management

| ID | Requirement |
|----|-------------|
| FR9 | Admins can view all feedback submissions in a paginated list view |
| FR10 | Admins can filter submissions by type (bug/feature), status, and category |
| FR11 | Admins can view full details of any submission |
| FR12 | Admins can update submission status (New, Reviewed, Approved, Published, Declined) |
| FR13 | Admins can add internal notes to submissions (not visible to submitter) |
| FR14 | Admins can delete submissions |
| FR15 | System displays count of new/unreviewed submissions in admin panel |

### Notification System

| ID | Requirement |
|----|-------------|
| FR16 | Admins see notification bell icon in application header |
| FR17 | Bell displays badge with count of unread notifications |
| FR18 | Clicking bell reveals notification dropdown with recent items |
| FR19 | Each notification links directly to the relevant submission |
| FR20 | Admins can mark individual notifications as read |
| FR21 | Admins can mark all notifications as read |
| FR22 | Admins can configure webhook URL in settings for external notifications |
| FR23 | System sends webhook payload when new submission is received |
| FR24 | Webhook format auto-adapts for Discord and Slack based on URL domain |

### GitHub Integration

| ID | Requirement |
|----|-------------|
| FR25 | Admins can configure GitHub connection in settings (Personal Access Token) |
| FR26 | Admins can specify target repository (owner/repo format) |
| FR27 | Admins can configure default labels for created issues |
| FR28 | Admins can configure target project board for issue placement |
| FR29 | Admins can trigger GitHub issue creation from any approved submission |
| FR30 | System creates issue in configured repository via GitHub API |
| FR31 | System places created issue on configured project board |
| FR32 | System stores bidirectional link between submission and GitHub issue |
| FR33 | Submission status auto-updates to "Published" after successful issue creation |
| FR34 | Published submissions display clickable link to GitHub issue |

### AI Enhancement

| ID | Requirement |
|----|-------------|
| FR35 | System uses user's configured AI provider to enhance submissions |
| FR36 | AI generates polished issue title from user's original input |
| FR37 | AI expands and structures description with proper markdown formatting |
| FR38 | AI suggests appropriate labels based on submission content and type |
| FR39 | AI generates acceptance criteria for feature requests |
| FR40 | AI generates reproduction steps for bug reports |
| FR41 | Admin can preview AI-enhanced content before publishing |
| FR42 | Admin can edit any AI-generated content before publishing |
| FR43 | Admin can reset to original user content and regenerate |

### User Requested Badge

| ID | Requirement |
|----|-------------|
| FR44 | System tracks which feedback submissions resulted in shipped features/fixes |
| FR45 | Shipped items display "User Requested" badge in relevant UI locations |
| FR46 | Badge links back to original submission (for admin) or shows submitter name |
| FR47 | Users who submitted shipped feedback see special recognition in their submission history |

---

## Non-Functional Requirements

### Security

| ID | Requirement |
|----|-------------|
| NFR1 | GitHub Personal Access Token stored encrypted at rest using existing ENCRYPTION_KEY |
| NFR2 | Webhook URLs validated for proper format before storage |
| NFR3 | Rate limiting on feedback submission: maximum 10 submissions per user per hour |
| NFR4 | Admin-only access enforced on all management and configuration endpoints |
| NFR5 | All user input sanitized before inclusion in GitHub API calls |
| NFR6 | Webhook URLs restricted to HTTPS only |

### Integration

| ID | Requirement |
|----|-------------|
| NFR7 | GitHub integration uses GitHub API v4 (GraphQL) for issue and project operations |
| NFR8 | Webhook delivery attempted within 30 seconds of submission |
| NFR9 | Failed webhook deliveries retried 3 times with exponential backoff |
| NFR10 | GitHub API failures handled gracefully with local queue for retry |
| NFR11 | System validates GitHub token and repo access on settings save |

### Performance

| ID | Requirement |
|----|-------------|
| NFR12 | AI enhancement completes within 5 seconds |
| NFR13 | Notification badge updates in real-time without page refresh |
| NFR14 | Admin list view loads within 1 second for up to 1000 submissions |

---

## Data Model

### FeedbackSubmission

```
FeedbackSubmission {
  id: UUID (PK)
  type: ENUM (BUG, FEATURE)
  title: VARCHAR(100)
  description: TEXT(1000)
  category: VARCHAR(50)?
  priority: VARCHAR(50)?
  status: ENUM (NEW, REVIEWED, APPROVED, PUBLISHED, DECLINED)
  adminNotes: TEXT?
  githubIssueUrl: VARCHAR(500)?
  githubIssueNumber: INT?

  userId: UUID (FK → User)

  createdAt: TIMESTAMP
  updatedAt: TIMESTAMP
  reviewedAt: TIMESTAMP?
  publishedAt: TIMESTAMP?
}
```

### Notification

```
Notification {
  id: UUID (PK)
  type: ENUM (NEW_FEEDBACK, STATUS_CHANGE, ...)
  title: VARCHAR(200)
  message: TEXT?
  isRead: BOOLEAN
  linkType: VARCHAR(50)
  linkId: UUID

  userId: UUID (FK → User) // recipient

  createdAt: TIMESTAMP
  readAt: TIMESTAMP?
}
```

### AdminSettings Extension

```
AdminSettings {
  // Existing fields...

  // GitHub Integration
  githubToken: TEXT? (encrypted)
  githubRepo: VARCHAR(200)?
  githubDefaultLabels: JSON?
  githubProjectBoard: VARCHAR(200)?

  // Webhook Notifications
  feedbackWebhookUrl: VARCHAR(500)?
  feedbackWebhookEnabled: BOOLEAN
}
```

---

## API Endpoints

### User Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/feedback` | Submit new feedback (bug or feature) |
| GET | `/api/feedback/mine` | Get current user's submissions |

### Admin Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/feedback` | List all submissions (paginated, filterable) |
| GET | `/api/admin/feedback/:id` | Get single submission details |
| PATCH | `/api/admin/feedback/:id` | Update status, add notes |
| DELETE | `/api/admin/feedback/:id` | Delete submission |
| POST | `/api/admin/feedback/:id/enhance` | Get AI-enhanced issue content |
| POST | `/api/admin/feedback/:id/publish` | Create GitHub issue and publish |

### Notification Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/notifications` | Get user's notifications |
| GET | `/api/notifications/unread-count` | Get unread count for badge |
| PATCH | `/api/notifications/:id/read` | Mark single notification read |
| POST | `/api/notifications/mark-all-read` | Mark all notifications read |

### Settings Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/settings/github` | Get GitHub integration settings |
| PUT | `/api/admin/settings/github` | Save GitHub integration settings |
| POST | `/api/admin/settings/github/test` | Test GitHub connection |
| GET | `/api/admin/settings/webhook` | Get webhook settings |
| PUT | `/api/admin/settings/webhook` | Save webhook settings |
| POST | `/api/admin/settings/webhook/test` | Send test webhook |

---

## References

- **UX Mockup:** [temp/feature-request-ux-mockup.html](../temp/feature-request-ux-mockup.html)
- **Existing API Reference:** [docs/api-reference.md](./api-reference.md)
- **Data Model Reference:** [docs/data-model.md](./data-model.md)

---

_This PRD captures the Feedback System for Notez - empowering users to shape the product roadmap through an effortless submission-to-GitHub pipeline._

_Created through collaborative BMAD Party Mode between Adam and the full agent team: John (PM), Sally (UX), Winston (Architect), Mary (Analyst), Murat (Test), and the BMad Master._
