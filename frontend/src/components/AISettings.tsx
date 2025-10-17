import { useState, useEffect } from 'react';
import { aiApi } from '../lib/api';
import { Bot, Check, X, Loader2 } from 'lucide-react';

type AIProvider = 'anthropic' | 'openai' | 'gemini';

interface AIConfig {
  configured: boolean;
  provider: AIProvider | null;
  model: string | null;
}

export function AISettings() {
  const [config, setConfig] = useState<AIConfig>({ configured: false, provider: null, model: null });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Form state
  const [provider, setProvider] = useState<AIProvider>('anthropic');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const response = await aiApi.getSettings();
      const settings = response.data;
      setConfig(settings);

      if (settings.configured && settings.provider) {
        setProvider(settings.provider);
        setModel(settings.model || '');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load AI settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    setError('');

    try {
      const response = await aiApi.testConnection({
        provider,
        apiKey,
        model: model || undefined,
      });

      setTestResult({
        success: response.data.success,
        message: response.data.message || 'Connection successful',
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.response?.data?.message || 'Connection failed',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError('');
    setSuccess('');
    setTestResult(null);

    try {
      await aiApi.saveSettings({
        provider,
        apiKey,
        model: model || undefined,
      });

      setSuccess('AI settings saved successfully! Connection tested and verified.');
      setApiKey(''); // Clear API key from form for security
      await loadSettings(); // Reload settings
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save AI settings');
    } finally {
      setIsSaving(false);
    }
  };

  const providerInfo = {
    anthropic: {
      name: 'Anthropic Claude',
      defaultModel: 'claude-3-5-sonnet-20241022',
      description: 'Claude 3.5 Sonnet - Powerful and versatile AI model',
      keyFormat: 'sk-ant-api03-...',
    },
    openai: {
      name: 'OpenAI GPT',
      defaultModel: 'gpt-4o-mini',
      description: 'GPT-4o Mini - Fast and cost-effective',
      keyFormat: 'sk-...',
    },
    gemini: {
      name: 'Google Gemini',
      defaultModel: 'gemini-1.5-flash',
      description: 'Gemini 1.5 Flash - Quick and efficient',
      keyFormat: 'AIza...',
    },
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
        <span className="ml-2 text-gray-600">Loading AI settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Status */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center space-x-3 mb-4">
          <Bot className="w-6 h-6 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">AI Configuration Status</h3>
        </div>

        {config.configured ? (
          <div className="bg-green-50 border border-green-200 rounded-md p-4">
            <div className="flex items-center space-x-2 text-green-800">
              <Check className="w-5 h-5" />
              <span className="font-medium">AI is configured and ready</span>
            </div>
            <p className="text-sm text-green-700 mt-2">
              Provider: <span className="font-medium">{providerInfo[config.provider!]?.name}</span>
            </p>
            {config.model && (
              <p className="text-sm text-green-700">
                Model: <span className="font-medium">{config.model}</span>
              </p>
            )}
          </div>
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <div className="flex items-center space-x-2 text-yellow-800">
              <X className="w-5 h-5" />
              <span className="font-medium">AI is not configured</span>
            </div>
            <p className="text-sm text-yellow-700 mt-2">
              Configure an AI provider below to enable AI features for all users.
            </p>
          </div>
        )}
      </div>

      {/* Configuration Form */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {config.configured ? 'Update AI Configuration' : 'Configure AI Provider'}
        </h3>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-800">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-800">
            {success}
          </div>
        )}

        {testResult && (
          <div
            className={`mb-4 p-3 rounded-md text-sm ${
              testResult.success
                ? 'bg-green-50 border border-green-200 text-green-800'
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}
          >
            <div className="flex items-center space-x-2">
              {testResult.success ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
              <span>{testResult.message}</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          {/* Provider Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">AI Provider</label>
            <select
              value={provider}
              onChange={(e) => {
                setProvider(e.target.value as AIProvider);
                setModel(''); // Reset model when provider changes
                setTestResult(null);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="anthropic">Anthropic Claude</option>
              <option value="openai">OpenAI GPT</option>
              <option value="gemini">Google Gemini</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">{providerInfo[provider].description}</p>
          </div>

          {/* API Key */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
            <input
              type="password"
              required
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setTestResult(null);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              placeholder={providerInfo[provider].keyFormat}
            />
            <p className="mt-1 text-xs text-gray-500">
              Your API key will be encrypted and stored securely
            </p>
          </div>

          {/* Model Override (Optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Model (Optional)
            </label>
            <input
              type="text"
              value={model}
              onChange={(e) => {
                setModel(e.target.value);
                setTestResult(null);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              placeholder={providerInfo[provider].defaultModel}
            />
            <p className="mt-1 text-xs text-gray-500">
              Leave empty to use the default model: {providerInfo[provider].defaultModel}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={!apiKey || isTesting || isSaving}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isTesting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Testing...</span>
                </>
              ) : (
                <span>Test Connection</span>
              )}
            </button>

            <button
              type="submit"
              disabled={!apiKey || isSaving || isTesting}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Configuration</span>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Information */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <h4 className="text-sm font-medium text-blue-900 mb-2">How to get an API key:</h4>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>
            <strong>Anthropic:</strong> Visit{' '}
            <a
              href="https://console.anthropic.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              console.anthropic.com
            </a>
          </li>
          <li>
            <strong>OpenAI:</strong> Visit{' '}
            <a
              href="https://platform.openai.com/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              platform.openai.com/api-keys
            </a>
          </li>
          <li>
            <strong>Google Gemini:</strong> Visit{' '}
            <a
              href="https://makersuite.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              makersuite.google.com/app/apikey
            </a>
          </li>
        </ul>
      </div>
    </div>
  );
}
