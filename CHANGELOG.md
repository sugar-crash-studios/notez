# Changelog

All notable changes to Notez will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.1] - 2025-12-23

**User Notifications Expansion**

Extending the notification system to all users, not just admins. Users now receive notifications when their feedback status changes, and admins can send release notifications to announce new versions.

### Added

- **Feedback Status Notifications**: Users receive notifications when their bug report or feature request status changes (reviewed, approved, declined, published)
- **Release Notifications**: Admin endpoint to send new version announcements to all users
- **User-Facing Notification Bell**: All users now see the notification bell (previously admin-only)

### Changed

- Notification types updated: `NEW_FEEDBACK` (admin), `FEEDBACK_STATUS_CHANGE` (user), `NEW_RELEASE` (all users)

### Technical

- New `notifyUser()` and `notifyAllUsers()` functions in notification service
- New admin endpoint `POST /api/admin/notifications/release` for sending release notifications
- Updated `NotificationBell` component with new notification type icons

## [1.0.0] - 2025-12-22

**First Stable Release - User Feedback System & Phase 2 Features**

Notez reaches v1.0.0 with the addition of a comprehensive in-app feedback system, completing the core feature set. Users can now submit bug reports and feature requests directly within the app, with full admin tools to manage and track submissions.

### Added

- **User Feedback System**: Complete bug report and feature request submission system
  - Users can submit bugs or feature requests via modal accessible from user menu
  - Optional category selection (UI/UX, Editor, AI Features, Organization, Other)
  - Optional priority levels (Nice to Have, Helpful, Critical)
  - Rate limited to 10 submissions per hour per user
- **Admin Feedback Panel**: New Settings section for admins to manage feedback
  - Dashboard with stats cards (Total, Awaiting Review, Bugs, Features)
  - Clickable stats to filter submissions
  - Status workflow: New → Reviewed → Approved/Declined → Published
  - Admin notes with auto-save
  - "Mark as Shipped" functionality for completed features
  - Bulk filtering by type, status, and category
- **Admin Notifications**: Bell icon with unread count in header
  - Real-time notification when new feedback is submitted
  - Click notification to navigate directly to feedback item
  - Mark as read on click, mark all read option
- **Wiki-Links Backlinks System**: Find all notes that reference a given note
- **Load Testing Infrastructure**: k6-based load testing for performance validation

### Fixed

- **Session Refresh Race Condition**: Fixed Prisma error when multiple tabs refresh tokens simultaneously
- **Settings Navigation**: Changed from hash-based (`#section`) to route-based (`/settings/section`) navigation
- **Infinite Reload Loop**: Fixed Settings page reload issue caused by hash-based navigation

### Technical

- New `FeedbackSubmission` and `Notification` database models
- New `/api/feedback/*` endpoints for user submissions
- New `/api/admin/feedback/*` endpoints for admin management
- New `/api/notifications/*` endpoints for notification system
- Debounced auto-save for admin notes (1 second delay)
- TanStack Query mutations with proper cache invalidation

## [1.0.0-rc.2] - 2025-12-03

**Security Hardening Release**

Comprehensive security audit and hardening based on Qodo AI code review. This release addresses all identified security concerns and adds defense-in-depth measures across the application.

### Security

- **SQL Injection Prevention**: Replaced `$queryRawUnsafe` with parameterized `$queryRaw` using Prisma tagged template literals
- **Image Content Validation**: Added Sharp-based image parsing to prevent content-type spoofing attacks
- **Rate Limiting**: Added global rate limiting (100 req/min) with stricter limits on auth endpoints (5 req/15min)
- **Brute Force Protection**: Auth endpoints keyed by IP + username/email to prevent credential stuffing
- **Session Invalidation**: Logout now invalidates JWT by setting expiration in the past
- **Security Headers**: Added `X-Content-Type-Options: nosniff` to all image responses
- **File Size Limits**: Enforced server-side limits (10MB images, 5MB avatars)
- **Password Reset Protection**: Rate limited to 3 attempts per IP per 15 minutes

### Fixed

- Console warnings for form accessibility (missing `name` attributes)
- Duplicate CSS custom properties causing console noise
- TypeScript scope issues in catch blocks for structured logging

### Changed

- Collapsed sidebar now shows only folder icons (removed tag icons - all identical)
- Limited folder icons to 8 in collapsed mode with overflow indicator
- Overflow indicator expands sidebar when clicked

### Technical

