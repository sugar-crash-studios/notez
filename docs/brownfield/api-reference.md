# Notez API Reference

> Auto-generated from codebase analysis
> Generated: 2025-11-29

## Base URL

- **Development:** `http://localhost:3000`
- **Production:** Same origin (frontend served by backend)

## Authentication

All endpoints except `/api/auth/setup-needed`, `/api/auth/setup`, `/api/auth/login`, `/api/auth/refresh`, and `/health` require authentication.

### Headers

```
Authorization: Bearer {access_token}
Content-Type: application/json
```

### Cookies

- `refreshToken` - HttpOnly, Signed, SameSite=Strict (7 days)

---

## Auth Endpoints

### Check Setup Status

```http
GET /api/auth/setup-needed
```

**Response:**
```json
{
  "setupNeeded": true
}
```

### Initial Setup (First Admin)

```http
POST /api/auth/setup
```

**Body:**
```json
{
  "username": "admin",
  "email": "admin@example.com",
  "password": "SecurePassword123"
}
```

**Response:** `200 OK`
```json
{
  "message": "Setup completed successfully",
  "user": {
    "userId": "uuid",
    "username": "admin",
    "role": "admin"
  },
  "accessToken": "jwt_token"
}
```

### Login

```http
POST /api/auth/login
```

**Body:**
```json
{
  "usernameOrEmail": "admin",
  "password": "SecurePassword123"
}
```

**Response:** `200 OK`
```json
{
  "message": "Login successful",
  "user": {
    "userId": "uuid",
    "username": "admin",
    "role": "admin",
    "mustChangePassword": false
  },
  "accessToken": "jwt_token"
}
```

### Refresh Token

```http
POST /api/auth/refresh
```

**Response:** `200 OK`
```json
{
  "message": "Token refreshed successfully",
  "user": { ... },
  "accessToken": "new_jwt_token"
}
```

### Logout

```http
POST /api/auth/logout
Authorization: Bearer {token}
```

**Response:** `200 OK`
```json
{
  "message": "Logout successful"
}
```

### Change Password

```http
POST /api/auth/change-password
Authorization: Bearer {token}
```

**Body:**
```json
{
  "currentPassword": "OldPassword123",
  "newPassword": "NewPassword456"
}
```

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
    "role": "admin"
  }
}
```

---

## Notes Endpoints

### List Notes

```http
GET /api/notes?folderId={id}&tagId={id}&search={query}&limit={n}&offset={n}
```

**Query Parameters:**
- `folderId` - Filter by folder (use `null` for unfiled)
- `tagId` - Filter by tag
- `search` - Search query
- `limit` - Results per page (default: 50)
- `offset` - Pagination offset

**Response:**
```json
{
  "notes": [
    {
      "id": "uuid",
      "title": "Note Title",
      "content": "Note content...",
      "folderId": "uuid | null",
      "createdAt": "2025-01-01T00:00:00Z",
      "updatedAt": "2025-01-01T00:00:00Z",
      "tags": [{ "id": "uuid", "name": "tag1" }]
    }
  ],
  "total": 100
}
```

### Get Note

```http
GET /api/notes/{id}
```

**Response:**
```json
{
  "note": {
    "id": "uuid",
    "title": "Note Title",
    "content": "Full note content...",
    "folderId": "uuid | null",
    "createdAt": "...",
    "updatedAt": "...",
    "tags": [...]
  }
}
```

### Create Note

```http
POST /api/notes
```

**Body:**
```json
{
  "title": "New Note",
  "content": "Note content",
  "folderId": "uuid | null",
  "tags": ["tag1", "tag2"]
}
```

**Response:** `201 Created`
```json
{
  "message": "Note created successfully",
  "note": { ... }
}
```

### Update Note

```http
PATCH /api/notes/{id}
```

**Body:**
```json
{
  "title": "Updated Title",
  "content": "Updated content",
  "folderId": "uuid | null",
  "tags": ["tag1", "tag3"]
}
```

### Delete Note (Soft Delete)

```http
DELETE /api/notes/{id}
```

**Response:**
```json
{
  "message": "Note moved to trash"
}
```

### List Trash

```http
GET /api/notes/trash
```

### Restore Note

```http
POST /api/notes/{id}/restore
```

### Permanent Delete

```http
DELETE /api/notes/{id}/permanent
```

### Note Statistics

```http
GET /api/notes/stats
```

---

## Folders Endpoints

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
      "createdAt": "...",
      "updatedAt": "...",
      "_count": { "notes": 10 }
    }
  ]
}
```

### Create Folder

```http
POST /api/folders
```

**Body:**
```json
{
  "name": "New Folder"
}
```

### Update Folder

```http
PATCH /api/folders/{id}
```

**Body:**
```json
{
  "name": "Renamed Folder"
}
```

### Delete Folder

```http
DELETE /api/folders/{id}
```

---

## Tags Endpoints

### List Tags

```http
GET /api/tags
```

### Search Tags

