# Known Issues and Future Fixes

This document tracks known issues identified through code reviews and testing that are deferred for future releases.

Last Updated: 2025-11-29

---

## BMad Method Framework Issues

The following issues were identified in the BMad Method framework files (`.bmad/`) during PR #39 code review. These are tracked for future consideration as they relate to third-party framework code:

### 1. File Path Wildcards in Instructions
**Location:** `.bmad/bmm/workflows/4-implementation/story-context/instructions.md`
**Issue:** Instructions reference file paths with wildcards (e.g., `docs/brownfield/*.md`) which may not be directly usable by all tools.
**Status:** Tracked - Framework limitation

### 2. Time Estimates in Workflow Instructions
**Location:** `.bmad/bmm/workflows/*/instructions.md`
**Issue:** Some workflow instructions contain time estimates (e.g., "should take 2-3 hours") which may set unrealistic expectations.
**Status:** Tracked - Documentation style consideration

### 3. Duplicate Step Numbers in Checklists
**Location:** Various checklist files
**Issue:** Some checklists have duplicate step numbers or inconsistent numbering.
**Status:** Tracked - Minor documentation issue

### 4. Grep Pattern Escaping
**Location:** Various instruction files
**Issue:** Some grep patterns may need proper escaping for special characters.
**Status:** Tracked - Usage consideration

---

## Application Issues

### 1. Focus Visibility (FIXED in v0.28.x)
**Location:** `frontend/src/components/TiptapEditor.css`
**Issue:** Original `outline: none` removed focus indicator for keyboard navigation.
**Fix:** Added visible focus styles with subtle inner box-shadow.
**Status:** ✅ Fixed

### 2. Mousewheel Scrolling (FIXED in v0.28.x)
**Location:** `frontend/src/components/TiptapEditor.tsx`, `TiptapEditor.css`, `NoteEditor.tsx`
**Issue:** Large notes didn't scroll properly with mousewheel.
**Fix:** Updated CSS container hierarchy and overflow properties.
**Status:** ✅ Fixed

---

## Version Notes

| Issue | Identified | Fixed | Version |
|-------|------------|-------|---------|
| Focus visibility | 2025-11-29 | 2025-11-29 | v0.28.x |
| Mousewheel scroll | 2025-11-29 | 2025-11-29 | v0.28.x |
| BMad framework items | 2025-11-29 | Deferred | - |