- New `validateImageContent()` utility using Sharp for content validation
- New `ALLOWED_IMAGE_MIME_TYPES` constant for consistent validation
- Added `@fastify/rate-limit` plugin with custom error responses
- Improved logging in image upload/retrieval routes

## [1.0.0-rc.1] - 2025-12-02

**MVP Feature Complete - Release Candidate**

This release marks MVP completion per the original specification. All core features are implemented and the application is entering the validation phase for stability, security, and production readiness.

### Added

- **Self-Service Password Reset**: Forgot password flow with email-based reset tokens via Resend
- **Unified Settings Hub**: Consolidated Profile, AI Settings, and Admin Panel into single page with sidebar navigation
- **Shared App Header**: Consistent header with logo, search, theme toggle, and user dropdown across all pages
- **User Avatar Dropdown**: Click avatar to access Profile, Settings, Admin Panel (if admin), and Logout
- **Enhanced Collapsed Sidebar**: Folder/tag icons with hover popovers showing name and note count
- **Styled Confirm Dialogs**: Replaced native browser confirm() with themed React dialogs
- **Sidebar State Persistence**: Collapsed/expanded state saved to localStorage

### Changed

- Settings navigation uses URL hash for sections (`/settings#profile`, `/settings#ai`, `/settings#admin`)
- Trash moved to bottom of folder sidebar in both expanded and collapsed views
- Legacy routes `/profile` and `/admin` redirect to Settings Hub sections

### Fixed

- Trash folder 400 error when clicking trash icon in collapsed sidebar
- Folder icon picker overflow when editing folders (reduced width from 256px to 224px)

### Technical

- New `AppHeader` component for shared navigation
- New `SettingsHub` page with section-based routing
- New `AdminPanel` component extracted for reuse
- New `UserDropdown` component with avatar and menu
- New `ConfirmDialog` component with `ConfirmProvider` context
- Password reset tokens stored in database with 1-hour expiration
- Resend email integration for transactional emails

### MVP Status

All success criteria from the MVP specification have been met:
- ✅ Deploy to server via Docker
- ✅ Create admin account on first boot
- ✅ Login as admin or regular user
- ✅ Create, edit, delete notes with auto-save
- ✅ Organize notes in folders
- ✅ Tag notes
- ✅ Search notes
- ✅ AI summarize, suggest titles, suggest tags
- ✅ Create new users as admin
- ✅ Secure (JWT, encrypted secrets)
- ✅ CI/CD pipeline builds and pushes to ghcr.io

## [0.32.0] - 2025-12-02

### Added

- **User Avatar Upload**: Upload, change, or delete profile avatars (JPEG, PNG, GIF, WebP up to 5MB)
- **Dynamic AI Model Fetching**: Models now fetched from AI providers instead of static hardcoded lists
- **Model Deprecation Handling**: Graceful fallback when AI models are deprecated or removed
- **Profile Settings Tab**: New Profile section in Settings with user info and avatar management
- **PATCH Endpoint for AI Model**: Change AI model without re-entering API key

### Fixed

- **AI Config Bug**: Users can now change AI model without re-entering their API key
- Model selection persists correctly after configuration changes

### Technical

- Added `avatarUrl` field to User model with database migration
- New `/api/profile/*` endpoints for profile and avatar management
- Avatar images resized to 256x256 and stored as JPEG in MinIO
- Added `AIModelNotFoundError` for provider-specific error handling

## [0.31.1] - 2025-01-02

### Added

- **Image Upload Button**: Manual upload button in editor toolbar for adding images
- **Inline Image Resizing**: Drag handles to resize images directly in the editor
- Image width persists in markdown format for consistent rendering

### Security

- Fixed XSS vulnerability in image title attribute processing
- Added client-side file validation (10MB size limit, MIME type checking)
- Added URL protocol sanitization to block javascript: and other dangerous URLs
- Added HTML tag stripping for image alt/title attributes

## [0.31.0] - 2024-12-01

### Added

- **Image Support**: Paste, drag-drop, or upload images directly into notes
- **MinIO Storage Integration**: S3-compatible object storage for scalable image hosting
- **10 New Tech/Homelab Icons**: server, cpu, hard-drive, network, wifi, database, cloud, monitor, laptop, smartphone

### Changed

- Docker compose now includes MinIO service for image storage
- Images automatically optimized (resize, compress) on upload

### Technical

