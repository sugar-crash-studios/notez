# GitHub Branch Protection Setup

## Overview

**Server-side branch protection** is the industry-standard way to enforce workflow rules at the repository level. Unlike client-side git hooks (which can be bypassed), GitHub branch protection rules are enforced by the server and **cannot be circumvented**.

### Free Public Repository Features

GitHub offers robust branch protection **for free** on public repositories:

**Available for FREE:**
- ✅ Require pull requests before merging (blocks direct pushes to main)
- ✅ Require status checks to pass (CI/CD must pass)
- ✅ Require conversation resolution
- ✅ Require linear history (clean git history)
- ✅ Block force pushes
- ✅ Block branch deletion

**Requires GitHub Pro (paid):**
- ❌ Require pull request approvals/reviews
- ❌ Require code owner reviews
- ❌ Block admin bypass

**For solo developers on free plans:** You can still enforce the PR workflow and require CI/CD to pass. The only limitation is you can't require approval reviews (but you can still self-review and self-merge).

## Why Both Client-Side and Server-Side?

### Client-Side Hook (`.githooks/pre-commit`)
- ✅ **Developer-friendly**: Catches mistakes before they even try to push
- ✅ **Fast feedback**: Error message shown immediately
- ✅ **Educational**: Teaches new developers the workflow
- ❌ **Bypassable**: Can use `git commit --no-verify`
- ❌ **Optional**: Requires manual setup per clone

### Server-Side Protection (GitHub Branch Rules)
- ✅ **Enforced**: Cannot be bypassed by anyone
- ✅ **Universal**: Applies to all developers automatically
- ✅ **Auditable**: GitHub logs all attempts
- ✅ **No setup needed**: Works immediately after clone
- ❌ **Slower feedback**: Only discover issue when pushing

**Best Practice**: Use **both** for defense-in-depth:
1. Client-side hook catches 99% of mistakes early
2. Server-side protection catches the 1% that bypass or forget hooks

## Setup Instructions

### Step 1: Navigate to Repository Settings

1. Go to your repository on GitHub: https://github.com/SpasticPalate/notez
2. Click **Settings** tab
3. Click **Branches** in the left sidebar

### Step 2: Add Branch Protection Rule

1. Click **Add branch protection rule** (or **Add** button)
2. In **Branch name pattern**, enter: `main`
3. Configure the following settings:

#### Required Settings (Enforce Workflow)

- [x] **Require a pull request before merging** (FREE)
  - This is the key setting that prevents direct commits/pushes to main
  - Ensures all changes go through PR review process

- [ ] **Require approvals** (under PR requirements) - **GitHub Pro Required**
  - Recommended: **1** approval minimum (if you have paid plan)
  - For free public repos: **Not available** - you can self-merge without approval
  - For solo developer on paid plan: Can skip this or require self-approval

- [ ] **Dismiss stale pull request approvals when new commits are pushed** - **GitHub Pro Required**
  - Ensures re-review after changes
  - Only relevant if "Require approvals" is available

- [x] **Require status checks to pass before merging** (FREE)
  - Select: **build** (your GitHub Actions workflow)
  - Ensures CI/CD passes before merge

- [x] **Require conversation resolution before merging** (FREE)
  - All review comments must be addressed

#### Optional But Recommended

- [x] **Require linear history** (FREE)
  - Prevents merge commits, enforces clean history
  - Use **squash** or **rebase** merge strategies

- [ ] **Do not allow bypassing the above settings** - **GitHub Pro Required**
  - Prevents admins from bypassing (recommended for team repos)
  - For solo repos: Can leave unchecked for flexibility
  - **Not available on free public repos**

- [ ] **Require deployments to succeed before merging** (FREE)
  - Only if you have deployment checks configured

- [ ] **Lock branch** (FREE)
  - Makes branch read-only (extreme protection)
  - **NOT recommended** - prevents legitimate PRs

#### Settings to AVOID

- [ ] ~~Allow force pushes~~
  - Keep this UNCHECKED - force pushes can rewrite history

- [ ] ~~Allow deletions~~
  - Keep this UNCHECKED - prevents accidental deletion

### Step 3: Save Protection Rule

1. Scroll to bottom
2. Click **Create** (or **Save changes** if editing)

### Step 4: Verify Protection

Test that protection works:

```bash
# Try to push directly to main (should fail)
git checkout main
echo "test" >> test.txt
git add test.txt
git commit -m "Test direct commit"
git push origin main
```

Expected result:
```
remote: error: GH006: Protected branch update failed for refs/heads/main.
remote: error: Changes must be made through a pull request.
To https://github.com/SpasticPalate/notez.git
 ! [remote rejected] main -> main (protected branch hook declined)
error: failed to push some refs to 'https://github.com/SpasticPalate/notez.git'
```

✅ **Success!** Branch protection is working.

## Complete Protection Settings (Screenshot Reference)

For the **Notez** repository, the recommended settings are:

