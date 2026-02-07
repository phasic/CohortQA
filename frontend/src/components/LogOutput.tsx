import { useEffect, useRef } from 'react';
import { Terminal } from 'lucide-react';

interface LogOutputProps {
  logs: string[];
  title?: string;
}

export default function LogOutput({ logs, title = 'Log Output' }: LogOutputProps) {
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="bg-gray-900 dark:bg-gray-950 rounded-lg p-4 font-mono text-sm">
      <div className="flex items-center mb-2 text-gray-400">
        <Terminal className="w-4 h-4 mr-2" />
        <span className="font-semibold">{title}</span>
        <span className="ml-auto text-xs">({logs.length} lines)</span>
      </div>
      <div className="overflow-y-auto max-h-96 bg-black rounded p-3 text-green-400">
        {logs.length === 0 ? (
          <div className="text-gray-500 italic">No logs yet...</div>
        ) : (
          logs.map((log, index) => (
            <div key={index} className="mb-1 whitespace-pre-wrap break-words">
              {log}
            </div>
          ))
        )}
        <div ref={logEndRef} />
      </div>
    </div>
  );
}

