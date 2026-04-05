import { useState, useEffect } from 'react';
import { Bot, FileText, Folder, Tag, CheckSquare, AlertTriangle, ShieldOff } from 'lucide-react';
import { serviceAccountsApi, type ServiceAccountStat } from '../lib/api';

// Health badge thresholds
const TOKEN_EXPIRY_WARNING_DAYS = 7;
const DORMANCY_WARNING_DAYS = 30;

interface HealthWarning {
  type: 'token-expiring' | 'dormant' | 'no-tokens';
  message: string;
  severity: 'amber' | 'red';
}

function getRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function getHealthWarnings(stat: ServiceAccountStat): HealthWarning[] {
  const warnings: HealthWarning[] = [];
  const now = new Date();

  if (stat.tokenCount === 0) {
    warnings.push({
      type: 'no-tokens',
      message: 'No active tokens',
      severity: 'red',
    });
  }

  if (stat.earliestTokenExpiry) {
    const expiry = new Date(stat.earliestTokenExpiry);
    const daysUntilExpiry = Math.floor((expiry.getTime() - now.getTime()) / 86400000);
    if (daysUntilExpiry < 0) {
      warnings.push({
        type: 'token-expiring',
        message: `Token expired ${Math.abs(daysUntilExpiry)}d ago`,
        severity: 'red',
      });
    } else if (daysUntilExpiry <= TOKEN_EXPIRY_WARNING_DAYS) {
      warnings.push({
        type: 'token-expiring',
        message: `Token expires in ${daysUntilExpiry}d`,
        severity: 'amber',
      });
    }
  }

  if (stat.lastActivity) {
    const lastActive = new Date(stat.lastActivity);
    const daysSinceActive = Math.floor((now.getTime() - lastActive.getTime()) / 86400000);
    if (daysSinceActive > DORMANCY_WARNING_DAYS) {
      warnings.push({
        type: 'dormant',
        message: `Inactive ${daysSinceActive}d`,
        severity: 'amber',
      });
    }
  }

  return warnings;
}

interface ServiceAccountDashboardProps {
  onSelectAccount: (accountId: string, username: string) => void;
}

export function ServiceAccountDashboard({ onSelectAccount }: ServiceAccountDashboardProps) {
  const [stats, setStats] = useState<ServiceAccountStat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchStats() {
      try {
        setIsLoading(true);
        const response = await serviceAccountsApi.stats();
        if (!cancelled) {
          setStats(response.data.stats);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError('Failed to load service account stats');
          if (import.meta.env.DEV) console.error(err);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    fetchStats();
    return () => { cancelled = true; };
  }, []);

  if (isLoading) {
    return (
      <div className="p-4 space-y-4" role="status" aria-label="Loading service accounts">
        <h2 className="font-semibold text-gray-900 dark:text-white">Service Accounts</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="animate-pulse bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 h-48" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Service Accounts</h2>
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>
      </div>
    );
  }

  if (stats.length === 0) {
    return (
      <div className="p-4">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Service Accounts</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">No service accounts found.</p>
      </div>
    );
  }

  return (
    <div className="p-4 h-full overflow-y-auto">
      <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Service Accounts</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {stats.map((stat) => {
          const warnings = getHealthWarnings(stat);
          return (
            <button
              key={stat.id}
              onClick={() => onSelectAccount(stat.id, stat.username)}
              aria-label={`View service account ${stat.username}`}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-left hover:border-blue-300 dark:hover:border-blue-600 hover:bg-gray-50 dark:hover:bg-gray-750 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none transition-all"
            >
              {/* Header */}
              <div className="flex items-center gap-2 mb-3">
                <Bot className="w-5 h-5 text-purple-500 dark:text-purple-400" />
                <span className="font-medium text-gray-900 dark:text-white">{stat.username}</span>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
                <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                  <FileText className="w-3.5 h-3.5" />
                  <span>{stat.noteCount} notes</span>
                </div>
                <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                  <Folder className="w-3.5 h-3.5" />
                  <span>{stat.folderCount} folders</span>
                </div>
                <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                  <Tag className="w-3.5 h-3.5" />
                  <span>{stat.tagCount} tags</span>
                </div>
                <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>{stat.taskCount} tasks</span>
                </div>
              </div>

              {/* Last activity */}
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Active {getRelativeTime(stat.lastActivity)}
              </div>

              {/* Recent notes preview */}
              {stat.recentNotes.length > 0 && (
                <div className="border-t border-gray-100 dark:border-gray-700 pt-2 mb-2">
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">Recent:</p>
                  {stat.recentNotes.map((note) => (
                    <p key={note.id} className="text-xs text-gray-600 dark:text-gray-400 truncate">
                      {note.title}
                    </p>
                  ))}
                </div>
              )}

              {/* Health warnings */}
              {warnings.length > 0 && (
                <div className="border-t border-gray-100 dark:border-gray-700 pt-2 space-y-1">
                  {warnings.map((warning) => (
                    <div
                      key={warning.type}
                      className={`flex items-center gap-1.5 text-xs ${
                        warning.severity === 'red'
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {warning.type === 'no-tokens' ? (
                        <ShieldOff className="w-3.5 h-3.5" aria-hidden="true" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                      )}
                      <span>{warning.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
