# Phase 2: Backlinks & Note References

## Feature: Clickable References (Similar to Obsidian)

### User Requirement
> "I want to tag/anchor my words in my documents so I can click a tag/anchor and see all documents that contain the word. For example, if I've assigned a work task to Ryan I want to see all documents where I reference him. If I am working on my homelab on accserver, I want to be able to click accserver and find all relevant documents."

---

## Implementation Approaches

### Option A: Wiki-Style Links (Obsidian-like) ⭐ RECOMMENDED

**Syntax:** `[[Ryan]]` or `[[accserver]]`

**How it works:**
1. User types `[[keyword]]` in note
2. System recognizes it as a reference/link
3. Click the link → see all notes containing that keyword
4. Bidirectional: Shows "mentions" on a note

**Pros:**
- Familiar to Obsidian/Roam users
- Clear distinction between links and regular text
- Easy to parse and index
- Can show broken links (references with no matching note)

**Cons:**
- Requires special syntax (users need to learn `[[]]`)
- Extra typing

**Database Changes:**
```prisma
model NoteLink {
  id          String   @id @default(cuid())
  sourceNoteId String
  targetKeyword String  // e.g., "Ryan", "accserver"
  position     Int      // Position in source note
  createdAt    DateTime @default(now())

  sourceNote   Note     @relation("sourceLinks", fields: [sourceNoteId], references: [id], onDelete: Cascade)

  @@index([targetKeyword])
  @@index([sourceNoteId])
}
```

**UI Features:**
- Autocomplete when typing `[[` (suggest existing keywords)
- Backlinks panel: "Mentioned in 5 notes"
- Graph view (Phase 3): Visual connections between notes

---

### Option B: Hashtag-Style References

**Syntax:** `@Ryan` or `#accserver`

**How it works:**
1. User types `@keyword` or `#keyword`
2. System treats it as a mention/reference
3. Click → see all notes with that mention

**Pros:**
- More familiar (social media style)
- Quick to type
- Can differentiate: `@` for people, `#` for things/projects

**Cons:**
- Conflicts with hashtags (tags)
- Less semantic than wiki links
- Harder to differentiate from normal text

---

### Option C: Automatic Word Detection (No Special Syntax)

**How it works:**
1. System analyzes note content
2. Detects "important" words (proper nouns, repeated terms)
3. Automatically makes them clickable

**Pros:**
- No special syntax needed
- User doesn't think about it

**Cons:**
- Hard to implement reliably (NLP required)
- May miss or incorrectly identify words
- Performance overhead

**Verdict:** Not recommended for MVP

---

## Recommended Implementation: Option A (Wiki Links)

### Phase 2A: Basic Wiki Links

#### Step 1: Add Link Extension to Tiptap
```tsx
import Link from '@tiptap/extension-link';

// Configure for wiki-style links
const WikiLink = Link.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      'data-wiki-link': {
        default: null,
      },
    };
  },
});
```

#### Step 2: Parse and Render `[[keyword]]`
- Use Tiptap's input rules to detect `[[text]]`
- Convert to clickable link
- Style differently from regular links

#### Step 3: Backend Search for References
```typescript
// New API endpoint
GET /api/notes/references?keyword=Ryan

// Returns:
{
  keyword: "Ryan",
  notes: [
    {
      id: "abc123",
      title: "Project Meeting Notes",
      snippet: "...assigned task to [[Ryan]]...",
      count: 3  // Number of times mentioned
    }
  ]
}
```

#### Step 4: Backlinks UI
Add a collapsible "Backlinks" section in note editor:
```
┌─────────────────────────────────┐
│ Note Editor                      │
│ ...                              │
└─────────────────────────────────┘
┌─────────────────────────────────┐
│ 🔗 Backlinks (3)         [Expand]│
│                                  │
│ • Project Meeting Notes (3x)     │
│ • Sprint Planning (1x)           │
│ • 1-on-1 with Manager (2x)       │
└─────────────────────────────────┘
```

---

### Phase 2B: Enhanced Features

Once basic wiki links work:

#### 1. **Autocomplete**
- When typing `[[`, show dropdown of existing keywords
- Arrow keys to select, Enter to insert