```http
GET /api/tags/search?q={query}&limit={n}
```

### Rename Tag

```http
PATCH /api/tags/{id}
```

**Body:**
```json
{
  "name": "new-tag-name"
}
```

### Delete Tag

```http
DELETE /api/tags/{id}
```

---

## Tasks Endpoints

### List Tasks

```http
GET /api/tasks?status={status}&priority={priority}&folderId={id}&noteId={id}&overdue={bool}
```

**Query Parameters:**
- `status` - PENDING, IN_PROGRESS, COMPLETED, CANCELLED (can be array)
- `priority` - LOW, MEDIUM, HIGH, URGENT
- `folderId` - Filter by folder
- `noteId` - Filter by linked note
- `overdue` - Filter overdue tasks
- `limit`, `offset` - Pagination

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
      "noteTitle": "Linked Note Title",
      "folderId": "uuid | null",
      "tags": [...]
    }
  ],
  "total": 50
}
```

### Create Task

```http
POST /api/tasks
```

**Body:**
```json
{
  "title": "New Task",
  "description": "Task description",
  "status": "PENDING",
  "priority": "MEDIUM",
  "dueDate": "2025-01-15",
  "noteId": "uuid | null",
  "folderId": "uuid | null",
  "tags": ["tag1"]
}
```

### Update Task

```http
PUT /api/tasks/{id}
```

### Update Status Only

```http
PATCH /api/tasks/{id}/status
```

**Body:**
```json
{
  "status": "COMPLETED"
}
```

### Delete Task

```http
DELETE /api/tasks/{id}
```

### Scan Notes for Tasks

```http
POST /api/tasks/scan
```

**Body:**
```json
{
  "folderId": "uuid | null",
  "noteIds": ["uuid1", "uuid2"]
}
```

**Response:**
```json
{
  "tasks": [
    {
      "noteId": "uuid",
      "noteTitle": "Note Title",
      "title": "[ ] Task from note",
      "checked": false
    }
  ],
  "count": 5
}
```

### Import Tasks from Notes

```http
POST /api/tasks/import
```

**Body:**
```json
{
  "tasks": [
    {
      "noteId": "uuid",
      "noteTitle": "Note Title",
      "title": "Task title",
      "checked": false,
      "folderId": "uuid | null"
    }
  ]
}
```

---

## AI Endpoints

### Get AI Settings

```http
GET /api/ai/settings
```

**Response:**
```json
{
  "configured": true,
  "provider": "anthropic",
  "model": "claude-3-sonnet-20240229"
}
```

### Save AI Settings

```http
PUT /api/ai/settings
```

**Body:**
```json
{
  "provider": "anthropic",
  "apiKey": "sk-ant-...",
  "model": "claude-3-sonnet-20240229"
}
```

### Test Connection

```http
POST /api/ai/test-connection
```

**Body:** Same as Save AI Settings

### List Available Models

```http
POST /api/ai/list-models
```

**Body:** Same as Save AI Settings

### Summarize Content

```http
POST /api/ai/summarize
```

**Body:**
```json
{
  "content": "Long note content to summarize...",
  "maxLength": 200
}
```

**Response:**
```json
{
  "summary": "Concise summary of the content..."
}
```

### Suggest Title

```http
POST /api/ai/suggest-title
```

**Body:**
```json
{
  "content": "Note content...",
  "maxLength": 60
}
```

**Response:**
```json
{
  "title": "Suggested Title"
}
```

### Suggest Tags

```http
POST /api/ai/suggest-tags
```

**Body:**
```json
{
  "content": "Note content...",
  "maxTags": 5
}
```

**Response:**
```json
{
  "tags": ["tag1", "tag2", "tag3"]
}
```

---

## Search Endpoint

### Full-Text Search

```http
GET /api/search?q={query}&folderId={id}&limit={n}&offset={n}
```

**Response:**
```json
{
  "results": [
    {
      "id": "uuid",
      "title": "Note Title",
      "snippet": "...matching **content** with highlighting...",
      "folderId": "uuid",
      "folderName": "Work",
      "rank": 0.95
    }
  ],
  "total": 25
}
```

---

## Users Endpoints (Admin Only)

### List Users

```http
GET /api/users?includeInactive=true
```

### Create User

```http
POST /api/users
```

**Body:**
```json
{
  "username": "newuser",
  "email": "user@example.com",
  "password": "TempPassword123",
  "role": "user"
}
```

### Update User

```http
PATCH /api/users/{id}
```

### Reset User Password

```http
POST /api/users/{id}/reset-password
```

**Body:**
```json
{
  "newPassword": "NewTempPassword"
}
```

### Delete User

```http
DELETE /api/users/{id}
```

---

## Health Check

```http
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "database": "connected"
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Error Type",
  "message": "Human-readable error message"
}
```

### Common Status Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Invalid/missing token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 409 | Conflict - Resource already exists |
| 429 | Too Many Requests - Rate limited |
| 500 | Internal Server Error |
| 503 | Service Unavailable - External service down |
