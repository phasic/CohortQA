import { FileCode } from 'lucide-react';

interface DiffViewerProps {
  original: string;
  modified: string;
  fileName?: string;
}

export default function DiffViewer({ original, modified, fileName }: DiffViewerProps) {
  // Simple line-by-line diff
  const originalLines = original.split('\n');
  const modifiedLines = modified.split('\n');
  const maxLines = Math.max(originalLines.length, modifiedLines.length);

  const getLineDiff = (index: number) => {
    const orig = originalLines[index] || '';
    const mod = modifiedLines[index] || '';
    
    if (orig === mod) {
      return { type: 'unchanged', original: orig, modified: mod };
    }
    if (orig === '') {
      return { type: 'added', original: orig, modified: mod };
    }
    if (mod === '') {
      return { type: 'removed', original: orig, modified: mod };
    }
    return { type: 'modified', original: orig, modified: mod };
  };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center">
        <FileCode className="w-4 h-4 mr-2 text-gray-500" />
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {fileName || 'Diff'}
        </h4>
      </div>
      <div className="font-mono text-xs max-h-96 overflow-y-auto">
        <table className="w-full">
          <tbody>
            {Array.from({ length: maxLines }, (_, i) => {
              const diff = getLineDiff(i);
              const lineNum = i + 1;
              
              return (
                <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="px-2 py-1 text-gray-500 text-right w-12 border-r border-gray-200 dark:border-gray-700">
                    {lineNum}
                  </td>
                  <td
                    className={`px-2 py-1 ${
                      diff.type === 'removed'
                        ? 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300'
                        : diff.type === 'added'
                        ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300'
                        : diff.type === 'modified'
                        ? 'bg-yellow-50 dark:bg-yellow-900/20'
                        : 'bg-white dark:bg-gray-900'
                    }`}
                  >
                    {diff.type === 'removed' || diff.type === 'modified' ? (
                      <span className="line-through opacity-60">{diff.original}</span>
                    ) : null}
                  </td>
                  <td
                    className={`px-2 py-1 ${
                      diff.type === 'added'
                        ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300'
                        : diff.type === 'modified'
                        ? 'bg-yellow-50 dark:bg-yellow-900/20'
                        : 'bg-white dark:bg-gray-900'
                    }`}
                  >
                    {diff.type === 'added' || diff.type === 'modified' ? diff.modified : diff.original}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

