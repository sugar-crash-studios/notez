# Notez Testing Gaps Analysis

> Critical testing assessment for brownfield remediation
> Generated: 2025-11-29

## Executive Summary

**Current Test Coverage: 0%**

The Notez codebase has **no automated tests**. This represents a significant technical debt and risk for:
- Regression bugs during development
- Confidence in refactoring
- CI/CD quality gates
- Documentation of expected behavior

## Current State

### Test Infrastructure

| Component | Status | Notes |
|-----------|--------|-------|
| Backend test framework | ❌ None | No Jest/Vitest configured |
| Frontend test framework | ❌ None | No Vitest/Jest/RTL configured |
| E2E framework | ❌ None | No Playwright/Cypress |
| CI test step | ❌ None | Build only, no test execution |
| Coverage reporting | ❌ None | No tooling configured |

### Test Files Found

```
Backend: 0 test files
Frontend: 0 test files
E2E: 0 test files
```

## Risk Assessment

### High Risk Areas (Untested)

| Area | Risk Level | Impact | Reason |
|------|------------|--------|--------|
| **Authentication** | 🔴 Critical | Security breach | JWT handling, password validation |
| **Authorization** | 🔴 Critical | Data exposure | User ownership checks |
| **AI Integration** | 🟠 High | Feature failure | API key encryption, provider switching |
| **Data Integrity** | 🟠 High | Data loss | Soft delete, cascade rules |
| **Search** | 🟡 Medium | UX degradation | Full-text search accuracy |
| **Task Import** | 🟡 Medium | Data corruption | Markdown parsing |

### Business Logic Hotspots

Files with complex logic that need tests:

1. **`backend/src/services/auth.service.ts`**
   - Password hashing/verification
   - Token generation/validation
   - Session management
   - First-user setup flow

2. **`backend/src/services/note.service.ts`**
   - CRUD operations with ownership
   - Soft delete/restore
   - Tag association management

3. **`backend/src/services/task-extraction.service.ts`**
   - Markdown checkbox parsing
   - Task deduplication
   - Note-task linking

4. **`backend/src/services/ai/ai.service.ts`**
   - Provider factory pattern
   - API key encryption/decryption
   - Error handling for external APIs

5. **`backend/src/utils/encryption.ts`**
   - AES-256-GCM implementation
   - Key derivation

6. **`frontend/src/contexts/AuthContext.tsx`**
   - Token refresh logic
   - Auth state management

7. **`frontend/src/lib/api.ts`**
   - Axios interceptor chain
   - 401 retry logic

## Recommended Testing Strategy

### Phase 1: Critical Path (Priority 1)

**Timeframe:** 1-2 weeks

Focus on authentication and authorization - the highest risk areas.

```
backend/
├── __tests__/
│   ├── services/
│   │   └── auth.service.test.ts     # JWT, passwords, sessions
│   ├── middleware/
│   │   └── auth.middleware.test.ts  # Token validation
│   └── utils/
│       └── encryption.test.ts       # Crypto functions
```

**Test Cases:**
- [ ] Password hashing produces valid bcrypt hash
- [ ] Password verification succeeds with correct password
- [ ] Password verification fails with wrong password
- [ ] JWT access token contains correct claims
- [ ] JWT access token expires after 1 hour
- [ ] Refresh token generates new access token
- [ ] Expired refresh token is rejected
- [ ] First user setup creates admin
- [ ] Second setup attempt fails
- [ ] API key encryption is reversible
- [ ] Auth middleware rejects invalid tokens
- [ ] Auth middleware rejects expired tokens

### Phase 2: Data Integrity (Priority 2)

**Timeframe:** 1-2 weeks

Focus on CRUD operations and data ownership.

```
backend/
├── __tests__/
│   ├── services/
│   │   ├── note.service.test.ts
│   │   ├── folder.service.test.ts
│   │   └── tag.service.test.ts
│   └── integration/
│       └── notes.routes.test.ts
```

