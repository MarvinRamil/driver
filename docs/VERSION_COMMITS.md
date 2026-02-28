# Version Commits

The CI pipeline automatically bumps the app version based on **keywords in your commit message**. Include the right keyword to control the version bump.

## Quick Reference

| Keyword | Bump Type | Example |
|---------|-----------|---------|
| `major`, `major release`, `[major]`, `(major)` | **Major** | 1.0.1 → 2.0.0 |
| `version upgrade`, `[minor]`, `(minor)` | **Minor** | 1.0.1 → 1.1.0 |
| `patch`, `[patch]`, `(patch)` | **Patch** | 1.0.1 → 1.0.2 |
| *(no keyword)* | **Patch** (default) | 1.0.1 → 1.0.2 |

**Priority:** First match wins. If multiple keywords appear, major > minor > patch.

## When to Use Each

### Patch (bug fixes, small changes)
```
fix: resolve crash on login [patch]
fix: typo in error message (patch)
chore: update dependencies patch
```

### Minor / Version Upgrade (new features, no breaking changes)
```
feat: add dark mode - Version upgrade
feat: new booking filters [minor]
feat: improve map performance (minor)
```

### Major (breaking changes, major releases)
```
BREAKING: New API - Major release
feat!: redesign auth flow [major]
chore: drop legacy support (major)
```

## Examples

| Commit Message | Current | New Version |
|----------------|---------|-------------|
| `fix: login bug` | 1.0.1 | 1.0.2 |
| `fix: crash [patch]` | 1.0.1 | 1.0.2 |
| `feat: dark mode Version upgrade` | 1.0.1 | 1.1.0 |
| `feat: new API [minor]` | 1.0.1 | 1.1.0 |
| `BREAKING: Major release` | 1.0.1 | 2.0.0 |
| `chore: bump [major]` | 1.0.1 | 2.0.0 |

## Notes

- Keywords are **case-insensitive** (e.g. `PATCH`, `patch`, `Patch` all work)
- Both `CI_COMMIT_MESSAGE` and `CI_COMMIT_TITLE` are checked
- Applies to all branches: `main`, `master`, `dev`, `features`
