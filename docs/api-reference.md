# Notez API Reference

> Generated from codebase analysis — last updated 2026-03-06

## Base URL

- **Development:** `http://localhost:3000`
- **Production:** Same origin (backend serves frontend static files)

All API routes are prefixed with `/api`.

---

## Authentication

### Session Authentication (Browser / Frontend)

Most endpoints use JWT session auth.

- **Access token** — Short-lived JWT, sent as `Authorization: Bearer {token}` header.
- **Refresh token** — Long-lived (7 days), stored as a signed HttpOnly cookie (`refreshToken`). Automatically rotated on each refresh.

### API Token Authentication (MCP / Service Accounts)

The `/api/mcp/*` routes use API tokens instead of session JWTs.

- **Header:** `Authorization: Bearer ntez_{token}`
- Tokens are scoped (`read`, `write`) and may have expiry dates.
- Rate limit: 120 requests/minute per token.

### Global Rate Limits

| Context | Limit |
|---------|-------|
| General API | 300 req/min (per IP) |
| Login / Setup | 5 req per 15 min (per IP + username) |
| Password reset | 3 req/hour (per IP) |
| Image upload | 10 uploads per 5 min (per user) |
| Avatar upload | 5 per 5 min (per user) |
| Username change | 5 per hour (per user) |
| MCP endpoints | 120 req/min (per token) |

### Security Headers

Every response includes: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.

---

## Error Responses

All errors use a consistent envelope:

```json
{
  "error": "Error Type",
  "message": "Human-readable description"
}
```

### Common Status Codes

| Code | Meaning |
|------|---------|
| 400 | Bad Request — validation failed or invalid input |
| 401 | Unauthorized — missing or invalid token |
| 403 | Forbidden — authenticated but not permitted |
| 404 | Not Found |
| 409 | Conflict — resource already exists |
| 413 | Payload Too Large — file exceeds size limit |
| 429 | Too Many Requests — rate limited |
| 500 | Internal Server Error |
| 503 | Service Unavailable — external dependency down (e.g., AI provider) |

---

## Health Check

```http
GET /health
```

No authentication required.

**Response:**
```json
{ "status": "ok", "database": "connected" }
```

---

## Auth

### Check Setup Status

```http
GET /api/auth/setup-needed
```

Returns whether the first admin account has been created yet.

**Response:**
```json
{ "setupNeeded": true }
```

---

### Initial Setup (First Admin)

```http
POST /api/auth/setup
```

Only works before any user exists. Creates the first admin account and logs them in.

**Body:**
```json
{
  "username": "admin",
  "email": "admin@example.com",
  "password": "SecurePass123!"
}
```

**Password rules:** min 8 chars, 1 uppercase, 1 number, 1 special character.

**Response:** `200 OK`
```json
{
  "message": "Setup completed successfully",
  "user": { "userId": "uuid", "username": "admin", "role": "admin" },
  "accessToken": "jwt"
}
```
Sets `refreshToken` cookie (httpOnly, signed, sameSite=lax, 7 days).

**Errors:** `409 Conflict` if setup has already been completed.

---

### Login

```http
POST /api/auth/login
```

**Body:**
```json
{
  "usernameOrEmail": "admin",
  "password": "SecurePass123!"
}
```

**Response:** `200 OK`
```json
{
  "message": "Login successful",
  "user": {
    "userId": "uuid",
    "username": "admin",
    "email": "admin@example.com",
    "role": "admin",
    "isServiceAccount": false,
    "mustChangePassword": false
  },
  "accessToken": "jwt"
}
```
Sets `refreshToken` cookie.

**Errors:** `401` for invalid credentials or deactivated account.

---

### Refresh Access Token

```http
POST /api/auth/refresh
```

Uses the `refreshToken` cookie. Returns a new access token and rotates the refresh token.

**Response:** `200 OK`
```json
{
  "message": "Token refreshed successfully",
  "user": { ... },
  "accessToken": "new_jwt"
}
```

**Errors:** `401` if refresh token is missing, invalid, or expired (cookie is cleared).

---

### Logout

```http
POST /api/auth/logout
Authorization: Bearer {token}
```

Invalidates the refresh token and clears the cookie.

**Response:** `200 OK` `{ "message": "Logout successful" }`

---

### Change Password

```http
POST /api/auth/change-password
Authorization: Bearer {token}
```

**Body:**
```json
{
  "currentPassword": "OldPass123!",
  "newPassword": "NewPass456!"
}
```

**Errors:** `400` if current password is incorrect.

---

### Get Current User

```http
GET /api/auth/me
Authorization: Bearer {token}
```

