import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// Domain allowlist matching the backend's ALLOWED_REDIRECT_DOMAINS
const ALLOWED_REDIRECT_DOMAINS = [
  'claude.ai',
  'www.claude.ai',
  'anthropic.com',
  'www.anthropic.com',
];

function isAllowedRedirectUri(uri: string): boolean {
  try {
    const parsed = new URL(uri);
    if (parsed.protocol !== 'https:') return false;
    if (parsed.username || parsed.password) return false;
    const hostname = parsed.hostname.toLowerCase();
    // Exact domain match only (no subdomain wildcards) - mirrors backend validateRedirectUri
    return ALLOWED_REDIRECT_DOMAINS.includes(hostname);
  } catch {
    return false;
  }
}

const SUPPORTED_SCOPES = ['mcp:read', 'mcp:write'];

/**
 * OAuth consent page for remote MCP connectors.
 * Displayed when an external app (claude.ai) requests access to Notez.
 * Users see the app name, requested permissions, and approve/deny.
 */
export function OAuthConsentPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  const clientId = searchParams.get('client_id') || '';
  const redirectUri = searchParams.get('redirect_uri') || '';
  const scope = searchParams.get('scope') || 'mcp:read';
  const codeChallenge = searchParams.get('code_challenge') || '';
  const codeChallengeMethod = searchParams.get('code_challenge_method') || 'S256';
  const state = searchParams.get('state') || '';

  // Validate redirect URI domain (mirrors backend allowlist)
  const isValidRedirectUri = isAllowedRedirectUri(redirectUri);

  // Parse redirect URI domain for display
  let redirectDomain = '';
  try {
    redirectDomain = new URL(redirectUri).hostname;
  } catch {
    redirectDomain = 'unknown';
  }

  // Parse scopes into human-readable descriptions
  const scopeDescriptions: Record<string, string> = {
    'mcp:read': 'Read your notes, tasks, folders, and tags',
    'mcp:write': 'Create, edit, and delete your notes, tasks, folders, and tags',
  };

  const requestedScopes = scope.split(' ').filter(Boolean);
  const hasUnknownScopes = requestedScopes.some((s) => !SUPPORTED_SCOPES.includes(s));

  // If not logged in, redirect to login with return URL
  useEffect(() => {
    if (!authLoading && !user) {
      const returnUrl = window.location.pathname + window.location.search;
      navigate(`/login?redirect=${encodeURIComponent(returnUrl)}`);
    }
  }, [authLoading, user, navigate]);

  // Focus error message when it appears
  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.focus();
    }
  }, [error]);

  // Update document title
  useEffect(() => {
    document.title = 'Authorize Connection - Notez';
    return () => { document.title = 'Notez'; };
  }, []);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <p role="status" aria-live="polite" className="text-gray-600 dark:text-gray-400">Loading...</p>
      </div>
    );
  }

  if (!clientId || !redirectUri || !codeChallenge || !isValidRedirectUri) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="max-w-md mx-auto bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h1 className="text-xl font-semibold text-red-600 dark:text-red-400 mb-2">Invalid Request</h1>
          <p className="text-gray-600 dark:text-gray-400">
            This authorization request is missing required parameters or contains an invalid redirect destination.
          </p>
        </div>
      </div>
    );
  }

  async function handleApprove() {
    setSubmitting(true);
    setError(null);

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('/mcp/oauth/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          client_id: clientId,
          redirect_uri: redirectUri,
          scope,
          state,
          code_challenge: codeChallenge,
          code_challenge_method: codeChallengeMethod,
        }),
      });

      if (response.redirected) {
        // Server sent a redirect to the client's callback
        window.location.href = response.url;
        return;
      }

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error_description || data.message || 'Authorization failed');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleDeny() {
    // Validate redirect URI before navigating (prevent open redirect)
    if (!isAllowedRedirectUri(redirectUri)) {
      navigate('/');
      return;
    }

    try {
      const url = new URL(redirectUri);
      url.searchParams.set('error', 'access_denied');
      url.searchParams.set('error_description', 'User denied the authorization request');
      if (state) url.searchParams.set('state', state);
      window.location.href = url.toString();
    } catch {
      navigate('/');
    }
  }

  const currentReturnUrl = window.location.pathname + window.location.search;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            Authorize Connection
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            An application is requesting access to your Notez account
          </p>
        </div>

        {/* Client info */}
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-6">
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Connecting to</div>
          <div className="font-medium text-gray-900 dark:text-white">{redirectDomain}</div>
        </div>

        {/* Requested permissions */}
        <div className="mb-6">
          <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            This app will be able to:
          </h2>
          <ul className="space-y-2">
            {requestedScopes.map((s) => (
              <li key={s} className="flex items-start gap-2">
                {SUPPORTED_SCOPES.includes(s) ? (
                  <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                )}
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {scopeDescriptions[s] || `Unknown permission: ${s}`}
                </span>
              </li>
            ))}
          </ul>
          {hasUnknownScopes && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
              This request includes unrecognized permissions. Proceed with caution.
            </p>
          )}
        </div>

        {/* Mobile propagation disclosure */}
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-6">
          <p className="text-sm text-amber-800 dark:text-amber-300">
            Once approved, this connection will work across all devices where you use the connecting app, including mobile.
          </p>
        </div>

        {/* Account confirmation */}
        <div className="text-center text-sm text-gray-500 dark:text-gray-400 mb-6">
          Signed in as <span className="font-medium text-gray-900 dark:text-white">{user.username}</span>
          {' '}
          <a
            href={`/login?redirect=${encodeURIComponent(currentReturnUrl)}`}
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            Switch account
          </a>
        </div>

        {/* Error message */}
        {error && (
          <div
            ref={errorRef}
            role="alert"
            tabIndex={-1}
            className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4"
          >
            <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Action buttons - Deny equally prominent (no dark patterns) */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleDeny}
            disabled={submitting}
            className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Deny
          </button>
          <button
            type="button"
            onClick={handleApprove}
            disabled={submitting}
            aria-busy={submitting}
            className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Authorizing...' : 'Approve'}
          </button>
        </div>
      </div>
    </div>
  );
}
