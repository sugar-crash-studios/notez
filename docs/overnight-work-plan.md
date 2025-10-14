# Overnight Work Plan - Authentication System

## Current Status
- ✅ Merged PR #1 (project setup)
- ✅ Created feature branch: `feature/authentication-system`
- ✅ Updated permissions in `.claude/settings.local.json` (wildcards fixed)
- ⚠️ Permissions may need session reload - grant when prompted

## Work Plan for Tonight

### Phase 1: Backend Foundation (2-3 hours)
1. **Install Dependencies**
   - Run `npm install` in backend folder
   - Run `npm install` in frontend folder

2. **Create First Database Migration**
   - Generate Prisma migration from existing schema
   - Creates all tables: users, sessions, notes, folders, tags, etc.
   - Command: `npx prisma migrate dev --name init`

3. **Build Authentication Service** (`backend/src/services/auth.service.ts`)
   - Password hashing with bcrypt
   - JWT token generation (access + refresh)
   - Token verification
   - Password validation

4. **Build User Service** (`backend/src/services/user.service.ts`)
   - Create user
   - Find user by ID/username/email
   - Update user
   - List users
   - Check if first user (for setup)

### Phase 2: API Routes (2-3 hours)

5. **Authentication Routes** (`backend/src/routes/auth.routes.ts`)
   ```
   POST /api/auth/setup        - Create first admin user
   POST /api/auth/login         - Login with username/password
   POST /api/auth/refresh       - Refresh access token
   POST /api/auth/logout        - Logout (invalidate refresh token)
   POST /api/auth/change-password - Change own password
   ```

6. **User Management Routes** (`backend/src/routes/users.routes.ts`) - Admin only
   ```
   GET    /api/users           - List all users
   POST   /api/users           - Create new user
   PATCH  /api/users/:id       - Update user (deactivate, reset password)
   DELETE /api/users/:id       - Soft delete user
   ```

7. **Middleware** (`backend/src/middleware/`)
   - Authentication middleware (verify JWT)
   - Admin-only middleware
   - Request validation middleware (Zod schemas)

### Phase 3: Testing & Validation (1 hour)

8. **Test API Endpoints**
   - Start dev server
   - Test setup endpoint (create admin)
   - Test login (get tokens)
   - Test refresh token
   - Test user creation (admin only)
   - Test protected routes

9. **Create Test Documentation**
   - Example curl commands
   - Expected responses
   - Error scenarios

### Phase 4: Commit & PR (30 min)

10. **Commit Work**
    - Descriptive commit message
    - Document all changes

11. **Create Pull Request**
    - Comprehensive PR description
    - Test plan included
    - Ready for your review

## File Structure Created

```
backend/src/
├── services/
│   ├── auth.service.ts       - Authentication logic
│   ├── user.service.ts       - User management
│   └── encryption.service.ts - Encrypt/decrypt sensitive data
├── routes/
│   ├── auth.routes.ts        - Auth endpoints
│   └── users.routes.ts       - User management endpoints
├── middleware/
│   ├── auth.middleware.ts    - JWT verification
│   ├── admin.middleware.ts   - Admin-only check
│   └── validate.middleware.ts - Request validation
├── types/
│   ├── user.types.ts         - User type definitions
│   └── auth.types.ts         - Auth type definitions
└── utils/
    ├── jwt.utils.ts          - JWT helpers
    └── validation.schemas.ts  - Zod validation schemas
```

## Dependencies Being Added

**Backend:**
- `bcrypt` / `@types/bcrypt` - Password hashing
- `zod` - Request validation (already in package.json)
- All others already present

## What You'll See in the Morning

1. **New Branch:** `feature/authentication-system`
2. **New Files:** ~10-12 files (services, routes, middleware, types)
3. **Database Migration:** Initial migration with all tables
4. **Pull Request:** Ready for review with full auth system
5. **Test Documentation:** How to test all endpoints

## If Something Goes Wrong

If I encounter issues, I'll:
1. Document the issue in a file
2. Commit what works
3. Leave clear notes about what's blocked
4. Continue with other tasks

## Expected Completion

If everything goes smoothly: **4-6 hours**
- This leaves me time for additional features if you want

## Next Features After Auth (If Time Permits)

1. **Note CRUD Operations** - Basic create/read/update/delete
2. **Folder Management** - Create and manage folders
3. **Frontend Login Page** - Basic React login form

Let me know if you want me to tackle additional features tonight!

---

**Sleep well!** I'll have the authentication system ready for review by morning. 🚀
