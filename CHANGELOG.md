# Changelog

All notable changes to Notez will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/SpasticPalate/notez/compare/v0.30.1...HEAD
[0.30.1]: https://github.com/SpasticPalate/notez/compare/v0.30.0...v0.30.1
[0.30.0]: https://github.com/SpasticPalate/notez/compare/v0.29.1...v0.30.0
[0.29.1]: https://github.com/SpasticPalate/notez/compare/v0.29.0...v0.29.1
[0.29.0]: https://github.com/SpasticPalate/notez/compare/v0.28.3...v0.29.0
[0.28.3]: https://github.com/SpasticPalate/notez/compare/v0.28.2...v0.28.3
[0.28.2]: https://github.com/SpasticPalate/notez/compare/v0.28.1...v0.28.2
[0.28.1]: https://github.com/SpasticPalate/notez/compare/v0.28.0...v0.28.1
[0.28.0]: https://github.com/SpasticPalate/notez/compare/v0.27.0...v0.28.0
[0.27.0]: https://github.com/SpasticPalate/notez/releases/tag/v0.27.0