**Test Cases:**
- [ ] User can only access own notes
- [ ] Soft delete moves note to trash
- [ ] Restore recovers note from trash
- [ ] Permanent delete removes note
- [ ] Deleting folder nullifies note.folderId
- [ ] Deleting tag removes note-tag associations
- [ ] Creating note with invalid folder fails
- [ ] Updating note preserves unmodified fields

### Phase 3: Feature Coverage (Priority 3)

**Timeframe:** 2-3 weeks

Cover remaining business logic.

```
backend/
├── __tests__/
│   ├── services/
│   │   ├── search.service.test.ts
│   │   ├── task.service.test.ts
│   │   ├── task-extraction.service.test.ts
│   │   └── ai/
│   │       └── ai.service.test.ts
```

**Test Cases:**
- [ ] Search finds notes by title
- [ ] Search finds notes by content
- [ ] Search respects user ownership
- [ ] Task creation with note link
- [ ] Task status transitions
- [ ] Markdown checkbox extraction
- [ ] AI provider switching
- [ ] AI feature error handling

### Phase 4: Frontend Unit Tests (Priority 4)

**Timeframe:** 2 weeks

```
frontend/
├── __tests__/
│   ├── components/
│   │   ├── NoteEditor.test.tsx
│   │   └── TaskList.test.tsx
│   ├── contexts/
│   │   └── AuthContext.test.tsx
│   └── lib/
│       └── api.test.ts
```

### Phase 5: E2E Tests (Priority 5)

**Timeframe:** 2-3 weeks

```
e2e/
├── auth.spec.ts          # Login, logout, password change
├── notes.spec.ts         # Create, edit, delete notes
├── folders.spec.ts       # Folder management
├── search.spec.ts        # Search functionality
└── ai-features.spec.ts   # AI integration (mocked)
```

## Recommended Test Stack

### Backend

```json
{
  "devDependencies": {
    "vitest": "^1.0.0",
    "@vitest/coverage-v8": "^1.0.0",
    "supertest": "^6.3.0"
  }
}
```

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['node_modules', 'dist'],
    },
  },
});
```

### Frontend

```json
{
  "devDependencies": {
    "vitest": "^1.0.0",
    "@testing-library/react": "^14.0.0",
    "@testing-library/jest-dom": "^6.0.0",
    "jsdom": "^23.0.0"
  }
}
```

### E2E

```json
{
  "devDependencies": {
    "playwright": "^1.40.0",
    "@playwright/test": "^1.40.0"
  }
}
```

## CI/CD Integration

Add test step to GitHub Actions:

```yaml
# .github/workflows/docker-build.yml
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_DB: notez_test
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install backend dependencies
        run: cd backend && npm ci

      - name: Run backend tests
        run: cd backend && npm test
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/notez_test

      - name: Install frontend dependencies
        run: cd frontend && npm ci

      - name: Run frontend tests
        run: cd frontend && npm test

  build:
    needs: test  # Only build if tests pass
    # ... existing build job
```

## Coverage Goals

| Phase | Target Coverage | Timeline |
|-------|----------------|----------|
| Phase 1 | Auth: 80%+ | Week 2 |
| Phase 2 | Services: 70%+ | Week 4 |
| Phase 3 | Overall: 60%+ | Week 7 |
| Phase 4 | Frontend: 50%+ | Week 9 |
| Maintenance | Overall: 70%+ | Ongoing |

## Quick Wins

Easiest tests to add first:

1. **`encryption.test.ts`** - Pure functions, no mocking needed
2. **`validation.schemas.test.ts`** - Zod schema validation
3. **`jwt.utils.test.ts`** - Token generation/parsing
4. **`api.test.ts`** (frontend) - Interceptor logic with mocked axios

## Conclusion

The lack of tests is a significant risk that should be addressed before major feature development. The recommended approach:

1. **Immediate:** Add auth/security tests (highest risk)
2. **Short-term:** Add data integrity tests
3. **Medium-term:** Achieve 60%+ coverage
4. **Ongoing:** Require tests for new features

Estimated total effort: **8-12 weeks** for comprehensive coverage, but Phase 1 (critical security tests) can be completed in **1-2 weeks**.
