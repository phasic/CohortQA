import { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import SettingsPanel from '../components/SettingsPanel';
import LogOutput from '../components/LogOutput';
import { Wrench, Play, FolderOpen, Square } from 'lucide-react';
import { DEFAULT_PROMPTS } from '../constants/defaultPrompts';

interface TestSuite {
  name: string;
  path: string;
  testCount?: number;
}

export default function HealerPage() {
  const [testSuites, setTestSuites] = useState<TestSuite[]>([]);
  const [selectedSuite, setSelectedSuite] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingSuites, setLoadingSuites] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [fileDiffs, setFileDiffs] = useState<Map<string, { original: string; modified: string }>>(new Map());
  const abortControllerRef = useRef<AbortController | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);
  
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
    loadTestSuites();
  }, []);

  const loadTestSuites = async () => {
    setLoadingSuites(true);
    try {
      const response = await api.get('/healer/test-suites');
      setTestSuites(response.data.suites || []);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load test suites');
    } finally {
      setLoadingSuites(false);
    }
  };

  const handleHeal = async () => {
    if (!selectedSuite) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setLogs([]);
    setFileDiffs(new Map());

    // Generate unique stream ID
    const streamId = `healer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Connect to SSE log stream (use same base as API service)
    const eventSource = new EventSource(
      `/api/logs/stream?streamId=${streamId}&operation=healer`
    );

    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.message) {
          setLogs(prev => [...prev, data.message]);
        }
      } catch (err) {
        console.error('Failed to parse SSE message:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.error('SSE error:', err);
      eventSource.close();
    };

    abortControllerRef.current = new AbortController();

    try {
      const response = await api.post('/healer/run', {
        testSuite: selectedSuite,
        streamId,
        settings: {
          useAI: settings.healer.useAI,
          aiProvider: settings.healer.aiProvider,
          aiModel: settings.healer.aiModel,
        },
      }, {
        signal: abortControllerRef.current.signal,
      });
      
      // Fetch diffs for healed files
      if (response.data.healedFiles) {
        for (const filePath of response.data.healedFiles) {
          try {
            const diffResponse = await api.get(`/healer/diff?path=${encodeURIComponent(filePath)}`);
            setFileDiffs(prev => new Map(prev).set(filePath, diffResponse.data));
          } catch (err) {
            console.error('Failed to load diff:', err);
          }
        }
      }

      setResult(response.data.message || 'Healing completed!');
    } catch (err: any) {
      if (err.name === 'CanceledError' || err.message === 'canceled') {
        setLogs(prev => [...prev, '⏹️ Healing stopped by user']);
        setResult('Healing stopped');
      } else {
        setLogs(prev => [...prev, `❌ Error: ${err.response?.data?.error || err.message || 'Failed to heal tests'}`]);
        setError(err.response?.data?.error || err.message || 'Failed to heal tests');
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setLoading(false);
      setLogs(prev => [...prev, '⏹️ Stopping healing...']);
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
          <Wrench className="w-6 h-6 mr-2" />
          Healer
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Run and automatically fix failing tests
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Test Suites
              </h3>
              <button
                onClick={loadTestSuites}
                disabled={loadingSuites}
                className="px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 text-sm disabled:opacity-50"
              >
                {loadingSuites ? 'Loading...' : 'Refresh'}
              </button>
            </div>

            {loadingSuites ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                Loading test suites...
              </div>
            ) : testSuites.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                No test suites found. Generate some tests first!
              </div>
            ) : (
              <div className="space-y-2">
                {testSuites.map((suite) => (
                  <div
                    key={suite.path}
                    onClick={() => setSelectedSuite(suite.path)}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                      selectedSuite === suite.path
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <FolderOpen className="w-5 h-5 mr-3 text-gray-400" />
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {suite.name}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {suite.path}
                          </p>
                        </div>
                      </div>
                      {suite.testCount !== undefined && (
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {suite.testCount} tests
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2 mt-6">
              <button
                onClick={handleHeal}
                disabled={loading || !selectedSuite}
                className="flex-1 flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Healing Tests...
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 mr-2" />
                    Heal Selected Suite
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
          </div>
        </div>

        {/* File Browser and Diff Viewer */}
        {selectedSuite && (
          <div className="lg:col-span-2 mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* File Browser */}
              <div>
                <FileBrowser
                  basePath={selectedSuite}
                  onFileSelect={(file) => {
                    setSelectedFile(file);
                    // Check if we have a diff for this file
                    const diff = fileDiffs.get(file.path);
                    if (diff) {
                      setSelectedFile({ ...file, diff });
                    }
                  }}
                />
              </div>

              {/* File Content / Diff Viewer */}
              <div>
                {selectedFile?.diff ? (
                  <DiffViewer
                    original={selectedFile.diff.original}
                    modified={selectedFile.diff.modified}
                    fileName={selectedFile.name}
                  />
                ) : selectedFile?.content ? (
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center">
                      <FileCode className="w-4 h-4 mr-2 text-gray-500" />
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {selectedFile.name}
                      </h4>
                    </div>
                    <div className="font-mono text-xs max-h-96 overflow-y-auto bg-gray-900 text-green-400 p-4">
                      <pre className="whitespace-pre-wrap">{selectedFile.content}</pre>
                    </div>
                  </div>
                ) : (
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-8 text-center text-gray-500">
                    Select a file to view its content
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Settings Panel */}
        <div className="lg:col-span-1">
          <SettingsPanel 
            settings={settings} 
            onChange={setSettings} 
            component="healer"
          />
        </div>
      </div>

      {/* Log Output - Full width below grid, collapsed by default */}
      <div className="mt-6 w-full">
        <LogOutput logs={logs} title="Healer Logs" />
      </div>
    </div>
  );
}

