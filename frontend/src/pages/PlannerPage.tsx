import { useState } from 'react';
import { api } from '../services/api';
import SettingsPanel from '../components/SettingsPanel';
import { Sparkles, Play } from 'lucide-react';

export default function PlannerPage() {
  const [url, setUrl] = useState('');
  const [maxNavigations, setMaxNavigations] = useState(3);
  const [ignoredTags, setIgnoredTags] = useState<string[]>(['header', 'nav', 'aside', 'footer', 'dbs-top-bar']);
  const [newTag, setNewTag] = useState('');
  const [loading, setLoading] = useState(false);
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

  const handleAddTag = () => {
    if (newTag.trim() && !ignoredTags.includes(newTag.trim())) {
      setIgnoredTags([...ignoredTags, newTag.trim()]);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setIgnoredTags(ignoredTags.filter(t => t !== tag));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setLogs(['🚀 Starting planner...', `📍 URL: ${url}`, `🔢 Max navigations: ${maxNavigations}`]);

    abortControllerRef.current = new AbortController();

    try {
      const response = await api.post('/planner/run', {
        url,
        maxNavigations,
        ignoredTags,
        settings: {
          useAI: settings.planner.useAI,
          aiProvider: settings.planner.aiProvider,
          aiModel: settings.planner.aiModel,
          useTTS: settings.tts.useTTS,
          ttsProvider: settings.tts.ttsProvider,
          ttsVoice: settings.tts.ttsVoice,
        },
      }, {
        signal: abortControllerRef.current.signal,
        onDownloadProgress: (progressEvent: any) => {
          // Handle streaming logs if implemented
        },
      });
      setLogs(prev => [...prev, '✅ Planner completed successfully!']);
      setResult(response.data.message || 'Planner completed successfully!');
    } catch (err: any) {
      if (err.name === 'CanceledError' || err.message === 'canceled') {
        setLogs(prev => [...prev, '⏹️ Planner stopped by user']);
        setResult('Planner stopped');
      } else {
        setLogs(prev => [...prev, `❌ Error: ${err.response?.data?.error || err.message || 'Failed to run planner'}`]);
        setError(err.response?.data?.error || err.message || 'Failed to run planner');
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
      setLogs(prev => [...prev, '⏹️ Stopping planner...']);
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
          <Sparkles className="w-6 h-6 mr-2" />
          Planner
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Explore web applications and generate test plans
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main form */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <div className="space-y-6">
              {/* URL Input */}
              <div>
                <label htmlFor="url" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Start URL
                </label>
                <input
                  type="url"
                  id="url"
                  required
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-700 dark:text-white sm:text-sm px-3 py-2"
                />
              </div>

              {/* Max Navigations */}
              <div>
                <label htmlFor="navigations" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Maximum Navigations
                </label>
                <input
                  type="number"
                  id="navigations"
                  min="1"
                  max="20"
                  value={maxNavigations}
                  onChange={(e) => setMaxNavigations(parseInt(e.target.value) || 3)}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-700 dark:text-white sm:text-sm px-3 py-2"
                />
              </div>

              {/* Ignored Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Ignored Tags (elements to skip)
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {ignoredTags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                    placeholder="Add tag (e.g., header)"
                    className="flex-1 rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-700 dark:text-white sm:text-sm px-3 py-2"
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Submit and Stop Buttons */}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={loading || !url}
                  className="flex-1 flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Running Planner...
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5 mr-2" />
                      Run Planner
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

              {/* Results */}
              {result && (
                <div className="rounded-md bg-green-50 dark:bg-green-900 p-4">
                  <p className="text-sm text-green-800 dark:text-green-200">{result}</p>
                </div>
              )}

              {error && (
                <div className="rounded-md bg-red-50 dark:bg-red-900 p-4">
                  <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                </div>
              )}
            </div>
          </form>

          {/* Log Output */}
          <div className="mt-6">
            <LogOutput logs={logs} title="Planner Logs" />
          </div>
        </div>

        {/* Settings Panel */}
        <div className="lg:col-span-1">
          <SettingsPanel settings={settings} onChange={setSettings} component="planner" />
        </div>
      </div>
    </div>
  );
}

