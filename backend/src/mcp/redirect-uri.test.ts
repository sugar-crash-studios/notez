import { describe, it, expect, vi } from 'vitest';

// Need to mock all oauth.service dependencies even though we only test validateRedirectUri
vi.mock('../lib/db.js', () => ({
  prisma: {
    oAuthClient: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn(), count: vi.fn().mockResolvedValue(0), deleteMany: vi.fn() },
    oAuthAuthorizationCode: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
    oAuthAccessToken: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
    oAuthUserConsent: { findUnique: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
  },
}));
vi.mock('bcrypt', () => ({
  default: { hash: vi.fn(), compare: vi.fn() },
}));

import { validateRedirectUri } from './oauth.service.js';

describe('validateRedirectUri (tightened allowlist)', () => {
  it('accepts exact allowed domains', () => {
    expect(validateRedirectUri('https://claude.ai/callback')).toBe(true);
    expect(validateRedirectUri('https://www.claude.ai/oauth/callback')).toBe(true);
    expect(validateRedirectUri('https://anthropic.com/callback')).toBe(true);
    expect(validateRedirectUri('https://www.anthropic.com/auth')).toBe(true);
  });

  it('rejects arbitrary subdomains (no wildcard)', () => {
    // These would have been accepted with the old broad subdomain matching
    expect(validateRedirectUri('https://evil.claude.ai/callback')).toBe(false);
    expect(validateRedirectUri('https://app.anthropic.com/auth')).toBe(false);
    expect(validateRedirectUri('https://subdomain.subdomain.claude.ai/x')).toBe(false);
  });

  it('rejects HTTP', () => {
    expect(validateRedirectUri('http://claude.ai/callback')).toBe(false);
  });

  it('rejects non-allowlisted domains', () => {
    expect(validateRedirectUri('https://evil.com/callback')).toBe(false);
    expect(validateRedirectUri('https://notclaude.ai/callback')).toBe(false);
  });

  it('rejects URIs with credentials', () => {
    expect(validateRedirectUri('https://user:pass@claude.ai/callback')).toBe(false);
  });

  it('rejects javascript: and data: URIs', () => {
    expect(validateRedirectUri('javascript:alert(1)')).toBe(false);
    expect(validateRedirectUri('data:text/html,<script>alert(1)</script>')).toBe(false);
  });

  it('rejects invalid URIs', () => {
    expect(validateRedirectUri('not-a-url')).toBe(false);
    expect(validateRedirectUri('')).toBe(false);
  });
});