#### 2. **Unlinked Mentions**
- Show notes that mention "Ryan" but don't have `[[Ryan]]`
- Suggest converting them to links

#### 3. **Bidirectional Links**
- If Note A links to "Ryan", show in Ryan's references
- If you create a note titled "Ryan", show all references to it

#### 4. **Smart Suggestions**
- Detect frequently mentioned terms
- Suggest creating wiki links for them

---

## Use Cases

### Example 1: People Tracking
**Scenario:** You assign tasks to Ryan across multiple notes

**What you do:**
- Type: "Assigned database migration to [[Ryan]]"
- Click `[[Ryan]]` → see all notes mentioning Ryan
- Result: Instant view of all Ryan's tasks/mentions

**Future:** Create a "Ryan" note with his contact info, and all mentions link to it

---

### Example 2: Infrastructure/Homelab
**Scenario:** You're documenting your homelab servers

**What you do:**
- Type: "Deployed Notez to [[accserver]]"
- Type: "Need to upgrade [[accserver]] RAM"
- Click `[[accserver]]` → see all server-related notes

**Future:**
- Create "accserver" note with specs, IP, etc.
- All references automatically link to it
- See what services run on which servers

---

### Example 3: Project Management
**Scenario:** Tracking a project across meetings, todos, notes

**What you do:**
- Type: "[[Project Phoenix]] launched today"
- Type: "Budget approved for [[Project Phoenix]]"
- Click link → see entire project timeline

---

## Technical Considerations

### Storage Format
**Option 1:** Store as markdown (recommended)
```markdown
Assigned to [[Ryan]]
Working on [[accserver]]
```

**Option 2:** Store as HTML with data attributes
```html
<a href="#" data-wiki-link="Ryan">Ryan</a>
```

**Recommendation:** Store as markdown for portability. Tiptap can render it as interactive links.

---

### Performance
- Index `targetKeyword` column for fast lookups
- Cache frequently accessed backlinks
- Limit backlink queries to 100 results

### Search Integration
- Clicking a wiki link = special search for that exact term
- Show in dedicated "References" view vs normal search results

---

## UI Mockup

```
┌──────────────────────────────────────────────┐
│ Meeting Notes - Jan 15                       │
├──────────────────────────────────────────────┤
│                                              │
│ Discussed database migration with [[Ryan]].  │
│                    ├─────────┤              │
│                    └─ Clickable               │
│                                              │
│ Need to deploy to [[accserver]] by Friday.   │
│                    ├──────────┤             │
│                    └─ Clickable               │
│                                              │
└──────────────────────────────────────────────┘

After clicking [[Ryan]]:

┌──────────────────────────────────────────────┐
│ References: "Ryan"                      [✕]  │
├──────────────────────────────────────────────┤
│ 🔍 Found in 5 notes:                        │
│                                              │
│ • Meeting Notes - Jan 15 (2 mentions)        │
│   "...migration with [[Ryan]]. He will..."  │
│                                              │
│ • Sprint Planning (1 mention)                │
│   "...assign to [[Ryan]] for review..."     │
│                                              │
│ • 1-on-1 Notes (3 mentions)                  │
│   "[[Ryan]] raised concerns about..."       │
└──────────────────────────────────────────────┘
```

---

## Implementation Timeline

**Phase 2A (Current sprint):**
- ✅ Tiptap integration (DONE)
- ✅ Task lists (DONE)
- ⏳ Wiki link parsing (Next)
- ⏳ Basic backlinks API (Next)

**Phase 2B (Future sprint):**
- Autocomplete for `[[`
- Backlinks UI panel
- Unlinked mentions

**Phase 3:**
- Graph visualization
- Note creation from links
- Advanced search by connections

---

## Summary

**Recommended Approach:**
1. Use `[[keyword]]` syntax (Obsidian-style)
2. Parse in Tiptap, store as markdown
3. Backend API for searching references
4. Simple backlinks panel in UI
5. Extend with autocomplete, suggestions later

**Why this is powerful:**
- No more forgetting where you mentioned something
- Connect scattered thoughts across notes
- Build a "second brain" with interconnected knowledge
- Especially useful for: people tracking, project management, infrastructure docs

---

*Last Updated: 2025-11-02*
