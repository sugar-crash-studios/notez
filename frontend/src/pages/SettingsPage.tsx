import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Bot } from 'lucide-react';
import { AISettings } from '../components/AISettings';

export function SettingsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'profile' | 'ai'>('ai');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Bar */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Notes</span>
          </button>
          <h1 className="text-xl font-bold text-gray-900">Settings</h1>
          <div className="w-28"></div> {/* Spacer for center alignment */}
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto py-8 px-4">
        {/* Tabs */}
        <div className="bg-white rounded-t-lg shadow border-b border-gray-200">
          <div className="flex space-x-1 px-6">
            <button
              onClick={() => setActiveTab('ai')}
              className={`flex items-center space-x-2 px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'ai'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              <Bot className="w-4 h-4" />
              <span>AI Configuration</span>
            </button>
            <button
              onClick={() => setActiveTab('profile')}
              className={`flex items-center space-x-2 px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'profile'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              <User className="w-4 h-4" />
              <span>Profile</span>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-b-lg shadow p-6">
          {activeTab === 'ai' ? (
            <AISettings />
          ) : (
            <div className="py-12 text-center text-gray-500">
              <User className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p>Profile settings coming soon</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
