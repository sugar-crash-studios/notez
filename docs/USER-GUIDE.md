# Notez User Guide

**Version 1.0** | Self-Hosted Note-Taking Application

Welcome to Notez! This guide will help you get started and make the most of your note-taking experience.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Authentication & User Management](#authentication--user-management)
3. [Creating & Managing Notes](#creating--managing-notes)
4. [Organizing with Folders](#organizing-with-folders)
5. [Using Tags](#using-tags)
6. [Searching Your Notes](#searching-your-notes)
7. [AI-Powered Features](#ai-powered-features)
8. [Task Management](#task-management)
9. [Admin Panel](#admin-panel)
10. [Settings & Preferences](#settings--preferences)
11. [Keyboard Shortcuts](#keyboard-shortcuts)
12. [Mobile Usage](#mobile-usage)
13. [Tips & Best Practices](#tips--best-practices)
14. [Troubleshooting](#troubleshooting)

---

## Getting Started

### First-Time Setup

When you first access your Notez installation:

1. Navigate to your Notez URL (e.g., `http://localhost:3000` or your domain)
2. You'll be greeted with the **Setup Page** (first-time only)
3. Create your **admin account**:
   - Choose a username (alphanumeric, underscores, hyphens)
   - Enter your email address
   - Create a password (minimum 8 characters, 1 uppercase, 1 number)
4. Click **Create Admin Account**
5. You'll be logged in automatically

**Note:** After setup, the setup page won't appear again. Only admins can create new user accounts.

### Logging In

1. Navigate to your Notez URL
2. Enter your **username or email**
3. Enter your **password**
4. Click **Login**

**First-time users:** If an admin created your account, you'll need to change your temporary password on first login.

### Logging Out

- Click your **username** in the top right corner
- Select **Logout**

---

## Authentication & User Management

### Your Account

#### Changing Your Password

1. Click **Settings** (gear icon) in the header
2. Navigate to the **Profile** tab
3. Enter your **current password**
4. Enter your **new password** (min 8 chars, 1 uppercase, 1 number)
5. Confirm your new password
6. Click **Change Password**

#### Password Requirements

All passwords must meet these criteria:
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 number

### Session Management

- **Access tokens** are valid for 1 hour
- **Refresh tokens** are valid for 7 days (stored securely in httpOnly cookies)
- You'll be automatically logged out after 7 days of inactivity
- Tokens refresh automatically while you're using the app

---

## Creating & Managing Notes

### Creating a New Note

**Method 1: New Button**
1. Click the **+ New** button in the left sidebar
2. A blank note opens in the editor

**Method 2: Keyboard Shortcut**
- Press `Ctrl+N` (Windows/Linux) or `Cmd+N` (Mac)

### Writing Notes

Notez offers **two editor modes** to suit your preference:

#### Formatted Mode (Default - TipTap Editor)

The default **Formatted** mode uses TipTap, a rich-text editor that renders your markdown in real-time:

1. **Title Field**: Enter your note title at the top
2. **Content Area**: Write freely - formatting appears as you type
3. **Live Formatting**: Markdown is rendered immediately
   - Type `# Heading` and see it become a heading
   - Type `**bold**` and see bold text
   - Type `- item` for bullet lists
   - Type `- [ ] task` for checkboxes/tasks

**Formatted Mode Features:**
- WYSIWYG editing (What You See Is What You Get)
- Click checkboxes to toggle task completion
- Clean, distraction-free writing experience
- Full markdown support rendered live

#### Raw Mode (Monaco Editor)

Click the **Raw** button to switch to Monaco Editor (the same editor that powers VS Code):

1. See and edit raw markdown syntax directly
2. **Syntax Highlighting**: Markdown structure highlighted
3. Great for power users who prefer raw markdown

**Raw Mode Features:**

- Line numbers displayed on the left
- Minimap visual overview on the right
- Code folding for long documents
- Auto-indentation
- Bracket matching

#### Editor Toggle

- Click **Raw** to switch to raw markdown mode
- Click **Formatted** to return to rich-text mode
- Your content is preserved when switching

#### Common Features (Both Modes)

- **Word Count**: Live count displayed in the footer
- **Character Count**: Total characters tracked in real-time
- **Auto-Save**: Notes save automatically every 2 seconds

### Markdown Reference

Notez supports full GitHub-Flavored Markdown (GFM):

| Syntax | Result |
|--------|--------|
| `# Heading 1` | Large heading |
| `## Heading 2` | Medium heading |
| `### Heading 3` | Small heading |
| `**bold**` | **bold text** |
| `*italic*` | *italic text* |
| `~~strikethrough~~` | ~~crossed out~~ |
| `` `code` `` | `inline code` |
| `- item` | Bullet list |
| `1. item` | Numbered list |
| `- [ ] task` | Unchecked task |
| `- [x] done` | Checked task |
| `> quote` | Block quote |
| `[link](url)` | Clickable link |
| `---` | Horizontal rule |

**Code Blocks:**

````markdown
```javascript
const hello = "world";
```
````

**Keyboard Shortcuts in Editor:**

- `Ctrl+B` / `Cmd+B` - Bold
- `Ctrl+I` / `Cmd+I` - Italic
- `Ctrl+Z` / `Cmd+Z` - Undo
- `Ctrl+Y` / `Cmd+Shift+Z` - Redo
- `Ctrl+S` / `Cmd+S` - Save note

Click the **?** (help) icon in the editor header for a quick reference.

### Saving Notes

**Auto-Save (Recommended)**
- Notes automatically save every **2 seconds** while you type
- A loading indicator appears during saves
- Your cursor position is preserved (no jumping)

**Manual Save**
- Press `Ctrl+S` (Windows/Linux) or `Cmd+S` (Mac)
- Immediately saves the current note

**Note:** In the MVP version, the last save always wins if multiple people edit the same note simultaneously.

### Viewing Notes

**All Notes**
1. Click **All Notes** at the top of the sidebar
2. Browse all your notes in the middle panel
3. Notes are sorted by **last modified** (newest first)

**Note List Display**
- Note **title**
- Content **preview snippet**
- **Folder** badge (if assigned)
- **Modified date**

**Opening a Note**
- Click any note in the middle panel to open it in the editor

### Deleting Notes

**Soft Delete (Move to Trash)**
1. Open the note you want to delete
2. Click the **Delete** button (trash icon)
3. Confirm deletion
4. Note moves to the **Trash** folder

**Restore from Trash**
1. Navigate to **Trash** in the sidebar
2. Open the note you want to restore
3. Click **Restore**
4. Note returns to its original folder

**Permanent Delete**
1. Navigate to **Trash**
2. Open the note
3. Click **Delete Permanently**
4. Confirm deletion
5. Note is permanently removed (cannot be recovered)

### Duplicating Notes

1. Open the note you want to duplicate
2. Click **Duplicate** (copy icon)
3. A copy of the note is created with "(Copy)" appended to the title

---

## Organizing with Folders

### Understanding Folders

- Folders help organize your notes into categories
- Notes can belong to **one folder** at a time
- You can move notes between folders freely
- **Default folder**: A "General" folder is created for you on first login

### Creating Folders

1. Click the **+ New Folder** button in the sidebar
2. Enter a folder name
3. Press Enter or click **Create**

**Note:** For the MVP, folders are single-level (no nested folders).

### Viewing Folder Contents

- Click any **folder name** in the sidebar
- The middle panel shows all notes in that folder
- The folder name is highlighted
- Note count is displayed next to the folder name

### Renaming Folders

1. Right-click the folder (or click the folder menu icon)
2. Select **Rename**
3. Enter the new name
4. Press Enter or click **Save**

### Deleting Folders

1. Right-click the folder
2. Select **Delete**
3. Confirm deletion
4. **Important:** Notes in the folder move to **Unfiled** (they are not deleted)

### Assigning Notes to Folders

**When Creating a Note**
1. Create a new note
2. Click the **Folder** dropdown at the top of the editor
3. Select a folder
4. The note is automatically assigned when you save

**Moving an Existing Note**
1. Open the note
2. Click the **Folder** dropdown
3. Select a different folder
4. The note moves immediately (or on next save)

**Drag-and-Drop (Desktop)**
- Click and hold a note in the middle panel
- Drag it to a folder in the left sidebar
- Drop to move the note

### Unfiled Notes

- Click **Unfiled** in the sidebar to see notes without a folder
- Useful for finding notes that need organization

---

## Using Tags

### What are Tags?

Tags are labels you can add to notes for flexible organization. Unlike folders, notes can have **multiple tags**.

### Creating Tags

**Method 1: Add to a Note**
1. Open a note
2. Type in the **Tags** field
3. Start typing a tag name
4. If it's a new tag, press Enter to create it
5. If it exists, select it from the autocomplete list

**Method 2: AI Suggestions** (see AI Features)

### Applying Tags to Notes

1. Open a note
2. Find the **Tags** section (below the title)
3. Click **Add Tag**
4. Type the tag name or select from autocomplete
5. Press Enter or click to apply
6. Repeat to add multiple tags

### Viewing Tagged Notes

1. Click a **tag name** in the sidebar
2. The middle panel shows all notes with that tag
3. Tag usage count is displayed next to the tag name

### Removing Tags from Notes

1. Open the note
2. Find the tag in the **Tags** section
3. Click the **X** next to the tag name

### Renaming Tags

1. Right-click the tag in the sidebar
2. Select **Rename**
3. Enter the new name
4. All notes with this tag are updated automatically

### Deleting Tags

1. Right-click the tag in the sidebar
2. Select **Delete**
3. Confirm deletion
4. The tag is removed from all notes
5. Notes are not deleted, only the tag is removed

---

## Searching Your Notes

### Global Search

**Accessing Search**
- Click the **search bar** in the header (desktop)
- Or press `Ctrl+F` / `Cmd+F` to focus the search bar
- On mobile, tap the **Search** tab

**How to Search**
1. Type your query in the search bar
2. Results appear as you type
3. Search looks in both **titles** and **content**
4. Search is **case-insensitive**

**Search Results**
- Note **title** (highlighted match)
- **Folder** badge
- Content **snippet** showing where the match appears

**Opening Results**
- Click any result to open that note

### Advanced Search Features

**Filter by Folder**
- Search results can optionally be filtered to a specific folder
- Use query parameters: `?q=query&folderId=uuid`

**Pagination**
- Default: 20 results per page
- Maximum: 100 results per page

**What Gets Searched**
- Note titles
- Note content
- All folders (unless filtered)
- Uses PostgreSQL full-text search for speed

---

## AI-Powered Features

Notez supports AI integration with **Anthropic Claude**, **OpenAI GPT**, and **Google Gemini** to enhance your note-taking.

### Setting Up AI

1. Click **Settings** (gear icon) in the header
2. Navigate to the **AI Configuration** tab
3. Choose your **AI Provider**:
   - Anthropic Claude
   - OpenAI GPT
   - Google Gemini
4. Enter your **API Key**
5. Select a **Model** from the dropdown
6. Click **Test Connection** to verify
7. Click **Save Configuration**

### Getting API Keys

**Anthropic Claude**
- Visit: https://console.anthropic.com/
- Create an account and generate an API key
- Free tier available

**OpenAI GPT**
- Visit: https://platform.openai.com/api-keys
- Create an account and generate an API key
- Credit card required

**Google Gemini**
- Visit: https://aistudio.google.com/app/apikey
- Create an account and generate an API key
- Free tier available

### Supported Models

**Anthropic Claude**
- Claude 3.5 Sonnet (Recommended)
- Claude 3.5 Haiku
- Claude 3 Opus
- Claude 3 Sonnet
- Claude 3 Haiku

**OpenAI GPT**
- GPT-4o (Recommended)
- GPT-4o Mini
- GPT-4 Turbo
- GPT-4
- GPT-3.5 Turbo

**Google Gemini**
- Gemini 1.5 Pro
- Gemini 1.5 Flash (Recommended)
- Gemini 1.0 Pro

### AI Features

Once configured, you can use these AI features:

#### 1. Summarize Note

**Purpose:** Generate a concise summary of your note content

1. Open a note with content
2. Click **AI** menu
3. Select **Summarize**
4. Choose summary length (optional)
5. AI generates a summary
6. Review and optionally insert into your note

**Use Cases:**
- Create TL;DR sections
- Generate abstracts for long documents
- Quick review of meeting notes

#### 2. Suggest Title

**Purpose:** Let AI suggest a descriptive title based on content

1. Open a note with content (but maybe no title yet)
2. Click **AI** menu
3. Select **Suggest Title**
4. AI analyzes content and suggests titles
5. Pick one or use it as inspiration

**Use Cases:**
- Quick note organization
- When you can't think of a title
- Creating consistent naming conventions

#### 3. Extract Tags

**Purpose:** Automatically identify relevant tags from note content

1. Open a note with content
2. Click **AI** menu
3. Select **Extract Tags**
4. AI suggests tags based on content
5. Select which tags to apply
6. Tags are added to your note

**Special Features:**
- AI prioritizes suggesting **existing tags** over creating new ones
- Helps maintain tag consistency
- Configurable max number of tags

**Use Cases:**
- Quick tagging of new notes
- Finding connections between notes
- Maintaining tag consistency

### AI Settings

**Security**
- API keys are **encrypted at rest** using AES-256
- Keys are never exposed in the UI after saving
- Keys are user-specific (not shared)

**Performance**
- 30-second timeout for AI operations
- Visual loading indicators
- Graceful error handling

**Cost Management**
- AI features only run when you click them (not automatic)
- You control your own API key and usage
- Monitor usage in your provider's dashboard

---

## Task Management

Notez includes a powerful task management system integrated with your notes.

### Creating Tasks

**Method 1: Manual Creation**
1. Click the **Tasks** icon in the sidebar (or mobile tab)
2. Click **+ New Task**
3. Fill in task details:
   - **Title** (required)
   - **Description** (optional)
   - **Priority**: Urgent, High, Medium, Low
   - **Due Date** (optional)
   - **Folder** (optional - link to a folder)
   - **Note** (optional - link to a specific note)
4. Click **Create Task**

**Method 2: Import from Notes**
1. Write task-like items in your notes using markdown checkboxes:
   ```markdown
   - [ ] Task 1
   - [ ] Task 2
   - [x] Completed task
   ```
2. Click **Tasks** → **Import from Notes**
3. Click **Scan Notes** to extract tasks
4. Preview extracted tasks
5. Select which tasks to import
6. Click **Import Selected**
7. Tasks are created and linked to the source note

### Task Properties

- **Title**: The task name
- **Description**: Detailed information about the task
- **Priority**:
  - **Urgent** - Critical/time-sensitive
  - **High** - Important, near-term
  - **Medium** - Standard priority
  - **Low** - Nice to have
- **Due Date**: Optional deadline
- **Status**:
  - **Pending** - Not started
  - **In Progress** - Currently working on it
  - **Completed** - Done
- **Folder**: Link to related folder (optional)
- **Note**: Link to related note (optional)

### Managing Tasks

**Updating Task Status**
1. Click the **task** to expand details
2. Click the **status dropdown**
3. Select: Pending → In Progress → Completed

**Quick Status Toggle**
- Click the **checkbox** next to a task to mark complete/incomplete

**Editing Tasks**
1. Click the **task** to expand
2. Click **Edit**
3. Modify any fields
4. Click **Save**

**Deleting Tasks**
1. Click the **task** to expand
2. Click **Delete**
3. Confirm deletion
4. Task is permanently removed

### Filtering Tasks

**Filter Panel** (top of tasks view):
- **Status**: Show only Pending, In Progress, or Completed
- **Priority**: Filter by Urgent, High, Medium, or Low
- **Folder**: Show tasks linked to a specific folder
- **Overdue**: Show only tasks past their due date
- **Hide Completed**: Toggle visibility of completed tasks
- **Clear Filters**: Reset all filters

### Task Statistics

The Tasks header shows:
- **Pending**: Count of pending tasks
- **In Progress**: Count of active tasks
- **Completed**: Count of finished tasks
- **Overdue**: Count of tasks past due date

### Task Best Practices

1. **Use Priorities Wisely**
   - Reserve "Urgent" for truly time-critical items
   - Most tasks should be Medium or High

2. **Link to Notes**
   - Associate tasks with relevant notes for context
   - Use "Import from Notes" to keep tasks and notes in sync

3. **Set Due Dates**
   - Add due dates for time-sensitive tasks
   - Use the Overdue filter to stay on top of deadlines

4. **Regular Review**
   - Check Pending and In Progress daily
   - Archive or delete Completed tasks regularly

---

## Admin Panel

**Note:** The Admin Panel is only accessible to users with the **admin** role.

### Accessing the Admin Panel

1. Click **Admin** in the header (only visible to admins)
2. If you're not an admin, you'll be redirected

### System Information Dashboard

The Admin Panel shows:

**Application Info**
- **Version**: Current Notez version
- **Node.js Version**: Backend runtime version
- **Uptime**: Time since last server restart

**Database Status**
- **Connection**: Connected or Error
- **Type**: PostgreSQL

**Content Statistics**
- **Total Notes**: Count of all notes across all users
- **Total Folders**: Count of all folders
- **Total Tags**: Count of unique tags

### User Management

#### Viewing All Users

The **Users** tab displays:
- Username
- Email address
- Role (Admin or User badge)
- Status (Active or Inactive badge)
- Created date

#### Creating New Users

1. Click **+ Create User**
2. Fill in the form:
   - **Username**: Alphanumeric, underscores, hyphens
   - **Email**: Valid email address
   - **Temporary Password**: User will change on first login
   - **Role**: Admin or User
3. Click **Create User**
4. Share credentials with the new user securely

**Important:** There is no public self-registration. Only admins can create accounts.

#### Resetting User Passwords

1. Find the user in the list
2. Click **Reset Password**
3. Enter a **temporary password**
4. Click **Reset**
5. User will be forced to change password on next login
6. Share the temporary password securely

#### Deactivating/Reactivating Users

**Deactivate a User** (soft delete)
1. Find the user in the list
2. Click **Deactivate**
3. User cannot log in
4. User's data is preserved

**Reactivate a User**
1. Find the deactivated user
2. Click **Reactivate**
3. User can log in again

**Note:** Deactivation does not delete user data. It only prevents login.

#### User Roles

**Admin**
- Access to Admin Panel
- Can create/manage users
- Can reset any user's password
- Can deactivate/reactivate users
- Full access to all features

**User**
- Can create and manage their own notes
- Can use all note-taking features
- Cannot access Admin Panel
- Cannot manage other users

---

## Settings & Preferences

### Accessing Settings

- Click the **Settings** (gear icon) in the header

### Settings Tabs

#### 1. AI Configuration

See [AI-Powered Features](#ai-powered-features) section above.

#### 2. Profile Settings

(Coming in future updates)
- Change password
- Update email
- Notification preferences
- Export/import data

### Theme Selection

**Switching Themes**
1. Click the **theme toggle** (sun/moon icon) in the header
2. Choose **Light Mode** or **Dark Mode**
3. Theme preference is saved automatically

**Default Theme**
- Notez respects your **system preference** (OS dark mode setting)
- Override by manually selecting a theme

---

## Keyboard Shortcuts

**Navigation & Creation**
- `Ctrl+N` / `Cmd+N` - Create new note
- `Ctrl+S` / `Cmd+S` - Save note manually
- `Ctrl+F` / `Cmd+F` - Focus search bar

**Editor**
- Standard Monaco Editor shortcuts apply (same as VS Code)

---

## Mobile Usage

Notez is fully responsive and optimized for mobile devices.

### Mobile Navigation

**Bottom Navigation Tabs**
- **Folders**: Browse folders and tags
- **Notes**: View note list
- **Tasks**: Manage tasks
- **Editor**: Note editor view
- **Search**: Search notes

### Mobile Workflow

1. **Browse**: Tap **Folders** or **Notes** tab
2. **Open**: Tap a note to open in editor
3. **Edit**: Switch to **Editor** tab
4. **Save**: Auto-saves every 2 seconds
5. **Search**: Use **Search** tab

### Mobile Tips

- **Swipe**: Some interfaces support swipe gestures
- **Touch-Friendly**: Buttons and inputs are sized for touch
- **Responsive**: Layout adapts to screen size
- **Landscape**: Works in both portrait and landscape

---

## Tips & Best Practices

### Organization Strategies

1. **Folder + Tag Combo**
   - Use folders for broad categories (Work, Personal, Projects)
   - Use tags for cross-cutting themes (urgent, ideas, review)

2. **Consistent Naming**
   - Use prefixes for note titles (e.g., "Meeting: ", "Idea: ")
   - Let AI suggest titles for consistency

3. **Daily Notes**
   - Create a "Daily Notes" folder
   - Use date-based titles (YYYY-MM-DD format)

### Productivity Workflows

1. **Inbox Zero for Notes**
   - Create an "Inbox" folder for quick captures
   - Process and file notes weekly
   - Use tags to mark next actions

2. **Project-Based Organization**
   - Create folders for each project
   - Link related notes with tags
   - Use tasks to track project actions

3. **AI-Enhanced Workflow**
   - Write freely without worrying about titles
   - Let AI suggest titles and tags
   - Use AI summaries for quick reviews

### Search Power Tips

1. **Use Specific Terms**
   - Search uses full-text search
   - More specific = better results

2. **Search Within Folders**
   - Narrow results by searching within a folder
   - Useful for large note collections

3. **Leverage Tags**
   - Tag consistently
   - Search by clicking tags instead of typing

### Task Management Tips

1. **Weekly Review**
   - Check Pending and Overdue tasks
   - Update statuses
   - Adjust priorities

2. **Link Tasks to Notes**
   - Keep context with task-note links
   - Use "Import from Notes" for meeting action items

3. **Priority Hygiene**
   - Don't let everything be Urgent
   - Review and adjust priorities regularly

---

## Troubleshooting

### Login Issues

**Problem:** Can't log in
- Verify username/email is correct
- Check password (case-sensitive)
- Contact admin if account is deactivated

**Problem:** Forced to change password
- This is normal for new accounts
- Create a new password meeting requirements

### Note Saving Issues

**Problem:** Notes not saving
- Check your internet connection
- Look for error messages
- Try manual save (Ctrl+S)
- Refresh the page

**Problem:** Lost changes
- Auto-save runs every 2 seconds
- Check if you were disconnected
- MVP uses "last write wins" for conflicts

### Search Not Working

**Problem:** Can't find notes
- Try different search terms
- Check if note is in Trash
- Verify note content matches search

### AI Features Not Working

**Problem:** AI features failing
- Verify API key in Settings
- Test connection in AI Configuration
- Check API key has credits (for paid providers)
- Try a different model

**Problem:** AI suggestions not relevant
- Provide more content context
- Try a different model
- Some models work better for certain tasks

### Editor Issues

**Problem:** Can't scroll in long notes

- Ensure you're clicking inside the editor content area
- Try scrolling with the scroll bar on the right side
- Switch to Raw mode temporarily if issues persist
- Refresh the page to reset editor state

**Problem:** Formatting not applying (Ctrl+B, Ctrl+I, etc.)

- Make sure text is selected before applying formatting
- Click inside the editor to ensure it has focus
- Try using markdown syntax directly (e.g., `**bold**`)
- Switch between Formatted and Raw mode to reset editor state

**Problem:** Content looks different after save

- This can happen with complex nested formatting
- Use simpler markdown structures when possible
- Check the Raw view to see actual markdown stored

### Performance Issues

**Problem:** App is slow
- Check internet connection
- Clear browser cache
- Try a different browser
- Contact admin about server resources

### Mobile Issues

**Problem:** Layout looks broken
- Refresh the page
- Clear browser cache
- Try rotating device
- Update your browser

---

## Getting Help

### Resources

- **Documentation**: Check `/docs` folder in the repository
- **GitHub Issues**: Report bugs at the project repository
- **Admin Support**: Contact your instance administrator

### Feedback

Notez is open source and actively developed. Suggestions and bug reports are welcome!

---

## Appendix: Feature Roadmap

### Current Features (MVP - v1.0)

✅ User authentication and management
✅ Note creation, editing, and deletion
✅ Auto-save (2-second interval)
✅ Folder organization
✅ Tag system
✅ Full-text search
✅ AI integration (Claude, GPT, Gemini)
✅ Task management with import
✅ Trash/restore functionality
✅ Dark/light themes
✅ Mobile responsive design
✅ Admin panel

### Planned Features (Phase 2)

🔜 Note linking ([[Note]] syntax)
🔜 Graph visualization
🔜 Version history
🔜 Nested folders
🔜 Advanced find/replace
🔜 Daily notes template

### Future Features (Phase 3)

💡 Note sharing and collaboration
💡 Note attachments/uploads
💡 Export to PDF/Markdown
💡 API webhooks
💡 Browser extensions

---

**Thank you for using Notez! Happy note-taking!** 📝
