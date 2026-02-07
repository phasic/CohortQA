import { useState, useRef, useEffect } from 'react';
import { api } from '../services/api';
import SettingsPanel from '../components/SettingsPanel';
import LogOutput from '../components/LogOutput';
import { Sparkles, Play, Square } from 'lucide-react';
import { Personality } from '../constants/personalities';

export default function PlannerPage() {
  const [url, setUrl] = useState('');
  const [maxNavigations, setMaxNavigations] = useState(3);
  const [ignoredTags, setIgnoredTags] = useState<string[]>(['header', 'aside', 'footer', 'dbs-top-bar']);
  const [newTag, setNewTag] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const streamIdRef = useRef<string | null>(null); // To store the current streamId
  
  // Settings overrides - separate for each component
  const [settings, setSettings] = useState<{
    planner: {
      useAI: boolean;
      aiProvider: string;
      aiModel: string;
      headless?: boolean;
    };
    generator: {
      useAI: boolean;
      aiProvider: string;
      aiModel: string;
    };
    healer: {
      useAI: boolean;
      aiProvider: string;
      aiModel: string;
    };
    tts: {
      useTTS: boolean;
      ttsProvider: string;
      ttsVoice: string;
    };
    personality?: Personality;
  }>({
    planner: {
      useAI: true,
      aiProvider: 'ollama',
      aiModel: 'mistral',
      headless: false,
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
    personality: 'playful',
  });

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setLogs(['🚀 Starting planner...', `📍 URL: ${url}`, `🔢 Max navigations: ${maxNavigations}`]);

    // Generate unique stream ID
    const streamId = `planner_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    streamIdRef.current = streamId; // Store streamId

    // Connect to SSE log stream (use same base as API service)
    const eventSource = new EventSource(
      `/api/logs/stream?streamId=${streamId}&operation=planner`
    );

    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setLogs(prev => [...prev, '✅ Connected to log stream']);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.message) {
          setLogs(prev => [...prev, data.message]);
        }
      } catch (err) {
        console.error('Failed to parse SSE message:', err);
        setLogs(prev => [...prev, `⚠️ Failed to parse log message: ${err}`]);
      }
    };

    eventSource.onerror = (err) => {
      console.error('SSE error:', err);
      setLogs(prev => [...prev, '❌ Log stream connection error']);
      // Don't close immediately - might be a temporary issue
    };

    abortControllerRef.current = new AbortController();

    try {
      // Build request payload
      const requestPayload: any = {
        url,
        maxNavigations,
        ignoredTags,
        streamId,
        settings: {
          useAI: settings.planner.useAI,
          aiProvider: settings.planner.aiProvider,
          aiModel: settings.planner.aiModel,
          headless: settings.planner.headless || false,
          useTTS: settings.tts.useTTS,
          ttsProvider: settings.tts.ttsProvider,
          ttsVoice: settings.tts.ttsVoice,
        },
        personality: settings.personality || 'playful', // Include personality setting
      };

      const response = await api.post('/planner/run', requestPayload, {
        signal: abortControllerRef.current.signal,
      });
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
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      streamIdRef.current = null; // Clear streamId
    }
  };

  const handleStop = async () => {
    if (streamIdRef.current) {
      setLogs(prev => [...prev, '⏹️ Sending stop signal to planner...']);
      try {
        await api.post('/planner/stop', { streamId: streamIdRef.current });
        setLogs(prev => [...prev, '✅ Planner stop signal sent.']);
      } catch (err: any) {
        console.error('Failed to send stop signal:', err);
        setLogs(prev => [...prev, `❌ Failed to send stop signal: ${err.response?.data?.error || err.message}`]);
      }
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setLoading(false);
      setLogs(prev => [...prev, '⏹️ Aborting frontend request...']);
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    streamIdRef.current = null; // Clear streamId
  };

  const addIgnoredTag = () => {
    if (newTag.trim() && !ignoredTags.includes(newTag.trim())) {
      setIgnoredTags([...ignoredTags, newTag.trim()]);
      setNewTag('');
    }
  };

  const removeIgnoredTag = (tag: string) => {
    setIgnoredTags(ignoredTags.filter(t => t !== tag));
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <Sparkles className="w-8 h-8 text-primary-600" />
              Planner
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Explore your application and generate test scenarios
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Start URL
                </label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com"
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Max Navigations
                </label>
                <input
                  type="number"
                  value={maxNavigations}
                  onChange={(e) => setMaxNavigations(parseInt(e.target.value) || 3)}
                  min="1"
                  max="20"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Number of pages to explore
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Ignored Tags
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addIgnoredTag())}
                    placeholder="e.g., header, footer"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={addIgnoredTag}
                    className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {ignoredTags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeIgnoredTag(tag)}
                        className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  <Play className="w-5 h-5" />
                  {loading ? 'Running...' : 'Start Planning'}
                </button>
                {loading && (
                  <button
                    type="button"
                    onClick={handleStop}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                  >
                    <Square className="w-5 h-5" />
                    Stop
                  </button>
                )}
              </div>

              {result && (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                  <p className="text-sm text-green-800 dark:text-green-200">{result}</p>
                </div>
              )}

              {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                  <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                </div>
              )}
            </div>
          </form>
        </div>
        <div className="lg:col-span-1">
          <SettingsPanel 
            settings={settings} 
            onChange={setSettings} 
            component="planner"
            onPersonalityChange={(personality) => {
              setSettings(prev => ({
                ...prev,
                personality,
              }));
            }}
          />
        </div>
      </div>

      {/* Log Output - Always visible by default - Full width below grid */}
      <div className="mt-8 w-full" style={{ display: 'block', visibility: 'visible' }}>
        <LogOutput logs={logs} title="Planner Logs" />
      </div>
    </div>
  );
}