**Response:**
```json
{
  "user": {
    "userId": "uuid",
    "username": "admin",
    "email": "admin@example.com",
    "role": "admin",
    "isServiceAccount": false,
    "mustChangePassword": false
  }
}
```

---

### Forgot Password

```http
POST /api/auth/forgot-password
```

Sends a password reset email. Always returns success to prevent email enumeration.

**Body:**
```json
{ "email": "user@example.com" }
```

**Response:** `200 OK` (regardless of whether the email exists)

---

### Reset Password

```http
POST /api/auth/reset-password
```

**Body:**
```json
{
  "token": "reset_token_from_email",
  "newPassword": "NewPass456!"
}
```

**Errors:** `400` for invalid or expired token.

---

### Validate Reset Token

```http
GET /api/auth/validate-reset-token?token={token}
```

Check if a password reset token is still valid before showing the reset form.

**Response:**
```json
{ "valid": true }
```

---

## Profile

### Get My Profile

```http
GET /api/profile/me
Authorization: Bearer {token}
```

Same as `/auth/me` but also includes `avatarUrl` and `createdAt`.

**Response:**
```json
{
  "user": {
    "userId": "uuid",
    "username": "alice",
    "email": "alice@example.com",
    "role": "user",
    "avatarUrl": "/api/profile/avatar/uuid",
    "mustChangePassword": false,
    "createdAt": "2025-01-01T00:00:00Z"
  }
}
```

---

### Get User Avatar (Public)

```http
GET /api/profile/avatar/:userId
```

No authentication required. Returns a 1×1 transparent PNG if no avatar is set (with `X-Avatar-Status: not-found` header) instead of a 404.

**Response:** Raw image bytes with appropriate `Content-Type`.

---

### Upload Avatar

```http
POST /api/profile/avatar
Authorization: Bearer {token}
Content-Type: multipart/form-data
```

Replaces existing avatar. Max 5MB. Allowed formats: JPEG, PNG, GIF, WebP.

**Response:**
```json
{
  "message": "Avatar uploaded successfully",
  "avatarUrl": "/api/profile/avatar/uuid"
}
```

**Errors:** `400` for invalid type, `413` if over 5MB.

---

### Delete Avatar

```http
DELETE /api/profile/avatar
Authorization: Bearer {token}
```

**Response:** `200 OK` `{ "message": "Avatar deleted successfully" }`

---

### Change Username

```http
PATCH /api/profile/username
Authorization: Bearer {token}
```

Service accounts cannot change their username.

**Body:**
```json
{ "username": "new_username" }
```

**Username rules:** 3–50 chars, `[a-zA-Z0-9_-]` only, cannot be a reserved word.

**Errors:** `403` for service accounts, `409` if username is taken.

---

## Notes

All notes endpoints require `Authorization: Bearer {token}`.

### List Notes

```http
GET /api/notes
```

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `folderId` | UUID \| `"null"` | Filter by folder; use `"null"` for unfiled notes |
| `tagId` | UUID | Filter by tag |
| `search` | string | Keyword filter |
| `limit` | integer | Max results (default 50, max 100) |
| `offset` | integer | Pagination offset (default 0) |

**Response:**
```json
{
  "notes": [
    {
      "id": "uuid",
      "title": "Note Title",
      "content": "<p>HTML content</p>",
      "folderId": "uuid | null",
      "createdAt": "2025-01-01T00:00:00Z",
      "updatedAt": "2025-01-01T00:00:00Z",
      "tags": [{ "id": "uuid", "name": "tag-name" }]
    }
  ],
  "total": 100
}
```

---

### Get Note Statistics

```http
GET /api/notes/stats
Authorization: Bearer {token}
```

**Response:**
```json
{ "total": 42, "inFolders": 30, "unfiled": 12, "inTrash": 3 }
```

---

### Get Note

```http
GET /api/notes/:id
```

**Response:**
```json
{ "note": { "id": "uuid", "title": "...", "content": "...", ... } }
```

**Errors:** `404` if not found or not owned by user.

---

### Create Note

```http
POST /api/notes
```

**Body:**
```json
{
  "title": "New Note",
  "content": "<p>HTML content</p>",
  "folderId": "uuid",
  "tags": ["tag1", "tag2"]
}
```

`title` is required (1–500 chars). `content`, `folderId`, and `tags` are optional. Tags are created if they don't exist.

**Response:** `201 Created`
```json
{ "message": "Note created successfully", "note": { ... } }
```

---

### Update Note

```http
PATCH /api/notes/:id
```

All fields optional (only send what you want to change). Set `folderId: null` to unfile.

