import { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import SettingsPanel from '../components/SettingsPanel';
import LogOutput from '../components/LogOutput';
import { FileText, Play, Edit2, Save, Square } from 'lucide-react';

export default function GeneratorPage() {
  const [testPlan, setTestPlan] = useState<string>('');
  const [baseUrl, setBaseUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [editing, setEditing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Settings overrides - separate for each component
  const [settings, setSettings] = useState({
    planner: {
      useAI: true,
      aiProvider: 'ollama',
      aiModel: 'mistral',
    },
    generator: {
      useAI: true,
      aiProvider: 'ollama',
      aiModel: 'mistral',
    },
    healer: {
      useAI: true,
      aiProvider: 'ollama',
      aiModel: 'mistral',
    },
    tts: {
      useTTS: false,
      ttsProvider: 'openai',
      ttsVoice: 'nova',
    },
  });

  useEffect(() => {
    loadLatestTestPlan();
  }, []);

  const loadLatestTestPlan = async () => {
    setLoadingPlan(true);
    try {
      const response = await api.get('/generator/test-plan');
      if (response.data.content) {
        setTestPlan(response.data.content);
        setBaseUrl(response.data.baseUrl || '');
      }
    } catch (err: any) {
      console.error('Failed to load test plan:', err);
    } finally {
      setLoadingPlan(false);
    }
  };

  const handleSave = () => {
    setEditing(false);
    // Could save to a temporary file or just keep in state
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setLogs(['🚀 Starting test generation...', `📄 Test plan length: ${testPlan.length} characters`, `🌐 Base URL: ${baseUrl}`]);

    abortControllerRef.current = new AbortController();

    try {
      const response = await api.post('/generator/run', {
        testPlan,
        baseUrl,
        settings: {
          useAI: settings.generator.useAI,
          aiProvider: settings.generator.aiProvider,
          aiModel: settings.generator.aiModel,
        },
      }, {
        signal: abortControllerRef.current.signal,
      });
      setLogs(prev => [...prev, `✅ Generated ${response.data.files || 0} test file(s)`, `📁 Directory: ${response.data.directory || 'N/A'}`]);
      setResult(response.data.message || 'Tests generated successfully!');
    } catch (err: any) {
      if (err.name === 'CanceledError' || err.message === 'canceled') {
        setLogs(prev => [...prev, '⏹️ Generation stopped by user']);
        setResult('Generation stopped');
      } else {
        setLogs(prev => [...prev, `❌ Error: ${err.response?.data?.error || err.message || 'Failed to generate tests'}`]);
        setError(err.response?.data?.error || err.message || 'Failed to generate tests');
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setLoading(false);
      setLogs(prev => [...prev, '⏹️ Stopping generation...']);
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
          <FileText className="w-6 h-6 mr-2" />
          Generator
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Generate Playwright tests from test plans
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Test Plan
              </h3>
              <div className="flex gap-2">
                {editing ? (
                  <button
                    onClick={handleSave}
                    className="flex items-center px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
                  >
                    <Save className="w-4 h-4 mr-1" />
                    Save
                  </button>
                ) : (
                  <button
                    onClick={() => setEditing(true)}
                    className="flex items-center px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 text-sm"
                  >
                    <Edit2 className="w-4 h-4 mr-1" />
                    Edit
                  </button>
                )}
                <button
                  onClick={loadLatestTestPlan}
                  disabled={loadingPlan}
                  className="px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 text-sm disabled:opacity-50"
                >
                  {loadingPlan ? 'Loading...' : 'Reload'}
                </button>
              </div>
            </div>

            {loadingPlan ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                Loading test plan...
              </div>
            ) : (
              <textarea
                value={testPlan}
                onChange={(e) => setTestPlan(e.target.value)}
                readOnly={!editing}
                className={`w-full h-96 font-mono text-sm rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-700 dark:text-white p-3 ${
                  !editing ? 'bg-gray-50 dark:bg-gray-900' : ''
                }`}
                placeholder="Test plan will appear here..."
              />
            )}

            <form onSubmit={handleGenerate} className="mt-4">
              <div className="mb-4">
                <label htmlFor="baseUrl" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Base URL
                </label>
                <input
                  type="url"
                  id="baseUrl"
                  required
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-700 dark:text-white sm:text-sm px-3 py-2"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={loading || !testPlan || !baseUrl}
                  className="flex-1 flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Generating Tests...
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5 mr-2" />
                      Generate Tests
                    </>
                  )}
                </button>
                {loading && (
                  <button
                    type="button"
                    onClick={handleStop}
                    className="px-4 py-2 border border-red-300 dark:border-red-700 rounded-md shadow-sm text-sm font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900 hover:bg-red-100 dark:hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    <Square className="w-5 h-5" />
                  </button>
                )}
              </div>

              {result && (
                <div className="mt-4 rounded-md bg-green-50 dark:bg-green-900 p-4">
                  <p className="text-sm text-green-800 dark:text-green-200">{result}</p>
                </div>
              )}

              {error && (
                <div className="mt-4 rounded-md bg-red-50 dark:bg-red-900 p-4">
                  <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                </div>
              )}
            </form>

            {/* Log Output */}
            <div className="mt-6">
              <LogOutput logs={logs} title="Generator Logs" />
            </div>
          </div>
        </div>

        {/* Settings Panel */}
        <div className="lg:col-span-1">
          <SettingsPanel settings={settings} onChange={setSettings} component="generator" />
        </div>
      </div>
    </div>
  );
}

