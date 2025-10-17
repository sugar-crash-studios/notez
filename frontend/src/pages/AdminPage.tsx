import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usersApi, systemApi } from '../lib/api';
import { Users, UserPlus, Key, UserX, UserCheck, ArrowLeft, Server, Database, HardDrive } from 'lucide-react';

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

interface SystemInfo {
  version: string;
  nodeVersion: string;
  database: {
    status: string;
    info: string;
  };
  uptime: string;
  statistics: {
    totalNotes: number;
    totalFolders: number;
    totalTags: number;
  };
}

export function AdminPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState<string | null>(null);

  // Create user form
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('user');
  const [createError, setCreateError] = useState('');

  // Reset password form
  const [resetPassword, setResetPassword] = useState('');
  const [resetError, setResetError] = useState('');

  useEffect(() => {
    // Check if user is admin
    if (user?.role !== 'admin') {
      navigate('/');
      return;
    }
    loadUsers();
    loadSystemInfo();
  }, [user, navigate]);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const response = await usersApi.list(true);
      setUsers(response.data.users);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSystemInfo = async () => {
    try {
      const response = await systemApi.getInfo();
      setSystemInfo(response.data);
    } catch (error) {
      console.error('Failed to load system info:', error);
      // Set systemInfo to a state that indicates an error
      setSystemInfo({
        version: 'Error',
        nodeVersion: 'Error',
        database: { status: 'error', info: 'Could not fetch info' },
        uptime: 'Error',
        statistics: { totalNotes: 0, totalFolders: 0, totalTags: 0 },
      });
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');

    try {
      await usersApi.create({
        username: newUsername,
        email: newEmail,
        password: newPassword,
        role: newRole,
      });

      // Reset form and close modal
      setNewUsername('');
      setNewEmail('');
      setNewPassword('');
      setNewRole('user');
      setShowCreateModal(false);

      // Reload users
      loadUsers();
    } catch (err: any) {
      setCreateError(err.response?.data?.message || 'Failed to create user');
    }
  };

  const handleToggleActive = async (userId: string, currentlyActive: boolean) => {
    // Optimistic update - update UI immediately
    const originalUsers = [...users];
    setUsers((currentUsers) =>
      currentUsers.map((u) =>
        u.id === userId ? { ...u, isActive: !currentlyActive } : u
      )
    );

    try {
      await usersApi.update(userId, { isActive: !currentlyActive });
    } catch (error) {
      console.error('Failed to toggle user status:', error);
      // Revert on error
      setUsers(originalUsers);
      alert('Failed to update user status');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');

    if (!showResetModal) return;

    try {
      await usersApi.resetPassword(showResetModal, resetPassword);
      setResetPassword('');
      setShowResetModal(null);
      alert('Password reset successfully. User must change password on next login.');
    } catch (err: any) {
      setResetError(err.response?.data?.message || 'Failed to reset password');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-700">
      {/* Header */}
      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/')}
            className="p-2 hover:bg-gray-100 dark:bg-gray-900 rounded-md flex items-center space-x-2 text-gray-700 dark:text-gray-200"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Notes</span>
          </button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Admin Panel</h1>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500">{user?.username}</span>
          <button
            onClick={logout}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:bg-gray-700"
          >
            Logout
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto py-8 px-4 space-y-6">
        {/* System Information */}
        {systemInfo && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center space-x-3">
              <Server className="w-6 h-6 text-gray-600 dark:text-gray-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">System Information</h2>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Version Info */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400">
                  <HardDrive className="w-4 h-4" />
                  <span className="text-sm font-medium">Application</span>
                </div>
                <div className="ml-6">
                  <p className="text-sm text-gray-900 dark:text-white">Version: <span className="font-mono">{systemInfo.version}</span></p>
                  <p className="text-sm text-gray-900 dark:text-white">Node.js: <span className="font-mono">{systemInfo.nodeVersion}</span></p>
                  <p className="text-sm text-gray-900 dark:text-white">Uptime: <span className="font-mono">{systemInfo.uptime}</span></p>
                </div>
              </div>

              {/* Database Info */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400">
                  <Database className="w-4 h-4" />
                  <span className="text-sm font-medium">Database</span>
                </div>
                <div className="ml-6">
                  <p className="text-sm text-gray-900 dark:text-white">
                    Status:{' '}
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        systemInfo.database.status === 'connected'
                          ? 'bg-green-100 text-green-800'
                          : systemInfo.database.status === 'error'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {systemInfo.database.status}
                    </span>
                  </p>
                  <p className="text-sm text-gray-900 dark:text-white">
                    Type: <span className="font-mono">{systemInfo.database.info}</span>
                  </p>
                </div>
              </div>

              {/* Content Statistics */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400">
                  <HardDrive className="w-4 h-4" />
                  <span className="text-sm font-medium">Content</span>
                </div>
                <div className="ml-6">
                  <p className="text-sm text-gray-900 dark:text-white">Notes: <span className="font-mono">{systemInfo.statistics.totalNotes}</span></p>
                  <p className="text-sm text-gray-900 dark:text-white">Folders: <span className="font-mono">{systemInfo.statistics.totalFolders}</span></p>
                  <p className="text-sm text-gray-900 dark:text-white">Tags: <span className="font-mono">{systemInfo.statistics.totalTags}</span></p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* User Management */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          {/* User Management Header */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Users className="w-6 h-6 text-gray-600 dark:text-gray-400 dark:text-gray-500" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">User Management</h2>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700"
            >
              <UserPlus className="w-4 h-4" />
              <span>Create User</span>
            </button>
          </div>

          {/* Users List */}
          <div className="divide-y divide-gray-200">
            {isLoading ? (
              <div className="px-6 py-8 text-center text-gray-500 dark:text-gray-400 dark:text-gray-500">Loading users...</div>
            ) : users.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-500 dark:text-gray-400 dark:text-gray-500">No users found</div>
            ) : (
              users.map((u) => (
                <div key={u.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:bg-gray-700">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <h3 className="font-medium text-gray-900 dark:text-white">{u.username}</h3>
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full ${
                          u.role === 'admin'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-gray-100 dark:bg-gray-900 text-gray-800'
                        }`}
                      >
                        {u.role}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full ${
                          u.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500 mt-1">{u.email}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1">
                      Created: {new Date(u.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setShowResetModal(u.id)}
                      className="p-2 text-gray-600 dark:text-gray-400 dark:text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md"
                      title="Reset Password"
                    >
                      <Key className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleToggleActive(u.id, u.isActive)}
                      className={`p-2 rounded-md ${
                        u.isActive
                          ? 'text-gray-600 dark:text-gray-400 dark:text-gray-500 hover:text-orange-600 hover:bg-orange-50'
                          : 'text-gray-600 dark:text-gray-400 dark:text-gray-500 hover:text-green-600 hover:bg-green-50'
                      }`}
                      title={u.isActive ? 'Deactivate' : 'Activate'}
                    >
                      {u.isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Create New User</h3>

            {createError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-800">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Username</label>
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  Temporary Password
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Min 8 chars, 1 uppercase, 1 number"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">
                  User will be required to change this on first login
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  type="submit"
                  className="flex-1 py-2 px-4 bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700"
                >
                  Create User
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setCreateError('');
                  }}
                  className="flex-1 py-2 px-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-50 dark:bg-gray-700"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Reset User Password</h3>

            {resetError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-800">
                {resetError}
              </div>
            )}

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  New Temporary Password
                </label>
                <input
                  type="password"
                  required
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Min 8 chars, 1 uppercase, 1 number"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">
                  User will be required to change this on next login
                </p>
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  type="submit"
                  className="flex-1 py-2 px-4 bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700"
                >
                  Reset Password
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowResetModal(null);
                    setResetError('');
                    setResetPassword('');
                  }}
                  className="flex-1 py-2 px-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-50 dark:bg-gray-700"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