**Body:**
```json
{
  "title": "Updated Title",
  "content": "<p>Updated content</p>",
  "folderId": null,
  "tags": ["tag1"]
}
```

**Errors:** `403` if caller is not the owner and has VIEW-only share permission.

---

### Delete Note (Soft Delete)

```http
DELETE /api/notes/:id
```

Moves the note to trash. Recoverable via restore.

**Response:** `{ "message": "Note moved to trash" }`

---

### List Trash

```http
GET /api/notes/trash
```

Lists the authenticated user's soft-deleted notes.

---

### Restore Note

```http
POST /api/notes/:id/restore
```

Moves note from trash back to its previous location.

---

### Permanently Delete Note

```http
DELETE /api/notes/:id/permanent
```

Irreversible. Permanently removes the note and all associated data.

---

## Note References (Wiki-Links)

All routes require `Authorization: Bearer {token}`.

### Find Notes by Keyword

```http
GET /api/notes/references?keyword={text}&limit={n}&offset={n}
```

Returns all notes that contain a `[[keyword]]` wiki-link.

**Response:**
```json
{
  "notes": [{ "id": "uuid", "title": "...", "updatedAt": "..." }],
  "total": 5
}
```

---

### Get Backlinks for a Note

```http
GET /api/notes/:id/backlinks
```

Returns all notes that link **to** this note (by title match).

**Response:**
```json
{
  "backlinks": [{ "id": "uuid", "title": "...", "updatedAt": "..." }],
  "count": 3
}
```

---

### Get All Wiki-Link Keywords

```http
GET /api/notes/keywords
```

Returns all unique keywords from `[[wiki-links]]` used by the authenticated user. Useful for autocomplete.

**Response:**
```json
{ "keywords": ["Alice", "Project X", "Meeting Notes"] }
```

---

## Folders

All routes require `Authorization: Bearer {token}`.

### List Folders

```http
GET /api/folders
```

**Response:**
```json
{
  "folders": [
    {
      "id": "uuid",
      "name": "Work",
      "icon": "briefcase",
      "createdAt": "...",
      "updatedAt": "...",
      "_count": { "notes": 10 }
    }
  ],
  "total": 3
}
```

---

### Get Folder Statistics

```http
GET /api/folders/stats
```

**Response:**
```json
{ "total": 3, "totalNotes": 42 }
```

---

### Get Folder

```http
GET /api/folders/:id
```

**Response:** `{ "folder": { ... } }`

---

### Create Folder

```http
POST /api/folders
```

**Body:**
```json
{ "name": "New Folder", "icon": "briefcase" }
```

