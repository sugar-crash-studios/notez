import { useState, useEffect, useCallback, useRef } from 'react';
import { tokensApi } from '../lib/api';
import { useToast } from './Toast';
import { useConfirm } from './ConfirmDialog';
import { QrCodeDisplay } from './QrCodeDisplay';
import {
  Key,
  Copy,
  Trash2,
  Plus,
  Clock,
  Shield,
  Loader2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Check,
} from 'lucide-react';

interface ApiToken {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
}

const SCOPE_OPTIONS = [
  { value: 'read', label: 'Read', description: 'Read notes, tasks, and folders' },
  { value: 'write', label: 'Write', description: 'Create and modify notes and tasks' },
];

const EXPIRY_OPTIONS = [
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: '1y', label: '1 year' },
  { value: '', label: 'Never' },
];

// Auto-clear the raw token after 5 minutes for security
const TOKEN_DISPLAY_TIMEOUT_MS = 5 * 60 * 1000;

export function ApiTokenSettings() {
  const { showToast } = useToast();
  const confirm = useConfirm();

  // Token list state
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Create form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<string[]>(['read']);
  const [expiresIn, setExpiresIn] = useState('90d');
  const [isCreating, setIsCreating] = useState(false);

  // Token reveal state (shown once after creation)
  const [newTokenRaw, setNewTokenRaw] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [expiringWarning, setExpiringWarning] = useState(false);
  // Ref to track copied state inside the auto-dismiss timer callback (avoids stale closure)
  const copiedRef = useRef(false);

  // Revoke loading state
  const [revokingId, setRevokingId] = useState<string | null>(null);

  // Setup guide state
  const [showGuide, setShowGuide] = useState(false);

  // Keep copiedRef in sync so the auto-dismiss timer can read current copied state
  useEffect(() => {
    copiedRef.current = copied;
  }, [copied]);

  const loadTokens = useCallback(async () => {
    try {
      const response = await tokensApi.list();
      setTokens(response.data || []);
    } catch {
      showToast('Failed to load API tokens', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadTokens();
  }, [loadTokens]);

  // Auto-clear the raw token after 5 minutes. Warn at the 30-second mark.
  // visibilitychange is intentionally omitted — users need to switch tabs to paste the token.
  useEffect(() => {
    if (!newTokenRaw) return;

    // Warn the user 30 seconds before the token is hidden
    const warningTimer = setTimeout(() => {
      setExpiringWarning(true);
    }, TOKEN_DISPLAY_TIMEOUT_MS - 30_000);

    const timer = setTimeout(() => {
      // Clear clipboard if the user previously copied the token
      if (copiedRef.current) {
        navigator.clipboard.writeText('').catch(() => {});
      }
      setNewTokenRaw(null);
      setExpiringWarning(false);
    }, TOKEN_DISPLAY_TIMEOUT_MS);

    return () => {
      clearTimeout(warningTimer);
      clearTimeout(timer);
      setExpiringWarning(false);
    };
  }, [newTokenRaw]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      showToast('Token name is required', 'error');
      return;
    }
    if (scopes.length === 0) {
      showToast('Select at least one scope', 'error');
      return;
    }

    setIsCreating(true);
    try {
      const response = await tokensApi.create({
        name: name.trim(),
        scopes,
        expiresIn: expiresIn || null,
      });
      setNewTokenRaw(response.data.rawToken);
      setCopied(false);
      setShowCreateForm(false);
      setName('');
      setScopes(['read']);
      setExpiresIn('90d');
      await loadTokens();
      showToast('API token created', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.message || err.response?.data?.error || 'Failed to create token', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevoke = async (token: ApiToken) => {
    const confirmed = await confirm({
      title: 'Revoke API Token',
      message: `Are you sure you want to revoke "${token.name}"? Any integrations using this token will stop working immediately.`,
      confirmText: 'Revoke',
      variant: 'danger',
    });

    if (!confirmed) return;

    setRevokingId(token.id);
    try {
      await tokensApi.revoke(token.id);
      await loadTokens();
      showToast('Token revoked', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.message || err.response?.data?.error || 'Failed to revoke token', 'error');
    } finally {
      setRevokingId(null);
    }
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      showToast('Token copied to clipboard', 'success');
      setTimeout(() => setCopied(false), 3000);
    } catch {
      showToast('Failed to copy — please select and copy manually', 'error');
    }
  };

  const toggleScope = (scope: string) => {
    setScopes((prev) =>
      prev.includes(scope)
        ? prev.filter((s) => s !== scope)
        : [...prev, scope]
    );
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const activeTokens = tokens.filter((t) => !t.revokedAt);
  const revokedTokens = tokens.filter((t) => t.revokedAt);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
        <span className="ml-2 text-gray-600 dark:text-gray-400">Loading tokens...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Token reveal banner */}
      {newTokenRaw && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              {/* role="alert" on wrapper div announces only the heading, not the raw token */}
              <div role="alert">
                <h3 className="font-semibold text-amber-800 dark:text-amber-200">
                  Store this token — it won't be shown again
                </h3>
              </div>
              {/*
                Mobile: token+copy row appears first (order-last on QR), then QR below.
                Desktop: QR on the left (order-first), token+copy on the right.
              */}
              <div className="mt-3 flex flex-col md:flex-row md:items-start gap-4">
                <QrCodeDisplay
                  value={newTokenRaw}
                  caption="Scan to copy token"
                  className="order-last md:order-first"
                />
                <div className="flex-1 min-w-0 order-first md:order-last">
                  <div className="flex items-center space-x-2">
                    <span className="sr-only">Token value available via copy button</span>
                    <code
                      aria-hidden="true"
                      className="flex-1 bg-white dark:bg-gray-900 border border-amber-200 dark:border-amber-700 rounded px-3 py-2 text-sm font-mono text-gray-900 dark:text-gray-100 break-all select-all"
                    >
                      {newTokenRaw}
                    </code>
                    <button
                      onClick={() => handleCopy(newTokenRaw)}
                      className="flex-shrink-0 p-2 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-800/30 rounded transition-colors"
                      aria-label={copied ? 'Copied' : 'Copy token to clipboard'}
                    >
                      <span className="transition-colors duration-150">
                        {copied ? <Check className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5" />}
                      </span>
                    </button>
                  </div>
                  <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
                    Copy this token or scan the QR code with a compatible mobile app.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setNewTokenRaw(null)}
                className="mt-3 inline-flex items-center px-3 py-1.5 border border-amber-300 dark:border-amber-600 rounded-md text-sm font-medium text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-800/30 transition-colors"
              >
                I've saved this token
              </button>
              {expiringWarning && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                  Token will be hidden soon — save it now.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header + Create button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          API tokens allow external tools like Claude Code to access your notes and tasks via the MCP server.
        </p>
        {!showCreateForm && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors flex-shrink-0 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>New Token</span>
          </button>
        )}
      </div>

      {/* Create form */}
      {showCreateForm && (
        <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
          <h3 className="font-medium text-gray-900 dark:text-white mb-4">Create API Token</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            {/* Name */}
            <div>
              <label htmlFor="token-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Token Name
              </label>
              <input
                id="token-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Claude Code - Laptop"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                maxLength={100}
                autoFocus
              />
            </div>

            {/* Scopes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Permissions
              </label>
              <div className="space-y-2">
                {SCOPE_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className="flex items-start space-x-3 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={scopes.includes(option.value)}
                      onChange={() => toggleScope(option.value)}
                      className="mt-0.5 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {option.label}
                      </span>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{option.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Expiry */}
            <div>
              <label htmlFor="token-expiry" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Expiration
              </label>
              <select
                id="token-expiry"
                value={expiresIn}
                onChange={(e) => setExpiresIn(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {EXPIRY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-3 pt-2">
              <button
                type="submit"
                disabled={isCreating}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isCreating && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{isCreating ? 'Creating...' : 'Create Token'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setName('');
                  setScopes(['read']);
                  setExpiresIn('90d');
                }}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Token list */}
      {activeTokens.length === 0 && revokedTokens.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
          <Key className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          <h3 className="text-gray-900 dark:text-white font-medium mb-1">No API tokens yet</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
            Create a token to connect Claude Code or other MCP clients to your Notez instance.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeTokens.map((token) => (
            <TokenRow
              key={token.id}
              token={token}
              onRevoke={handleRevoke}
              isRevoking={revokingId === token.id}
              formatDate={formatDate}
            />
          ))}
          {revokedTokens.length > 0 && (
            <div className="pt-2">
              <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider font-medium mb-2">
                Revoked
              </p>
              {revokedTokens.map((token) => (
                <TokenRow
                  key={token.id}
                  token={token}
                  onRevoke={handleRevoke}
                  isRevoking={false}
                  formatDate={formatDate}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Setup guide */}
      <div className="border border-gray-200 dark:border-gray-600 rounded-lg">
        <button
          onClick={() => setShowGuide(!showGuide)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors rounded-lg"
          aria-expanded={showGuide}
        >
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Setup Guide — Connect Claude Code to Notez
          </span>
          {showGuide ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </button>
        {showGuide && (
          <div className="px-4 pb-4 space-y-4 text-sm text-gray-600 dark:text-gray-400">
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-1">1. Create a token</h4>
              <p>Click "New Token" above. For Claude Code, select both Read and Write permissions.</p>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-1">2. Add to Claude Code settings</h4>
              <p className="mb-2">
                Add the following to your Claude Code MCP settings file (<code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-xs">claude_desktop_config.json</code> or <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-xs">.claude.json</code>):
              </p>
              <pre className="bg-gray-100 dark:bg-gray-800 rounded-md p-3 overflow-x-auto text-xs font-mono">
{`{
  "mcpServers": {
    "notez": {
      "command": "npx",
      "args": ["-y", "notez-mcp"],
      "env": {
        "NOTEZ_URL": "https://your-notez-instance.com",
        "NOTEZ_API_TOKEN": "ntez_your_token_here"
      }
    }
  }
}`}
              </pre>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-1">3. Start using it</h4>
              <p>
                Restart Claude Code. You can now ask Claude to search, read, and create notes and tasks in your Notez instance.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TokenRow({
  token,
  onRevoke,
  isRevoking,
  formatDate,
}: {
  token: ApiToken;
  onRevoke: (token: ApiToken) => void;
  isRevoking: boolean;
  formatDate: (date: string) => string;
}) {
  const isRevoked = !!token.revokedAt;
  const isExpired = token.expiresAt && new Date(token.expiresAt) < new Date();

  return (
    <div
      className={`flex items-center justify-between p-3 border rounded-lg ${
        isRevoked
          ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 opacity-60'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center space-x-2">
          <Key className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <span className={`font-medium text-sm ${isRevoked ? 'line-through text-gray-400' : 'text-gray-900 dark:text-white'}`}>
            {token.name}
          </span>
          <code className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
            {token.prefix}...
          </code>
        </div>
        <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-gray-500 dark:text-gray-400">
          {/* Scopes */}
          <span className="flex items-center space-x-1">
            <Shield className="w-3 h-3" />
            <span>{token.scopes.join(', ')}</span>
          </span>

          {/* Created */}
          <span className="flex items-center space-x-1">
            <Clock className="w-3 h-3" />
            <span>Created {formatDate(token.createdAt)}</span>
          </span>

          {/* Last used */}
          {token.lastUsedAt && (
            <span>Used {formatDate(token.lastUsedAt)}</span>
          )}

          {/* Expiry */}
          {token.expiresAt && (
            <span className={isExpired ? 'text-red-500 dark:text-red-400' : ''}>
              {isExpired ? 'Expired' : `Expires ${formatDate(token.expiresAt)}`}
            </span>
          )}

          {/* Revoked */}
          {isRevoked && (
            <span className="text-red-500 dark:text-red-400">
              Revoked {formatDate(token.revokedAt!)}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      {!isRevoked && (
        <button
          onClick={() => onRevoke(token)}
          disabled={isRevoking}
          className="flex-shrink-0 ml-3 p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
          aria-label={`Revoke token ${token.name}`}
        >
          {isRevoking ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Trash2 className="w-4 h-4" />
          )}
        </button>
      )}
    </div>
  );
}