- Added `@tiptap/extension-image` for editor image support
- Added `@fastify/multipart` for file uploads
- New `Image` model in database schema for tracking image metadata

## [0.30.2] - 2024-11-30

### Added
- **Folder Chip UI**: Modern chip-style folder selector with icons in note editor
- **10 New Folder Icons**: palette, paintbrush, pencil, pen, pen-tool, flower, drama, coffee, utensils, gift

### Fixed
- Folder counts not updating when moving notes via editor dropdown
- Tag counts not refreshing after adding/removing tags from notes
- Folder icons now display in folder selector dropdown

## [0.30.1] - 2024-11-30

### Fixed
- Folders not loading after v0.30.0 update (missing database migration for icon column)

## [0.30.0] - 2024-11-30

### Added
- **Folder Icons**: Customize folder appearance with 27 different icons
- **What's New Modal**: Click version number to see release notes and update history
- **Version Badge**: "NEW" indicator shows when app has been updated

### Fixed
- Folder sidebar layout improvements for narrow widths
- Edit mode button overflow in sidebar items

## [0.29.1] - 2024-11-29

### Fixed
- TipTap editor scroll issue with absolute positioning
- Focus visibility improvements for accessibility

## [0.29.0] - 2024-11-28

### Added
- **Task Management System**: Full todo/task support with note integration
- Task import from existing notes with automatic parsing
- Task scanning to detect actionable items in notes

### Fixed
- API type mismatches between scan and import endpoints
- TypeScript build errors with Set type inference

## [0.28.3] - 2024-11-27

### Added
- Tiptap rich text editor with comprehensive markdown support
- Note organization improvements with drag-and-drop

### Fixed
- Mobile bottom navigation visibility
- Mobile responsiveness for large devices (Pixel Fold)
- Drag-and-drop security improvements
- Note editor layout issues

## [0.28.2] - 2024-11-26

### Fixed
- Docker build now correctly injects version from package.json
- Version display in UI shows correct build version

## [0.28.1] - 2024-11-25

### Fixed
- Critical production authentication issues
- Cookie handling behind reverse proxy (Cloudflare Tunnel)

### Added
- Trash/soft delete system for notes
- Unfiled notes indicator in sidebar

## [0.28.0] - 2024-11-24

### Added
- AI-powered tag suggestions that prefer existing tags
- Improved tag suggestion scalability (limited to 50 most recent)

### Fixed
- Frontend data refresh issues
- API base URL for production deployment
- Prisma migrations included in version control

## [0.27.0] - 2024-11-23

### Added
- Initial public release
- Note creation and editing with markdown support
- Folder organization system
- Tag management
- AI-powered features (summarization, tag suggestions)
- Dark mode support
- Docker deployment support
- Multi-user authentication

[Unreleased]: https://github.com/SpasticPalate/notez/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/SpasticPalate/notez/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/SpasticPalate/notez/compare/v1.0.0-rc.2...v1.0.0
[1.0.0-rc.2]: https://github.com/SpasticPalate/notez/compare/v1.0.0-rc.1...v1.0.0-rc.2
[1.0.0-rc.1]: https://github.com/SpasticPalate/notez/compare/v0.32.0...v1.0.0-rc.1
[0.32.0]: https://github.com/SpasticPalate/notez/compare/v0.31.1...v0.32.0
[0.31.1]: https://github.com/SpasticPalate/notez/compare/v0.31.0...v0.31.1
[0.31.0]: https://github.com/SpasticPalate/notez/compare/v0.30.1...v0.31.0
[0.30.1]: https://github.com/SpasticPalate/notez/compare/v0.30.0...v0.30.1
[0.30.0]: https://github.com/SpasticPalate/notez/compare/v0.29.1...v0.30.0
[0.29.1]: https://github.com/SpasticPalate/notez/compare/v0.29.0...v0.29.1
[0.29.0]: https://github.com/SpasticPalate/notez/compare/v0.28.3...v0.29.0
[0.28.3]: https://github.com/SpasticPalate/notez/compare/v0.28.2...v0.28.3
[0.28.2]: https://github.com/SpasticPalate/notez/compare/v0.28.1...v0.28.2
[0.28.1]: https://github.com/SpasticPalate/notez/compare/v0.28.0...v0.28.1
[0.28.0]: https://github.com/SpasticPalate/notez/compare/v0.27.0...v0.28.0
[0.27.0]: https://github.com/SpasticPalate/notez/releases/tag/v0.27.0
