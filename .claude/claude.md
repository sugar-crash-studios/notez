# Claude Code Instructions for Notez

## Git Workflow Rules

**CRITICAL: You are FORBIDDEN from committing directly to the `main` branch.**

### Branch Strategy

1. **ALWAYS check your current branch before committing code**
   - Run `git branch --show-current` before any commit
   - If you are on `main`, you MUST switch to a feature branch or create a new one

2. **Feature Branch Naming Convention**
   - Format: `feature/<description>` (e.g., `feature/auth-system`, `feature/note-editor`)
   - Format: `fix/<description>` for bug fixes
   - Format: `refactor/<description>` for refactoring
   - Use kebab-case for branch names

3. **Workflow**
   - Create a new feature branch from `main` for each feature/task
   - Make all commits to the feature branch
   - When feature is complete and tested, create a PR to merge into `main`
   - Delete feature branch after merge

4. **Before Every Commit**
   ```bash
   # ALWAYS run this first
   git branch --show-current

   # If output is "main", STOP and either:
   # - Switch to existing feature branch: git checkout feature/branch-name
   # - Create new feature branch: git checkout -b feature/new-feature-name
   ```

5. **Creating Pull Requests**
   - Use descriptive PR titles
   - Include summary of changes
   - Reference any related issues
   - Ensure CI/CD passes before requesting merge

## Project Context

- **Project Name:** Notez
- **Description:** Self-hosted web-based note-taking application with AI features
- **Architecture:** Monorepo (Node.js backend + React frontend)
- **Deployment:** Docker → ghcr.io → Portainer
- **Documentation:** See `/docs` folder for requirements and MVP spec

## Development Permissions

You have extensive autonomous permissions to:

- ✅ Create and manage feature branches
- ✅ Write, edit, and delete code files
- ✅ Create project structure and configuration files
- ✅ Install dependencies (npm/yarn packages)
- ✅ Run tests and builds
- ✅ Create and update documentation
- ✅ Initialize database schemas
- ✅ Create Docker configurations
- ✅ Set up CI/CD pipelines (GitHub Actions)
- ✅ Make architectural decisions aligned with MVP spec
- ✅ Refactor code for better quality
- ✅ Create pull requests when features are complete

## Restrictions

- ❌ **NEVER commit to main branch directly**
- ❌ Do not push to main without PR approval
- ❌ Do not delete main or protected branches
- ❌ Do not modify .git configuration without asking
- ❌ Do not run force push operations without explicit approval
- ❌ Do not expose secrets or API keys in code

## Code Quality Standards

- Use TypeScript for all new code (backend and frontend)
- Follow consistent code formatting (Prettier)
- Write meaningful commit messages
- Add comments for complex logic
- Keep functions small and focused
- Write tests for critical functionality
- Handle errors gracefully

## Project Structure

```
/notez
├── backend/          # Fastify + TypeScript backend
├── frontend/         # React + TypeScript frontend
├── docker/           # Docker and docker-compose files
├── docs/             # Documentation
├── .github/          # GitHub Actions workflows
└── .claude/          # Claude instructions (this file)
```

## Working Process

1. **Plan** - Understand the task and create a todo list
2. **Branch** - Create or switch to appropriate feature branch
3. **Code** - Implement the feature
4. **Test** - Verify functionality
5. **Commit** - Commit to feature branch with clear message
6. **PR** - Create pull request when ready for main

## Communication

- Provide progress updates as you work
- Ask questions when requirements are unclear
- Suggest improvements when you see opportunities
- Flag potential issues or risks early

## References

- MVP Specification: `/docs/mvp-specification.md`
- Requirements: `/docs/requirements.md`

---

**Remember: CHECK YOUR BRANCH BEFORE EVERY COMMIT!**
