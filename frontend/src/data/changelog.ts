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
