# Notez Brownfield Documentation Index

> Comprehensive reference documentation for AI-assisted development
> Generated: 2025-11-29 | BMad Method Document-Project Workflow

## Purpose

This documentation was generated to provide AI agents and developers with complete context about the Notez codebase. It enables:

- **Consistent development** - AI agents understand existing patterns
- **Informed decisions** - Architecture and constraints are documented
- **Reduced errors** - Type contracts and API specs are explicit
- **Faster onboarding** - New developers/agents can quickly understand the system

---

## Quick Links

| Document | Description |
|----------|-------------|
| [Project Overview](./project-overview.md) | Executive summary, architecture, tech stack |
| [API Reference](./api-reference.md) | Complete REST API documentation |
| [Data Model](./data-model.md) | Database schema, relationships, indexes |
| [Development Patterns](./development-patterns.md) | Code conventions and patterns |
| [Testing Gaps](./testing-gaps.md) | Testing analysis and remediation plan |

---

## Documentation Map

```
docs/
├── brownfield/                    # AI-generated reference docs (this folder)
│   ├── index.md                  # This file
│   ├── project-overview.md       # Architecture and tech stack
│   ├── api-reference.md          # REST API documentation
│   ├── data-model.md             # Database schema reference
│   ├── development-patterns.md   # Code patterns and conventions
│   └── testing-gaps.md           # Test coverage analysis
│
├── mvp-specification.md          # Original MVP requirements
├── requirements.md               # Project requirements
├── roadmap.md                    # Feature roadmap
├── roadmap-phase-2-backlinks.md  # Phase 2 planning
├── mvp-status.md                 # MVP completion tracking
├── database-security.md          # Security documentation
├── api-testing-guide.md          # Manual API testing guide
├── USER-GUIDE.md                 # End-user documentation
└── bmm-workflow-status.yaml      # BMad Method workflow tracking
```

---

## Project Summary

| Attribute | Value |
|-----------|-------|
| **Name** | Notez |
| **Type** | Self-hosted note-taking application |
| **Architecture** | Monorepo (Backend + Frontend) |
| **Backend** | Node.js 20 + Fastify + Prisma + PostgreSQL |
| **Frontend** | React 19 + Vite + Tailwind CSS |
| **Deployment** | Docker → ghcr.io → Portainer |
| **Status** | MVP Complete |

---

## Key Metrics

| Metric | Value |
|--------|-------|
| TypeScript Files | 58 |
| Lines of Code | ~6,500 |
| API Endpoints | ~45 |
| Data Models | 10 |
| UI Components | 15 |
| Pages | 7 |
| Test Coverage | **0%** ⚠️ |

---

## Critical Information for AI Agents

### When Working on Backend

1. **Route Pattern**: Routes → Middleware → Services → Prisma
2. **Auth Required**: All routes except `/auth/setup-needed`, `/auth/login`, `/auth/refresh`, `/health`
3. **User Ownership**: Always filter by `userId` from `request.user`
4. **Error Format**: `{ error: "Type", message: "Description" }`
5. **Validation**: Use Zod schemas in `validation.schemas.ts`

### When Working on Frontend

1. **State Management**: TanStack Query for server state, React Context for auth/theme
2. **API Client**: Use existing `api.ts` exports (e.g., `notesApi.list()`)
3. **Styling**: Tailwind CSS with dark mode support (`dark:` prefix)
4. **Auth Flow**: Access token in localStorage, refresh via httpOnly cookie
5. **Protected Routes**: Wrap with `<ProtectedRoute>` component

### When Modifying Database

1. **Migrations**: Run `npx prisma migrate dev --name description`
2. **User Isolation**: All user content has `userId` foreign key
3. **Soft Delete**: Notes use `deleted` flag, not hard delete
4. **Cascades**: Deleting user cascades to all owned content
5. **Full-Text**: `searchVector` auto-updated by PostgreSQL trigger

### Known Issues to Avoid

1. **No shared types** - Frontend/backend contracts are implicit
2. **No tests** - Be extra careful with changes
3. **TipTap editor** - README mentions Monaco but TipTap is used
4. **Rate limiting** - Not implemented despite being mentioned

---

## Related Documentation

### In This Repository

- [README.md](../../README.md) - Project overview and quick start
- [DEPLOYMENT.md](../../DEPLOYMENT.md) - Docker/Portainer deployment guide
- [MVP Specification](../mvp-specification.md) - Original feature requirements
- [Roadmap](../roadmap.md) - Future feature plans

### External References

- [Fastify Documentation](https://fastify.dev/docs/latest/)
- [Prisma Documentation](https://www.prisma.io/docs)
- [React Documentation](https://react.dev)
- [TanStack Query](https://tanstack.com/query/latest)
- [Tailwind CSS](https://tailwindcss.com/docs)

---

## Maintenance

This documentation should be updated when:

- New API endpoints are added
- Database schema changes
- Major architectural changes occur
- New patterns are established

To regenerate, run: `/bmad:bmm:workflows:document-project`

---

*Generated by BMad Method Document-Project Workflow*
