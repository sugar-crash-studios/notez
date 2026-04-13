import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plug,
  CheckCircle,
  XCircle,
  Clock,
  Trash2,
  Shield,
  Globe,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { mcpConnectorsApi } from '../lib/api';
import { useToast } from './Toast';
import { useConfirm } from './ConfirmDialog';
import { formatDistanceToNow } from 'date-fns';

interface OAuthClient {
  id: string;
  clientId: string;
  clientName: string | null;
  clientUri: string | null;
  redirectUris: string[];
  scope: string | null;
  status: string;
  createdAt: string;
  approvedBy?: { username: string } | null;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    approved: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    pending_approval: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
    rejected: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  };
  const icons: Record<string, React.ReactNode> = {
    approved: <CheckCircle className="w-3 h-3" />,
    pending_approval: <Clock className="w-3 h-3" />,
    rejected: <XCircle className="w-3 h-3" />,
  };
  const labels: Record<string, string> = {
    approved: 'Approved',
    pending_approval: 'Pending Approval',
    rejected: 'Rejected',
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] ?? 'bg-gray-100 dark:bg-gray-700 text-gray-600'}`}>
      {icons[status]}
      {labels[status] ?? status}
    </span>
  );
}

function ConnectorCard({
  client,
  onApprove,
  onReject,
  isActing,
}: {
  client: OAuthClient;
  onApprove: (clientId: string) => void;
  onReject: (clientId: string) => void;
  isActing: boolean;
}) {
  // Extract domain from redirect URIs for display
  const redirectDomain = client.redirectUris[0]
    ? (() => { try { return new URL(client.redirectUris[0]).hostname; } catch { return 'unknown'; } })()
    : 'unknown';

  return (
    <div className={`border rounded-lg p-4 transition-colors ${
      client.status === 'pending_approval'
        ? 'border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-900/10'
        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
    }`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 p-2 rounded-lg ${
            client.status === 'pending_approval'
              ? 'bg-amber-100 dark:bg-amber-900/30'
              : client.status === 'approved'
                ? 'bg-green-100 dark:bg-green-900/30'
                : 'bg-gray-100 dark:bg-gray-700'
          }`}>
            <Plug className={`w-4 h-4 ${
              client.status === 'pending_approval'
                ? 'text-amber-600 dark:text-amber-400'
                : client.status === 'approved'
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-gray-500'
            }`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-gray-900 dark:text-white">
                {client.clientName || 'Unknown App'}
              </h3>
              <StatusBadge status={client.status} />
            </div>
            <div className="mt-1 flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
              <Globe className="w-3.5 h-3.5" />
              <span>{redirectDomain}</span>
            </div>
            <div className="mt-1 flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
              <Shield className="w-3 h-3" />
              <span>Scope: {client.scope || 'mcp:read'}</span>
            </div>
            <div className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              Registered {formatDistanceToNow(new Date(client.createdAt), { addSuffix: true })}
              {client.approvedBy && ` / Approved by ${client.approvedBy.username}`}
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      {client.status === 'pending_approval' && (
        <div className="mt-3 flex gap-2 ml-11">
          <button
            type="button"
            onClick={() => onApprove(client.clientId)}
            disabled={isActing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50"
          >
            {isActing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
            Approve
          </button>
          <button
            type="button"
            onClick={() => onReject(client.clientId)}
            disabled={isActing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium rounded-md transition-colors disabled:opacity-50"
          >
            {isActing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
            Reject
          </button>
        </div>
      )}

      {client.status === 'approved' && (
        <div className="mt-3 ml-11">
          <button
            type="button"
            onClick={() => onReject(client.clientId)}
            disabled={isActing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-medium rounded-md transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Revoke Access
          </button>
        </div>
      )}
    </div>
  );
}

export function McpConnectorSettings() {
  const { showToast } = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<string>('all');
  const [actingOn, setActingOn] = useState<string | null>(null);

  const { data: clients, isLoading, refetch } = useQuery({
    queryKey: ['mcp', 'connectors', filter],
    queryFn: async () => {
      const status = filter === 'all' ? undefined : filter;
      const res = await mcpConnectorsApi.list(status);
      return res.data as OAuthClient[];
    },
    refetchInterval: 15000, // Poll every 15s for new registrations
  });

  const approveMutation = useMutation({
    mutationFn: (clientId: string) => mcpConnectorsApi.approve(clientId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mcp', 'connectors'] });
      showToast('Connector approved', 'success');
      setActingOn(null);
    },
    onError: () => {
      showToast('Failed to approve connector', 'error');
      setActingOn(null);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (clientId: string) => mcpConnectorsApi.reject(clientId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mcp', 'connectors'] });
      showToast('Connector rejected', 'success');
      setActingOn(null);
    },
    onError: () => {
      showToast('Failed to reject connector', 'error');
      setActingOn(null);
    },
  });

  const handleApprove = useCallback(async (clientId: string) => {
    setActingOn(clientId);
    approveMutation.mutate(clientId);
  }, [approveMutation]);

  const handleReject = useCallback(async (clientId: string) => {
    const client = clients?.find((c) => c.clientId === clientId);
    const action = client?.status === 'approved' ? 'revoke access for' : 'reject';
    const agreed = await confirm({
      title: client?.status === 'approved' ? 'Revoke Connector Access' : 'Reject Connector',
      message: `Are you sure you want to ${action} "${client?.clientName || 'this connector'}"? ${
        client?.status === 'approved' ? 'Any active connections will stop working.' : 'The application will not be able to connect.'
      }`,
      confirmText: client?.status === 'approved' ? 'Revoke' : 'Reject',
      variant: 'danger',
    });
    if (agreed) {
      setActingOn(clientId);
      rejectMutation.mutate(clientId);
    }
  }, [confirm, clients, rejectMutation]);

  const pendingCount = clients?.filter((c) => c.status === 'pending_approval').length ?? 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Plug className="w-5 h-5" />
            MCP Connectors
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage external applications that connect to Notez via MCP (e.g. Claude)
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Pending approval banner */}
      {pendingCount > 0 && (
        <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-300">
            {pendingCount} connector{pendingCount > 1 ? 's' : ''} waiting for approval
          </p>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-1 mb-4">
        {[
          { value: 'all', label: 'All' },
          { value: 'pending_approval', label: 'Pending' },
          { value: 'approved', label: 'Approved' },
          { value: 'rejected', label: 'Rejected' },
        ].map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              filter === f.value
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-medium'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Connector list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Loading connectors...
        </div>
      ) : !clients?.length ? (
        <div className="text-center py-12">
          <Plug className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {filter === 'all'
              ? 'No connectors registered yet. When an app like Claude connects, it will appear here for approval.'
              : `No ${filter.replace('_', ' ')} connectors.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {clients.map((client) => (
            <ConnectorCard
              key={client.id}
              client={client}
              onApprove={handleApprove}
              onReject={handleReject}
              isActing={actingOn === client.clientId}
            />
          ))}
        </div>
      )}

      {/* Help text */}
      <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">How MCP Connectors work</h3>
        <ol className="text-xs text-gray-500 dark:text-gray-400 space-y-1 list-decimal list-inside">
          <li>An app (like Claude) registers as a connector via your Notez URL</li>
          <li>The registration appears here as "Pending Approval"</li>
          <li>You approve the connector to allow it to request user authorization</li>
          <li>Each user then individually authorizes the app via a consent screen</li>
          <li>Revoking a connector disconnects all users from that app</li>
        </ol>
      </div>
    </div>
  );
}