`icon` is optional (defaults to `"folder"`). See [Folder Icons](#folder-icons) for valid values.

**Response:** `201 Created` `{ "message": "Folder created successfully", "folder": { ... } }`

**Errors:** `409` if a folder with the same name already exists.

---

### Update Folder

```http
PATCH /api/folders/:id
```

**Body:** `{ "name": "Renamed", "icon": "star" }` (all fields optional)

---

### Delete Folder

```http
DELETE /api/folders/:id
```

Notes in the folder are moved to unfiled (not deleted).

---

#### Folder Icons

Valid values for the `icon` field:

```
folder, folder-open, briefcase, home, star, heart, bookmark,
file-text, code, terminal, book, archive, inbox, lightbulb,
target, flag, calendar, clock, users, user, settings,
camera, music, video, image, globe, map-pin, shopping-bag,
palette, paintbrush, pencil, pen, pen-tool, flower, drama,
coffee, utensils, gift,
server, cpu, hard-drive, network, wifi, database, cloud,
monitor, laptop, smartphone,
gamepad-2, trophy, swords, dice-5, dollar-sign, credit-card,
graduation-cap, brain, flask-conical, dumbbell, mountain, tree-pine,
plane, mail, message-circle, lock, shield, headphones, tv, wrench
```

---

## Tags

All routes require `Authorization: Bearer {token}`. Prefix: `/api/tags`.

### List Tags

```http
GET /api/tags
```

**Response:** `{ "tags": [{ "id": "uuid", "name": "tag-name", "_count": { "notes": 5 } }] }`

---

### Search Tags (Autocomplete)

```http
GET /api/tags/search?q={query}&limit={n}
```

Returns matching tags (default limit 10, max 100). Returns all tags if `q` is omitted.

---

### Get Tag Statistics

```http
GET /api/tags/stats
```

---

### Get Tag

```http
GET /api/tags/:id
```

---

### Rename Tag

```http
PATCH /api/tags/:id
```

**Body:** `{ "name": "new-name" }`

**Errors:** `400` for empty name, `404` if not found, `409` if name already used.

---

### Delete Tag

```http
DELETE /api/tags/:id
```

Removes the tag from all notes and deletes it. `{ "message": "Tag deleted successfully" }`

---

## Tasks

All routes require `Authorization: Bearer {token}`.

### List Tasks

```http
GET /api/tasks
```

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `status` | enum \| enum[] | PENDING, IN_PROGRESS, COMPLETED, CANCELLED (can be array) |
| `priority` | enum | LOW, MEDIUM, HIGH, URGENT |
| `folderId` | UUID | Filter by folder |
| `noteId` | UUID | Filter by linked note |
| `tagId` | UUID | Filter by tag |
| `overdue` | boolean | Filter tasks past their due date |
| `sortBy` | string | priority, dueDate, createdAt, title (default: priority) |
| `sortOrder` | string | asc, desc (default: desc) |
| `limit` | integer | Default 50, max 100 |
| `offset` | integer | Default 0 |

**Response:**
```json
{
  "tasks": [
    {
      "id": "uuid",
      "title": "Task title",
      "description": "...",
      "status": "PENDING",
      "priority": "MEDIUM",
      "dueDate": "2025-01-15T00:00:00Z",
      "noteId": "uuid | null",
      "folderId": "uuid | null",
      "tags": [...],
      "links": [{ "id": "uuid", "url": "https://...", "title": "Link Title" }],
      "createdAt": "...",
      "updatedAt": "..."
    }
  ],
  "total": 50
}
```

---

### Get Task Statistics

```http
GET /api/tasks/stats
```

**Response:**
```json
{
  "total": 25,
  "byStatus": { "PENDING": 10, "IN_PROGRESS": 5, "COMPLETED": 8, "CANCELLED": 2 },
  "overdue": 3
}
```

---

### Scan Notes for Tasks (Preview)

```http
POST /api/tasks/scan
```

Scans notes for checklist items (`[ ]` / `[x]`) without creating tasks. Use to preview before importing.

**Body:**
```json
{
  "folderId": "uuid",
  "noteIds": ["uuid1", "uuid2"]
}
```

**Response:**
```json
{
  "tasks": [
    { "noteId": "uuid", "noteTitle": "Note Title", "title": "Do something", "checked": false, "folderId": "uuid | null" }
  ],
  "count": 5
}
```

---

### Import Tasks from Notes

```http
POST /api/tasks/import
```

Creates tasks from previously scanned checklist items.

**Body:**
```json
{
  "tasks": [
    { "noteId": "uuid", "noteTitle": "Note Title", "title": "Do something", "checked": false, "folderId": "uuid | null" }
  ]
}
```

**Response:** `{ "imported": [...], "count": 3 }`

---

### Get Task

```http
GET /api/tasks/:id
```

**Errors:** `404` if not found.

---

### Create Task

```http
POST /api/tasks
```

**Body:**
```json
{
  "title": "New Task",
  "description": "Optional description",
  "status": "PENDING",
  "priority": "MEDIUM",
  "dueDate": "2025-01-15T00:00:00Z",
  "noteId": "uuid",
  "folderId": "uuid",
  "tags": ["tag1"],
  "links": [{ "url": "https://example.com", "title": "Reference" }]
}
```

`title` is required. Max 10 links per task. `dueDate` must be ISO 8601 datetime.

**Response:** `201 Created` — the created task object.

---

### Update Task

```http
PUT /api/tasks/:id
```

All fields optional. Set `dueDate: null`, `noteId: null`, or `folderId: null` to clear those fields.

---

### Update Task Status

```http
PATCH /api/tasks/:id/status
```

Quick status-only update.

**Body:** `{ "status": "COMPLETED" }`

---

### Delete Task

```http
DELETE /api/tasks/:id
```

**Response:** `204 No Content`

---

### Add Link to Task

```http
POST /api/tasks/:id/links
```

**Body:**
```json
{ "url": "https://example.com", "title": "Optional title" }
```

Max 10 links per task. Only `http`/`https` URLs allowed. Max URL length 2048 chars.

**Response:** `201 Created` — the created link object.

---

### Update Task Link

```http
PATCH /api/tasks/:id/links/:linkId
```

**Body:** `{ "url": "https://new-url.com", "title": "New title" }` (all optional)

---

### Delete Task Link

```http
DELETE /api/tasks/:id/links/:linkId
```

**Response:** `204 No Content`

---

## Search

```http
GET /api/search?q={query}&folderId={id}&limit={n}&offset={n}
Authorization: Bearer {token}
```

Full-text search across notes. `q` is required (1–500 chars).

**Query Parameters:**

| Param | Default | Max |
|-------|---------|-----|
| `q` | — | 500 chars |
| `folderId` | all | — |
| `limit` | 20 | 100 |
| `offset` | 0 | — |

**Response:**
```json
{
  "results": [
    {
      "id": "uuid",
      "title": "Note Title",
      "snippet": "...matching **content** highlighted...",
      "folderId": "uuid | null",
      "folderName": "Work | null",
      "rank": 0.95
    }
  ],
  "total": 25
}
```

---

## Images

### Upload Image

```http
POST /api/images/upload
Authorization: Bearer {token}
Content-Type: multipart/form-data
```

Max 10MB. Allowed MIME types: `image/jpeg`, `image/png`, `image/gif`, `image/webp`. Content is validated beyond MIME type to prevent spoofing.

**Response:**
```json
{
  "success": true,
  "id": "uuid",
  "url": "/api/images/uuid",
  "width": 1920,
  "height": 1080
}
```

**Errors:** `400` for invalid type/content, `413` for oversized file.

---

### Get Image

```http
GET /api/images/:id
```

No authentication required (images are served publicly by ID). Supports `If-None-Match` conditional GETs (ETag-based caching). Response is the raw image bytes.

---

### Delete Image

```http
DELETE /api/images/:id
Authorization: Bearer {token}
```

Only the owner can delete. Removes from both storage and database.

**Response:** `{ "success": true }`

**Errors:** `403` if not the owner.

---

### List User Images

```http
GET /api/images?noteId={uuid}&limit={n}&offset={n}
Authorization: Bearer {token}
```

| Param | Default | Max |
|-------|---------|-----|
| `noteId` | all | — |
| `limit` | 50 | 100 |
| `offset` | 0 | — |

**Response:**
```json
{
  "images": [
    { "id": "uuid", "url": "/api/images/uuid", "filename": "photo.jpg", "mimeType": "image/jpeg", "size": 204800, "width": 1920, "height": 1080, "noteId": "uuid | null", "createdAt": "..." }
  ],
  "total": 12,
  "limit": 50,
  "offset": 0
}
```

---

## Sharing

All routes require `Authorization: Bearer {token}`.

### Get Shared Contacts (Autocomplete)

```http
GET /api/shares/contacts?q={query}&limit={n}
```

Returns users the current user has previously shared notes with. Useful for autocomplete when sharing.

| Param | Default | Max |
|-------|---------|-----|
| `q` | all | 255 chars |
| `limit` | 10 | 20 |

---

### Notes Shared By Me

```http
GET /api/notes/shared-by-me
```

Lists notes the current user owns and has shared with others.

---

### Notes Shared With Me

```http
GET /api/notes/shared-with-me
```

Lists notes other users have shared with the current user.

**Response:** `{ "notes": [...] }`

---

### Share a Note

```http
POST /api/notes/:id/shares
```

**Body:**
```json
{
  "usernameOrEmail": "alice",
  "permission": "VIEW"
}
```

`permission`: `"VIEW"` (default) or `"EDIT"`.

**Response:** `201 Created`
```json
{
  "message": "Note shared successfully",
  "share": { "id": "uuid", "noteId": "uuid", "userId": "uuid", "permission": "VIEW", "createdAt": "..." }
}
```

**Errors:** `404` if note or target user not found, `400` if trying to share with yourself.

---

### List Shares for a Note

```http
GET /api/notes/:id/shares
```

Owner only. Lists all active shares for a given note.

**Response:** `{ "shares": [...] }`

---

### Update Share Permission

```http
PATCH /api/notes/:id/shares/:shareId
```

**Body:** `{ "permission": "EDIT" }`

---

### Remove Share

```http
DELETE /api/notes/:id/shares/:shareId
```

**Response:** `{ "message": "Share removed" }`

---

## Notifications

All routes require `Authorization: Bearer {token}`.

### List Notifications

```http
GET /api/notifications?limit={n}&offset={n}&unreadOnly={bool}
```

| Param | Default |
|-------|---------|
| `limit` | 50 (max 100) |
| `offset` | 0 |
| `unreadOnly` | false |

---

### Get Unread Count

```http
GET /api/notifications/unread-count
```

**Response:** `{ "count": 3 }`

---

### Mark Notification as Read

```http
PATCH /api/notifications/:id/read
```

**Response:** `{ "message": "Notification marked as read", "notification": { ... } }`

---

### Mark All Notifications as Read

```http
POST /api/notifications/mark-all-read
```

**Response:** `{ "message": "All notifications marked as read", "count": 5 }`

---

### Delete Notification

```http
DELETE /api/notifications/:id
```

**Response:** `{ "message": "Notification deleted" }`

---

## Feedback

All routes require `Authorization: Bearer {token}`.

### Submit Feedback

```http
POST /api/feedback
```

Rate limited: 10 submissions per hour per user.

**Body:**
```json
{
  "type": "BUG",
  "title": "Short title",
  "description": "Detailed description of the issue",
  "category": "editor",
  "priority": "helpful"
}
```

- `type`: `"BUG"` or `"FEATURE"`
- `category`: `ui`, `editor`, `ai`, `organization`, `other`
- `priority`: `nice-to-have`, `helpful`, `critical`

**Response:** `201 Created` `{ "message": "Feedback submitted successfully", "feedback": { ... } }`

---

### My Feedback

```http
GET /api/feedback/mine?limit={n}&offset={n}
```

Returns the current user's own submissions.

---

### Get Feedback

```http
GET /api/feedback/:id
```

Users can only view their own feedback.

---

## AI

All routes require `Authorization: Bearer {token}`. Prefix: `/api/ai`.

### Get AI Settings

```http
GET /api/ai/settings
```

Returns current provider/model config. API key is never returned.

**Response:**
```json
{ "configured": true, "provider": "anthropic", "model": "claude-3-5-haiku-20241022" }
```

---

### Save AI Settings

```http
PUT /api/ai/settings
```

Tests connection before saving. Replaces any existing config.

**Body:**
```json
{ "provider": "anthropic", "apiKey": "sk-ant-...", "model": "claude-3-5-haiku-20241022" }
```

`provider`: `anthropic`, `openai`, or `gemini`.

**Errors:** `400` if connection fails, `429` if AI provider rate-limits the test.

---

### Update Model Only

```http
PATCH /api/ai/settings
```

Updates just the model, reusing the stored API key.

**Body:** `{ "model": "claude-3-5-sonnet-20241022" }`

**Errors:** `400` if AI not yet configured.

---

### List Available Models (Using Stored Key)

```http
GET /api/ai/models
```

Returns models available for the user's configured provider using their saved API key.

**Response:** `{ "success": true, "models": ["model-id-1", "model-id-2"] }`

---

### Test Connection

```http
POST /api/ai/test-connection
```

**Body:** Same as Save AI Settings (provider + apiKey + optional model).

**Response:** `{ "success": true, "message": "Connection successful" }`

---

### List Models (Using Provided Key)

```http
POST /api/ai/list-models
```

Like `GET /api/ai/models` but uses credentials from the request body instead of the stored key. Used during initial setup.

**Body:** Same as Save AI Settings.

---

### Summarize Content

```http
POST /api/ai/summarize
```

**Body:**
```json
{ "content": "Long note content...", "maxLength": 200 }
```

`content`: 1–50,000 chars. `maxLength`: 10–1000 (default 100).

**Response:** `{ "summary": "Brief summary..." }`

---

### Suggest Title

```http
POST /api/ai/suggest-title
```

**Body:**
```json
{ "content": "Note content...", "maxLength": 60 }
```

`maxLength`: 10–100 (default 60).

**Response:** `{ "title": "Suggested Title" }`

---

### Suggest Tags

```http
POST /api/ai/suggest-tags
```

**Body:**
```json
{ "content": "Note content...", "maxTags": 5 }
```

`maxTags`: 1–20 (default 5). Uses the user's existing tags as context.

**Response:** `{ "tags": ["tag1", "tag2", "tag3"] }`

---

## API Tokens (User Self-Service)

Users manage their own API tokens for service account / MCP access.
All routes require `Authorization: Bearer {token}`.

### List Tokens

```http
GET /api/tokens
```

Returns all tokens for the authenticated user (API keys are not returned, only metadata).

---

### Create Token

```http
POST /api/tokens
```

**Body:**
```json
{
  "name": "My MCP Token",
  "scopes": ["read", "write"],
  "expiresIn": "90d"
}
```

- `scopes`: array containing `"read"` and/or `"write"` (at least one required)
- `expiresIn`: `"30d"`, `"90d"`, `"1y"`, or `null` (never expires)

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "name": "My MCP Token",
  "prefix": "ntez_",
  "scopes": ["read", "write"],
  "expiresAt": "2025-06-01T00:00:00Z",
  "createdAt": "...",
  "rawToken": "ntez_...",
  "message": "Store this token securely — it cannot be retrieved again."
}
```

⚠️ `rawToken` is only returned once at creation time.

---

### Revoke Token

```http
DELETE /api/tokens/:id
```

---

## Collaboration (WebSocket)

```
WS /api/collaboration/:noteId
```

WebSocket endpoint for real-time collaborative editing (Hocuspocus / Yjs). Auth is handled via the Hocuspocus protocol (JWT token sent by client in the WebSocket handshake payload) — browsers cannot send `Authorization` headers on WebSocket upgrades.

Close codes:
- `1008 Policy Violation` — invalid `noteId` format
- `1011 Unexpected Condition` — server error

---

## Admin — Users

All routes require `Authorization: Bearer {token}` with `role: "admin"`.

### List Users

```http
GET /api/users?includeInactive=true
```

**Response:** `{ "users": [...], "total": 5 }`

---

### Get User Statistics

```http
GET /api/users/stats
```

---

### Get System Info

```http
GET /api/system/info
```

Returns system-level information (version, uptime, etc.).

---

### Get User

```http
GET /api/users/:id
```

---

### Create User

```http
POST /api/users
```

**Body (regular user):**
```json
{
  "username": "alice",
  "email": "alice@example.com",
  "password": "TempPass123!",
  "role": "user"
}
```

**Body (service account):**
```json
{
  "username": "claude-agent",
  "isServiceAccount": true,
  "role": "user",
  "tokenName": "Default Token",
  "tokenScopes": ["read", "write"],
  "tokenExpiresIn": "1y"
}
```

Service accounts: no password or email required; an API token is auto-generated and returned once.

**Response (regular user):** `201 Created` `{ "message": "...", "user": { ... } }`

**Response (service account):** `201 Created`
```json
{
  "message": "Service account created successfully. Store the API token securely — it cannot be retrieved again.",
  "user": { ... },
  "apiToken": "ntez_..."
}
```

**Errors:** `409` if username already taken.

---

### Update User

```http
PATCH /api/users/:id
```

**Body:** `{ "isActive": true, "mustChangePassword": false, "role": "admin" }` (all optional)

---

### Delete User (Soft Deactivate)

```http
DELETE /api/users/:id
```

Deactivates the user; does not destroy their data.

**Errors:** `400` if trying to delete yourself.

---

### Reset User Password (Admin)

```http
POST /api/users/:id/reset-password
```

**Body:** `{ "newPassword": "TempPass456!" }`

Sets `mustChangePassword: true` on the user.

---

## Admin — Service Accounts

All routes require `Authorization: Bearer {token}` with `role: "admin"`.

### List Service Accounts

```http
GET /api/admin/service-accounts
```

**Response:** `{ "serviceAccounts": [...] }`

---

### List Service Account Notes

```http
GET /api/admin/service-accounts/notes?limit={n}&offset={n}
```

Paginated list of all notes belonging to service accounts.

---

### Get Service Account Note

```http
GET /api/admin/service-accounts/notes/:id
```

Read-only access to a specific note belonging to a service account.

**Errors:** `403` if note does not belong to a service account.

---

### List Service Account Tasks

```http
GET /api/admin/service-accounts/tasks?limit={n}&offset={n}
```

---

### List Tokens for Service Account

```http
GET /api/admin/service-accounts/:id/tokens
```

---

### Create Token for Service Account

```http
POST /api/admin/service-accounts/:id/tokens
```

**Body:** Same as user token creation (`name`, `scopes`, `expiresIn`).

**Response:** `201 Created`
```json
{
  "message": "Token created successfully. Store it securely — it cannot be retrieved again.",
  "token": { "id": "uuid", "name": "...", "prefix": "ntez_", "scopes": [...], "expiresAt": "...", "createdAt": "..." },
  "rawToken": "ntez_..."
}
```

---

### Revoke Token for Service Account

```http
DELETE /api/admin/service-accounts/:id/tokens/:tokenId
```

**Response:** `{ "message": "Token revoked successfully", "token": { ... } }`

---

## Admin — Feedback

All routes require `Authorization: Bearer {token}` with `role: "admin"`.

### List All Feedback

```http
GET /api/admin/feedback?type={BUG|FEATURE}&status={status}&category={cat}&limit={n}&offset={n}
```

- `status`: `NEW`, `REVIEWED`, `APPROVED`, `PUBLISHED`, `DECLINED`

---

### Get Feedback (Admin View)

```http
GET /api/admin/feedback/:id
```

---

### Update Feedback

```http
PATCH /api/admin/feedback/:id
```

**Body:** `{ "status": "APPROVED", "adminNotes": "Will ship in v1.15" }` (all optional)

---

### Delete Feedback

```http
DELETE /api/admin/feedback/:id
```

---

### Mark Feedback as Shipped

```http
POST /api/admin/feedback/:id/ship
```

Marks the feedback as a shipped user-requested feature.

---

### Unmark Feedback as Shipped

```http
DELETE /api/admin/feedback/:id/ship
```

---

### Get Feedback Statistics

```http
GET /api/admin/feedback/stats
```

---

## Admin — Notifications

Requires `Authorization: Bearer {token}` with `role: "admin"`.

### Send Release Notification to All Users

```http
POST /api/admin/notifications/release
```

**Body:**
```json
{
  "version": "1.15.0",
  "highlights": "Check out the new collaboration features!"
}
```

`highlights` is optional; defaults to a generic message.

**Response:** `{ "message": "Release notification sent", "count": 42 }`

---

## MCP API

Used by the `notez-mcp` stdio server. Authenticated via API token (`Authorization: Bearer ntez_{token}`). All routes are under `/api/mcp/`.

Rate limit: 120 requests/minute per token.

### Scopes

- **`read`** — GET operations
- **`write`** — POST, PATCH, PUT, DELETE operations

---

### Notes

| Method | Path | Scope | Description |
|--------|------|-------|-------------|
| `GET` | `/api/mcp/notes/search?q={query}&limit={n}` | read | Search notes by keyword |
| `GET` | `/api/mcp/notes/by-title?title={text}` | read | Get note by exact title (case-insensitive); includes `plainText` field |
| `GET` | `/api/mcp/notes/recent?limit={n}&offset={n}` | read | List recently modified notes |
| `GET` | `/api/mcp/notes?folderId={id}&tagId={id}&search={q}&limit={n}&offset={n}` | read | List notes with filters |
| `GET` | `/api/mcp/notes/:id` | read | Get note by ID; includes `plainText` field (HTML stripped) |
| `POST` | `/api/mcp/notes` | write | Create a note |
| `PATCH` | `/api/mcp/notes/:id` | write | Update note (title, content, folder, tags) |
| `PATCH` | `/api/mcp/notes/:id/append` | write | Append content to a note (max 50KB per call; note max 500KB) |
| `DELETE` | `/api/mcp/notes/:id` | write | Soft-delete note (to trash) |
| `POST` | `/api/mcp/notes/:id/restore` | write | Restore note from trash |

**Note:** `/api/mcp/notes/:id` GET responses include a `plainText` field with HTML stripped, for AI consumption.

**Create note body:**
```json
{ "title": "...", "content": "...", "folderId": "uuid", "tags": ["tag1"] }
```

**Update note body** (at least one field required):
```json
{ "title": "...", "content": "...", "folderId": "uuid | null", "tags": ["tag1"] }
```

**Append body:**
```json
{ "content": "<p>Additional content</p>" }
```

---

### Tasks

| Method | Path | Scope | Description |
|--------|------|-------|-------------|
| `GET` | `/api/mcp/tasks?status={s}&limit={n}` | read | List tasks (sorted by priority desc) |
| `GET` | `/api/mcp/tasks/:id` | read | Get task by ID |
| `POST` | `/api/mcp/tasks` | write | Create a task |
| `PATCH` | `/api/mcp/tasks/:id/status` | write | Update task status |
| `PATCH` | `/api/mcp/tasks/:id` | write | Update task (title, description, priority, dueDate, folder, tags) |
| `DELETE` | `/api/mcp/tasks/:id` | write | Delete a task |

**Create task body:**
```json
{ "title": "...", "description": "...", "priority": "MEDIUM", "dueDate": "2025-01-15T00:00:00Z", "folderId": "uuid", "tags": ["tag1"] }
```

---

### Folders

| Method | Path | Scope | Description |
|--------|------|-------|-------------|
| `GET` | `/api/mcp/folders` | read | List all folders |
| `POST` | `/api/mcp/folders` | write | Create a folder |
| `PATCH` | `/api/mcp/folders/:id` | write | Update/rename a folder |
| `DELETE` | `/api/mcp/folders/:id` | write | Delete a folder |

---

### Tags

| Method | Path | Scope | Description |
|--------|------|-------|-------------|
| `GET` | `/api/mcp/tags` | read | List all tags |
| `PATCH` | `/api/mcp/tags/:id` | write | Rename a tag |
| `DELETE` | `/api/mcp/tags/:id` | write | Delete a tag |

---

### Sharing (MCP)

| Method | Path | Scope | Description |
|--------|------|-------|-------------|
| `POST` | `/api/mcp/notes/:id/shares` | write | Share a note |
| `GET` | `/api/mcp/notes/:id/shares` | read | List shares for a note |
| `PATCH` | `/api/mcp/notes/:id/shares/:shareId` | write | Update share permission |
| `DELETE` | `/api/mcp/notes/:id/shares/:shareId` | write | Remove a share |