```yaml
Branch name pattern: main

✅ Require a pull request before merging
  ✅ Require approvals: 0 (solo dev) or 1+ (team)
  ✅ Dismiss stale pull request approvals when new commits are pushed
  ✅ Require review from Code Owners (if CODEOWNERS file exists)

✅ Require status checks to pass before merging
  ✅ Require branches to be up to date before merging
  ✅ Status checks that are required:
      - build (GitHub Actions)

✅ Require conversation resolution before merging

✅ Require signed commits (optional - extra security)

✅ Require linear history

✅ Require deployments to succeed before merging (if applicable)

✅ Do not allow bypassing the above settings (team repos)

❌ Allow force pushes (UNCHECKED)
  ❌ Everyone
  ❌ Specify who can force push

❌ Allow deletions (UNCHECKED)
```

## Solo Developer Considerations (Free Public Repo)

**IMPORTANT**: Branch protection for **free public repositories** includes:
- ✅ Require pull requests before merging (FREE)
- ✅ Require status checks to pass (FREE)
- ✅ Require linear history (FREE)
- ✅ Block force pushes (FREE)
- ❌ Require approvals - **Requires GitHub Pro** (paid)

If you're the only developer on a free public repo, you can still have effective protection:

**Minimum Protection** (free, still effective):
- ✅ Require a pull request before merging
- ✅ Require status checks to pass (build)
- ❌ Don't require approvals (requires paid plan)
- ❌ Don't block admin bypass (for flexibility)

**Why still use PRs when solo?**
- Creates clear change history
- CI/CD runs before merge
- Can review your own code with fresh eyes
- Professional workflow practice
- Easy to add collaborators later

## Workflows with Branch Protection

### Standard Feature Development

```bash
# 1. Create feature branch
git checkout -b feature/new-feature

# 2. Make changes and commit
git add .
git commit -m "Implement new feature"

# 3. Push feature branch
git push -u origin feature/new-feature

# 4. Create PR via GitHub UI or gh CLI
gh pr create --title "Add new feature"

# 5. Wait for CI/CD to pass
# 6. Review and merge PR (via GitHub UI)

# 7. Delete feature branch
git checkout main
git pull
git branch -d feature/new-feature
```

### Emergency Hotfix (with Protection)

Even with branch protection, you still use the same workflow:

```bash
# 1. Create hotfix branch
git checkout -b hotfix/critical-bug

# 2. Fix the bug
git commit -m "Fix critical security issue"

# 3. Push and create PR
git push -u origin hotfix/critical-bug
gh pr create --title "HOTFIX: Critical security patch"

# 4. Set PR to auto-merge when checks pass
gh pr merge --auto --squash

# 5. Checks pass, PR auto-merges to main
```

**Note**: Even for emergencies, the change still goes through PR + CI/CD. This prevents broken code from reaching main.

## Troubleshooting

### "Protected branch update failed"

**Symptom**: Cannot push to main
```
remote: error: GH006: Protected branch update failed for refs/heads/main.
```

**Solution**: This is working as intended! Create a feature branch and PR instead.

### "Required status checks are not passing"

**Symptom**: Cannot merge PR because CI/CD failed
```
Merging is blocked: Required status check "build" has failed
```

**Solution**: Fix the failing tests/build, push new commits to feature branch. PR updates automatically.

### "Pull request review required"

**Symptom**: Cannot merge own PR
```
Merging is blocked: At least 1 approving review is required
```

**Solutions**:
1. Wait for another developer to review
2. (Solo dev) Adjust settings to require 0 approvals
3. Use a secondary GitHub account to approve (not recommended)

### Admin Bypass Not Working

**Symptom**: Even as admin, cannot push to main
```
remote: error: GH006: Protected branch update failed
```

**Cause**: "Do not allow bypassing the above settings" is enabled

**Solution**:
1. Go to Settings > Branches
2. Edit protection rule
3. Uncheck "Do not allow bypassing the above settings"
4. Save changes

## Comparison: Client vs Server Protection

| Feature | Client-Side Hook | Server-Side Protection |
|---------|------------------|------------------------|
| **Enforcement** | Optional | Mandatory |
| **Bypass** | `--no-verify` flag | Impossible |
| **Setup** | Manual per clone | One-time, applies to all |
| **Feedback** | Immediate (pre-commit) | On push attempt |
| **Audit** | No logs | GitHub audit log |
| **CI/CD Integration** | No | Yes (require checks) |
| **Works on GitHub Desktop** | No | Yes |
| **Works on web editor** | No | Yes |
| **Recommended for** | Developer UX | Security enforcement |

## References

- [GitHub Branch Protection Rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [Required Status Checks](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches#require-status-checks-before-merging)
- [Pull Request Reviews](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/about-pull-request-reviews)

## Related Files

- `.githooks/pre-commit` - Client-side enforcement (complementary)
- `.github/workflows/build.yml` - CI/CD workflow (required status check)
- `.claude/CLAUDE.md` - Workflow rules and guidelines
