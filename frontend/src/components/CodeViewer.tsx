import { useEffect, useState } from 'react';
import { FileCode } from 'lucide-react';

interface CodeViewerProps {
  content: string;
  fileName: string;
  language?: string;
}

export default function CodeViewer({ content, fileName, language }: CodeViewerProps) {
  const [style, setStyle] = useState<any>(null);
  const [SyntaxHighlighter, setSyntaxHighlighter] = useState<any>(null);
  const [highlighterReady, setHighlighterReady] = useState(false);

  // Load syntax highlighter and style dynamically to avoid Vite import issues
  useEffect(() => {
    // Use dynamic imports to avoid breaking if package isn't installed
    Promise.all([
      import('react-syntax-highlighter').then(m => m.Prism).catch(() => null),
      import('react-syntax-highlighter/dist/esm/styles/prism').then(m => m.vscDarkPlus).catch(() => null)
    ])
      .then(([PrismHighlighter, vscStyle]) => {
        if (PrismHighlighter && vscStyle) {
          setSyntaxHighlighter(() => PrismHighlighter);
          setStyle(vscStyle);
          setHighlighterReady(true);
        }
      })
      .catch((err) => {
        console.warn('Syntax highlighting not available. Install react-syntax-highlighter for syntax highlighting:', err);
        // Will fall back to plain text
      });
  }, []);

  // Detect language from file extension if not provided
  const detectLanguage = (filename: string): string => {
    if (!language) {
      const ext = filename.split('.').pop()?.toLowerCase();
      const langMap: Record<string, string> = {
        'ts': 'typescript',
        'tsx': 'tsx',
        'js': 'javascript',
        'jsx': 'jsx',
        'json': 'json',
        'md': 'markdown',
        'yaml': 'yaml',
        'yml': 'yaml',
        'html': 'html',
        'css': 'css',
        'scss': 'scss',
        'py': 'python',
        'java': 'java',
        'go': 'go',
        'rs': 'rust',
        'php': 'php',
        'rb': 'ruby',
        'sh': 'bash',
        'bash': 'bash',
        'sql': 'sql',
        'xml': 'xml',
      };
      return langMap[ext || ''] || 'text';
    }
    return language;
  };

  const detectedLang = detectLanguage(fileName);

  // Fallback to plain text if highlighter not loaded yet or not available
  if (!highlighterReady || !style || !SyntaxHighlighter) {
    return (
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center">
          <FileCode className="w-4 h-4 mr-2 text-gray-500" />
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {fileName}
          </h4>
          <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
            ({detectedLang})
          </span>
        </div>
        <div className="font-mono text-xs max-h-96 overflow-y-auto bg-gray-900 text-green-400 p-4">
          <pre className="whitespace-pre-wrap">{content}</pre>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center">
        <FileCode className="w-4 h-4 mr-2 text-gray-500" />
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {fileName}
        </h4>
        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
          ({detectedLang})
        </span>
      </div>
      <div className="max-h-96 overflow-y-auto">
        <SyntaxHighlighter
          language={detectedLang}
          style={style}
          customStyle={{
            margin: 0,
            padding: '1rem',
            fontSize: '0.75rem',
            lineHeight: '1.5',
          }}
          showLineNumbers
          wrapLines
          wrapLongLines
        >
          {content}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
