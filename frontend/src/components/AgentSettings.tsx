import { useState, useEffect, useCallback, useRef } from 'react';
import { agentTokensApi } from '../lib/api';
import { useToast } from './Toast';
import { useConfirm } from './ConfirmDialog';
import { QrCodeDisplay } from './QrCodeDisplay';
import {
  Bot,
  Cpu,
  Brain,
  Sparkles,
  Wand2,
  Zap,
  Cog,
  Terminal,
  Code,
  Cloud,
  Globe,
  Rocket,
  Shield,
  Eye,
  Star,
  Hexagon,
  Plus,
  Copy,
  Trash2,
  Pencil,
  Loader2,
  AlertTriangle,
  Check,
  Clock,
  X,
  type LucideIcon,
} from 'lucide-react';

// ─── Agent icon map (must match backend AGENT_ICONS) ──────────────────────

const AGENT_ICON_MAP: Record<string, LucideIcon> = {
  'bot': Bot,
  'cpu': Cpu,
  'brain': Brain,
  'sparkles': Sparkles,
  'wand-2': Wand2,
  'zap': Zap,
  'cog': Cog,
  'terminal': Terminal,
  'code': Code,
  'cloud': Cloud,
  'globe': Globe,
  'rocket': Rocket,
  'shield': Shield,
  'eye': Eye,
  'star': Star,
  'hexagon': Hexagon,
};

const AGENT_ICONS = Object.keys(AGENT_ICON_MAP);

// ─── Color presets ────────────────────────────────────────────────────────

const AGENT_COLORS = [
  { value: '#8B5CF6', label: 'Purple' },
  { value: '#3B82F6', label: 'Blue' },
  { value: '#06B6D4', label: 'Cyan' },
  { value: '#10B981', label: 'Green' },
  { value: '#F59E0B', label: 'Amber' },
  { value: '#EF4444', label: 'Red' },
  { value: '#EC4899', label: 'Pink' },
  { value: '#F97316', label: 'Orange' },
  { value: '#6366F1', label: 'Indigo' },
  { value: '#14B8A6', label: 'Teal' },
  { value: '#64748B', label: 'Slate' },
  { value: '#84CC16', label: 'Lime' },
];

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

// ─── Types ────────────────────────────────────────────────────────────────

interface AgentToken {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  isAgent: boolean;
  agentName: string;
  agentIcon: string;
  agentColor: string;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
}

// ─── Helper: render agent icon ────────────────────────────────────────────

function AgentIcon({ icon, className = 'w-4 h-4' }: { icon: string; className?: string }) {
  const IconComponent = AGENT_ICON_MAP[icon] || Bot;
  return <IconComponent className={className} />;
}

// ─── Icon Picker ──────────────────────────────────────────────────────────

