// Changelog data for What's New modal
// This is a simplified representation of CHANGELOG.md for UI display

export interface ChangelogEntry {
  version: string;
  date: string;
  added?: string[];
  fixed?: string[];
  changed?: string[];
  removed?: string[];
}

export const changelog: ChangelogEntry[] = [
  {
    version: '1.0.1',
    date: '2025-12-23',
    added: [
      'User Notifications: Get notified when your feedback status changes (reviewed, approved, etc.)',
      'Release Notifications: All users receive notifications about new app versions',
    ],
    changed: [
      'Notification Bell: Now visible for all users (not just admins)',
    ],
  },
  {
    version: '1.0.0',
    date: '2025-12-22',
    added: [
      'User Feedback System: Submit bug reports and feature requests directly in the app',
      'Admin Feedback Panel: Dashboard with stats, status workflow, admin notes with auto-save',
      'Admin Notifications: Bell icon with unread count, click to navigate to feedback items',
      'Wiki-Links Backlinks System: Find all notes that reference a given note',
      'Load Testing Infrastructure: k6-based load testing for performance validation',
    ],
    fixed: [
      'Session Refresh Race Condition: Fixed error when multiple tabs refresh tokens simultaneously',
      'Settings Navigation: Changed from hash-based to route-based navigation',
      'Infinite Reload Loop: Fixed Settings page reload issue',
    ],
  },
  {
    version: '1.0.0-rc.1',
    date: '2025-12-02',
    added: [
      'MVP Feature Complete! All core features implemented and ready for validation',
      'Self-Service Password Reset: Forgot password flow with email-based reset tokens',
      'Unified Settings Hub: Profile, AI Settings, and Admin Panel in one place with sidebar navigation',
      'Shared App Header: Consistent header with logo, search, theme toggle, and user dropdown',
      'User Avatar Dropdown: Quick access to Profile, Settings, Admin Panel, and Logout',
      'Enhanced Collapsed Sidebar: Folder/tag icons with hover popovers showing name and count',
      'Styled Confirm Dialogs: Themed React dialogs replace native browser confirms',
      'Sidebar State Persistence: Collapsed/expanded state saved to localStorage',
    ],
    changed: [
      'Trash moved to bottom of folder sidebar in both views',
      'Settings navigation uses URL hash for sections',
    ],
    fixed: [
      'Trash folder 400 error in collapsed sidebar',
      'Folder icon picker overflow when editing folders',
    ],
  },
  {
    version: '0.32.0',
    date: '2025-12-02',
    added: [
      'User Avatar Upload: Upload, change, or delete profile avatars',
      'Dynamic AI Model Fetching: Models now fetched from AI providers instead of static lists',
      'Model Deprecation Handling: Graceful fallback when AI models are deprecated',
      'Profile Settings Tab: New Profile section with user info and avatar management',
    ],
    fixed: [
      'AI Config Bug: Can now change AI model without re-entering API key',
      'Model selection persists correctly after configuration changes',
    ],
  },
  {
    version: '0.31.0',
    date: '2024-12-01',
    added: [
      'Image Support: Paste, drag-drop, or upload images directly into notes',
      'MinIO Storage: S3-compatible object storage for scalable image hosting',
      '10 New Tech/Homelab Icons: server, cpu, hard-drive, network, wifi, database, cloud, monitor, laptop, smartphone',
    ],
    changed: [
      'Docker compose now includes MinIO service for image storage',
      'Images automatically optimized (resize, compress) on upload',
    ],
  },
  {
    version: '0.30.2',
    date: '2024-11-30',
    added: [
      'Folder Chip UI: Modern chip-style folder selector with icons in note editor',
      '10 New Folder Icons: palette, paintbrush, pencil, pen, pen-tool, flower, drama, coffee, utensils, gift',
    ],
    fixed: [
      'Folder counts not updating when moving notes via editor dropdown',
      'Tag counts not refreshing after adding/removing tags from notes',
      'Folder icons now display in folder selector dropdown',
    ],
  },
  {
    version: '0.30.1',
    date: '2024-11-30',
    fixed: [
      'Folders not loading after v0.30.0 update (missing database migration for icon column)',
    ],
  },
  {
    version: '0.30.0',
    date: '2024-11-30',
    added: [
      'Folder Icons: Customize folder appearance with 27 different icons',
      'What\'s New Modal: Click version number to see release notes and update history',
      'Version Badge: "NEW" indicator shows when app has been updated',
    ],
    fixed: [
      'Folder sidebar layout improvements for narrow widths',
      'Edit mode button overflow in sidebar items',
    ],
  },
  {
    version: '0.29.1',
    date: '2024-11-29',
    fixed: [
      'TipTap editor scroll issue with absolute positioning',
      'Focus visibility improvements for accessibility',
    ],
  },
  {
    version: '0.29.0',
    date: '2024-11-28',
    added: [
      'Task Management System: Full todo/task support with note integration',
      'Task import from existing notes with automatic parsing',
      'Task scanning to detect actionable items in notes',
    ],
    fixed: [
      'API type mismatches between scan and import endpoints',
      'TypeScript build errors with Set type inference',
    ],
  },
  {
    version: '0.28.3',
    date: '2024-11-27',
    added: [
      'Tiptap rich text editor with comprehensive markdown support',
      'Note organization improvements with drag-and-drop',
    ],
    fixed: [
      'Mobile bottom navigation visibility',
      'Mobile responsiveness for large devices (Pixel Fold)',
      'Drag-and-drop security improvements',
      'Note editor layout issues',
    ],
  },
  {
    version: '0.28.2',
    date: '2024-11-26',
    fixed: [
      'Docker build now correctly injects version from package.json',
      'Version display in UI shows correct build version',
    ],
  },
  {
    version: '0.28.1',
    date: '2024-11-25',
    added: [
      'Trash/soft delete system for notes',
      'Unfiled notes indicator in sidebar',
    ],
    fixed: [
      'Critical production authentication issues',
      'Cookie handling behind reverse proxy (Cloudflare Tunnel)',
    ],
  },
  {
    version: '0.28.0',
    date: '2024-11-24',
    added: [
      'AI-powered tag suggestions that prefer existing tags',
      'Improved tag suggestion scalability (limited to 50 most recent)',
    ],
    fixed: [
      'Frontend data refresh issues',
      'API base URL for production deployment',
      'Prisma migrations included in version control',
    ],
  },
  {
    version: '0.27.0',
    date: '2024-11-23',
    added: [
      'Initial public release',
      'Note creation and editing with markdown support',
      'Folder organization system',
      'Tag management',
      'AI-powered features (summarization, tag suggestions)',
      'Dark mode support',
      'Docker deployment support',
      'Multi-user authentication',
    ],
  },
];

export function getCurrentVersion(): string {
  return changelog[0]?.version || '0.0.0';
}

export function getLatestChangelog(): ChangelogEntry | undefined {
  return changelog[0];
}
