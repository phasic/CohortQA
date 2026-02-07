import { useState, useEffect } from 'react';
import { Terminal, ChevronDown, ChevronUp } from 'lucide-react';

interface LogOutputProps {
  logs: string[];
  title?: string;
}

export default function LogOutput({ logs, title = 'Log Output' }: LogOutputProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasLogs = logs.length > 0;

  // Auto-expand when logs start coming in
  useEffect(() => {
    if (hasLogs && !isExpanded) {
      setIsExpanded(true);
    }
  }, [hasLogs, isExpanded]);

  return (
    <div className="w-full bg-gray-900 dark:bg-gray-950 rounded-lg font-mono text-sm shadow-lg border-2 border-gray-600 dark:border-gray-700">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-800 dark:hover:bg-gray-900 transition-colors rounded-t-lg"
      >
        <div className="flex items-center text-gray-300 dark:text-gray-400">
          <Terminal className="w-5 h-5 mr-2 text-green-400" />
          <span className="font-semibold text-white dark:text-gray-200">{title}</span>
          <span className="ml-3 text-xs text-gray-500 dark:text-gray-500">({logs.length} lines)</span>
        </div>
        <div className="flex items-center">
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="overflow-y-auto max-h-96 min-h-[150px] bg-black rounded-b p-4 text-green-400 font-mono text-xs border-t-2 border-gray-700">
          {logs.length === 0 ? (
            <div className="text-gray-400 italic py-8">
              <div className="text-center">
                <div className="mb-2 text-lg">📋 Ready to capture logs</div>
                <div className="text-sm">Logs will appear here when you run an operation.</div>
              </div>
            </div>
          ) : (
            logs.map((log, index) => (
              <div key={index} className="mb-1 whitespace-pre-wrap break-words leading-relaxed">
                {log}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