function AgentIconPicker({
  selectedIcon,
  onSelectIcon,
  color,
}: {
  selectedIcon: string;
  onSelectIcon: (icon: string) => void;
  color: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 rounded-full flex items-center justify-center text-white transition-transform hover:scale-110"
        style={{ backgroundColor: color }}
        title="Select agent icon"
      >
        <AgentIcon icon={selectedIcon} className="w-5 h-5" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute z-20 mt-1 left-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-2 w-48">
            <div className="grid grid-cols-4 gap-1">
              {AGENT_ICONS.map((iconName) => {
                const isSelected = iconName === selectedIcon;
                return (
                  <button
                    key={iconName}
                    type="button"
                    onClick={() => {
                      onSelectIcon(iconName);
                      setIsOpen(false);
                    }}
                    className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                      isSelected
                        ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}
                    title={iconName}
                  >
                    <AgentIcon icon={iconName} className="w-5 h-5" />
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Color Picker ─────────────────────────────────────────────────────────

function AgentColorPicker({
  selectedColor,
  onSelectColor,
}: {
  selectedColor: string;
  onSelectColor: (color: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-8 h-8 rounded-full border-2 border-gray-300 dark:border-gray-600 transition-transform hover:scale-110"
        style={{ backgroundColor: selectedColor }}
        title="Select agent color"
      />

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute z-20 mt-1 left-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-2 w-40">
            <div className="grid grid-cols-4 gap-1.5">
              {AGENT_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => {
                    onSelectColor(c.value);
                    setIsOpen(false);
                  }}
                  className={`w-7 h-7 rounded-full transition-transform hover:scale-110 ${
                    c.value === selectedColor ? 'ring-2 ring-offset-2 ring-blue-500 dark:ring-offset-gray-800' : ''
                  }`}
                  style={{ backgroundColor: c.value }}
                  title={c.label}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────

export function AgentSettings() {
  const { showToast } = useToast();
  const confirm = useConfirm();

  // Agent list state
  const [agents, setAgents] = useState<AgentToken[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Create form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [agentName, setAgentName] = useState('');
  const [tokenName, setTokenName] = useState('');
  const [agentIcon, setAgentIcon] = useState('bot');
  const [agentColor, setAgentColor] = useState('#8B5CF6');
  const [scopes, setScopes] = useState<string[]>(['read', 'write']);
  const [expiresIn, setExpiresIn] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Token reveal state
  const [newTokenRaw, setNewTokenRaw] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [expiringWarning, setExpiringWarning] = useState(false);
  const copiedRef = useRef(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editAgentName, setEditAgentName] = useState('');
  const [editIcon, setEditIcon] = useState('');
  const [editColor, setEditColor] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Revoke state
  const [revokingId, setRevokingId] = useState<string | null>(null);

  useEffect(() => {
    copiedRef.current = copied;
  }, [copied]);

  const loadAgents = useCallback(async () => {
    try {
      const response = await agentTokensApi.list();
      setAgents(response.data || []);
    } catch {
      showToast('Failed to load agents', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  // Auto-clear raw token after 5 minutes
  useEffect(() => {
    if (!newTokenRaw) return;

    const warningTimer = setTimeout(() => {
      setExpiringWarning(true);
    }, TOKEN_DISPLAY_TIMEOUT_MS - 30_000);

    const timer = setTimeout(() => {
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

  const resetCreateForm = () => {
    setShowCreateForm(false);
    setAgentName('');
    setTokenName('');
    setAgentIcon('bot');
    setAgentColor('#8B5CF6');
    setScopes(['read', 'write']);
    setExpiresIn('');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!agentName.trim()) {
      showToast('Agent name is required', 'error');
      return;
    }
    if (scopes.length === 0) {
      showToast('Select at least one scope', 'error');
      return;
    }

    setIsCreating(true);
    try {
      const response = await agentTokensApi.create({
        name: tokenName.trim() || agentName.trim(),
        scopes,
        expiresIn: expiresIn || null,
        agentName: agentName.trim(),
        agentIcon,
        agentColor,
      });
      setNewTokenRaw(response.data.rawToken);
      setCopied(false);
      resetCreateForm();
      await loadAgents();
      showToast('Agent created', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to create agent', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleEdit = (agent: AgentToken) => {
    setEditingId(agent.id);
    setEditName(agent.name);
    setEditAgentName(agent.agentName);
    setEditIcon(agent.agentIcon);
    setEditColor(agent.agentColor);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editAgentName.trim()) return;

    setIsSaving(true);
    try {
      await agentTokensApi.update(editingId, {
        name: editName.trim() || undefined,
        agentName: editAgentName.trim(),
        agentIcon: editIcon,
        agentColor: editColor,
      });
      setEditingId(null);
      await loadAgents();
      showToast('Agent updated', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to update agent', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRevoke = async (agent: AgentToken) => {
    const confirmed = await confirm({
      title: 'Revoke Agent',
      message: `Are you sure you want to revoke "${agent.agentName}"? Any integrations using this agent's token will stop working immediately.`,
      confirmText: 'Revoke',
      variant: 'danger',
    });

    if (!confirmed) return;

    setRevokingId(agent.id);
    try {
      await agentTokensApi.revoke(agent.id);
      await loadAgents();
      showToast('Agent revoked', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to revoke agent', 'error');
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

  const activeAgents = agents.filter((a) => !a.revokedAt);
  const revokedAgents = agents.filter((a) => a.revokedAt);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
        <span className="ml-2 text-gray-600 dark:text-gray-400">Loading agents...</span>
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
              <div role="alert">
                <h3 className="font-semibold text-amber-800 dark:text-amber-200">
                  Store this token — it won't be shown again
                </h3>
              </div>
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
                      {copied ? <Check className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5" />}
                    </button>
                  </div>
                  <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
                    Use this token in your MCP client configuration.
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
          Agents are named API tokens with a custom icon and color. Content they create is automatically attributed.
        </p>
        {!showCreateForm && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors flex-shrink-0 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>New Agent</span>
          </button>
        )}
      </div>

      {/* Create form */}
      {showCreateForm && (
        <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
          <h3 className="font-medium text-gray-900 dark:text-white mb-4">Create Agent</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            {/* Agent identity row: icon + name */}
            <div className="flex items-start space-x-4">
              <div className="flex flex-col items-center space-y-2">
                <AgentIconPicker
                  selectedIcon={agentIcon}
                  onSelectIcon={setAgentIcon}
                  color={agentColor}
                />
                <AgentColorPicker
                  selectedColor={agentColor}
                  onSelectColor={setAgentColor}
                />
              </div>
              <div className="flex-1">
                <label htmlFor="agent-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Agent Name
                </label>
                <input
                  id="agent-name"
                  type="text"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder="e.g., Claude Desktop"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  maxLength={50}
                  autoFocus
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Letters, numbers, spaces, hyphens, underscores, and periods only.
                </p>
              </div>
            </div>

            {/* Token name (optional, defaults to agent name) */}
            <div>
              <label htmlFor="agent-token-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Token Label <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                id="agent-token-name"
                type="text"
                value={tokenName}
                onChange={(e) => setTokenName(e.target.value)}
                placeholder={agentName || 'Defaults to agent name'}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                maxLength={100}
              />
            </div>

            {/* Scopes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Permissions
              </label>
              <div className="space-y-2">
                {SCOPE_OPTIONS.map((option) => (
                  <label key={option.value} className="flex items-start space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={scopes.includes(option.value)}
                      onChange={() => toggleScope(option.value)}
                      className="mt-0.5 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{option.label}</span>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{option.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Expiry */}
            <div>
              <label htmlFor="agent-expiry" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Expiration
              </label>
              <select
                id="agent-expiry"
                value={expiresIn}
                onChange={(e) => setExpiresIn(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {EXPIRY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
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
                <span>{isCreating ? 'Creating...' : 'Create Agent'}</span>
              </button>
              <button
                type="button"
                onClick={resetCreateForm}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Agent list */}
      {activeAgents.length === 0 && revokedAgents.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
          <Bot className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          <h3 className="text-gray-900 dark:text-white font-medium mb-1">No agents yet</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
            Create an agent to give your AI tools a named identity. Content they create will be attributed automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeAgents.map((agent) => (
            editingId === agent.id ? (
              <AgentEditRow
                key={agent.id}
                editName={editName}
                editAgentName={editAgentName}
                editIcon={editIcon}
                editColor={editColor}
                onEditName={setEditName}
                onEditAgentName={setEditAgentName}
                onEditIcon={setEditIcon}
                onEditColor={setEditColor}
                onSave={handleSaveEdit}
                onCancel={() => setEditingId(null)}
                isSaving={isSaving}
              />
            ) : (
              <AgentCard
                key={agent.id}
                agent={agent}
                onEdit={handleEdit}
                onRevoke={handleRevoke}
                isRevoking={revokingId === agent.id}
                formatDate={formatDate}
              />
            )
          ))}
          {revokedAgents.length > 0 && (
            <div className="pt-2">
              <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider font-medium mb-2">
                Revoked
              </p>
              {revokedAgents.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  onEdit={handleEdit}
                  onRevoke={handleRevoke}
                  isRevoking={false}
                  formatDate={formatDate}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Agent Card ───────────────────────────────────────────────────────────

function AgentCard({
  agent,
  onEdit,
  onRevoke,
  isRevoking,
  formatDate,
}: {
  agent: AgentToken;
  onEdit: (agent: AgentToken) => void;
  onRevoke: (agent: AgentToken) => void;
  isRevoking: boolean;
  formatDate: (date: string) => string;
}) {
  const isRevoked = !!agent.revokedAt;
  const isExpired = agent.expiresAt && new Date(agent.expiresAt) < new Date();

  return (
    <div
      className={`flex items-center justify-between p-3 border rounded-lg ${
        isRevoked
          ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 opacity-60'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
      }`}
    >
      <div className="flex items-center space-x-3 min-w-0 flex-1">
        {/* Agent icon circle */}
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-white flex-shrink-0"
          style={{ backgroundColor: agent.agentColor }}
        >
          <AgentIcon icon={agent.agentIcon} className="w-5 h-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center space-x-2">
            <span className={`font-medium text-sm ${isRevoked ? 'line-through text-gray-400' : 'text-gray-900 dark:text-white'}`}>
              {agent.agentName}
            </span>
            <code className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
              {agent.prefix}...
            </code>
          </div>
          <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center space-x-1">
              <Shield className="w-3 h-3" />
              <span>{agent.scopes.join(', ')}</span>
            </span>
            <span className="flex items-center space-x-1">
              <Clock className="w-3 h-3" />
              <span>Created {formatDate(agent.createdAt)}</span>
            </span>
            {agent.lastUsedAt && (
              <span>Used {formatDate(agent.lastUsedAt)}</span>
            )}
            {agent.expiresAt && (
              <span className={isExpired ? 'text-red-500 dark:text-red-400' : ''}>
                {isExpired ? 'Expired' : `Expires ${formatDate(agent.expiresAt)}`}
              </span>
            )}
            {isRevoked && (
              <span className="text-red-500 dark:text-red-400">
                Revoked {formatDate(agent.revokedAt!)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      {!isRevoked && (
        <div className="flex items-center space-x-1 flex-shrink-0 ml-3">
          <button
            onClick={() => onEdit(agent)}
            className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
            aria-label={`Edit agent ${agent.agentName}`}
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => onRevoke(agent)}
            disabled={isRevoking}
            className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
            aria-label={`Revoke agent ${agent.agentName}`}
          >
            {isRevoking ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Agent Edit Row ───────────────────────────────────────────────────────

function AgentEditRow({
  editName,
  editAgentName,
  editIcon,
  editColor,
  onEditName,
  onEditAgentName,
  onEditIcon,
  onEditColor,
  onSave,
  onCancel,
  isSaving,
}: {
  editName: string;
  editAgentName: string;
  editIcon: string;
  editColor: string;
  onEditName: (name: string) => void;
  onEditAgentName: (name: string) => void;
  onEditIcon: (icon: string) => void;
  onEditColor: (color: string) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  return (
    <div className="border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/10 rounded-lg p-4 space-y-3">
      <div className="flex items-start space-x-4">
        <div className="flex flex-col items-center space-y-2">
          <AgentIconPicker
            selectedIcon={editIcon}
            onSelectIcon={onEditIcon}
            color={editColor}
          />
          <AgentColorPicker
            selectedColor={editColor}
            onSelectColor={onEditColor}
          />
        </div>
        <div className="flex-1 space-y-3">
          <div>
            <label htmlFor="edit-agent-name" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Agent Name
            </label>
            <input
              id="edit-agent-name"
              type="text"
              value={editAgentName}
              onChange={(e) => onEditAgentName(e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              maxLength={50}
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="edit-token-name" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Token Label
            </label>
            <input
              id="edit-token-name"
              type="text"
              value={editName}
              onChange={(e) => onEditName(e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              maxLength={100}
            />
          </div>
        </div>
      </div>
      <div className="flex items-center space-x-2 justify-end">
        <button
          onClick={onCancel}
          disabled={isSaving}
          className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded transition-colors"
          aria-label="Cancel editing"
        >
          <X className="w-4 h-4" />
        </button>
        <button
          onClick={onSave}
          disabled={isSaving || !editAgentName.trim()}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          <span>{isSaving ? 'Saving...' : 'Save'}</span>
        </button>
      </div>
    </div>
  );
}
