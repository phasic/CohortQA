import { useState, useEffect } from 'react';
import { File, Folder, ChevronRight, ChevronDown } from 'lucide-react';
import { api } from '../services/api';

interface FileItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
  content?: string;
}

interface FileBrowserProps {
  basePath: string;
  onFileSelect?: (file: FileItem) => void;
}

export default function FileBrowser({ basePath, onFileSelect }: FileBrowserProps) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);

  useEffect(() => {
    loadFiles();
  }, [basePath]);

  const loadFiles = async () => {
    if (!basePath) return;
    setLoading(true);
    try {
      const response = await api.get(`/healer/files?path=${encodeURIComponent(basePath)}`);
      setFiles(response.data.files || []);
    } catch (err) {
      console.error('Failed to load files:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = async (file: FileItem) => {
    if (file.type === 'directory') {
      const newExpanded = new Set(expanded);
      if (newExpanded.has(file.path)) {
        newExpanded.delete(file.path);
      } else {
        newExpanded.add(file.path);
        // Load directory contents
        try {
          const response = await api.get(`/healer/files?path=${encodeURIComponent(file.path)}`);
          const newFiles = response.data.files || [];
          setFiles(prev => {
            const filtered = prev.filter(f => !f.path.startsWith(file.path + '/') || f.path === file.path);
            return [...filtered, ...newFiles];
          });
        } catch (err) {
          console.error('Failed to load directory:', err);
        }
      }
      setExpanded(newExpanded);
    } else {
      // Load file content
      try {
        const response = await api.get(`/healer/file-content?path=${encodeURIComponent(file.path)}`);
        const fileWithContent = { ...file, content: response.data.content };
        setSelectedFile(fileWithContent);
        if (onFileSelect) {
          onFileSelect(fileWithContent);
        }
      } catch (err) {
        console.error('Failed to load file content:', err);
      }
    }
  };

  const renderFile = (file: FileItem, level: number = 0) => {
    const isExpanded = expanded.has(file.path);
    const isSelected = selectedFile?.path === file.path;

    return (
      <div key={file.path}>
        <div
          onClick={() => toggleExpand(file)}
          className={`flex items-center py-1 px-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 rounded ${
            isSelected ? 'bg-blue-50 dark:bg-blue-900' : ''
          }`}
          style={{ paddingLeft: `${level * 1.5 + 0.5}rem` }}
        >
          {file.type === 'directory' ? (
            <>
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 mr-1 text-gray-500" />
              ) : (
                <ChevronRight className="w-4 h-4 mr-1 text-gray-500" />
              )}
              <Folder className="w-4 h-4 mr-2 text-blue-500" />
            </>
          ) : (
            <>
              <div className="w-5 mr-2" />
              <File className="w-4 h-4 mr-2 text-gray-500" />
            </>
          )}
          <span className="text-sm text-gray-700 dark:text-gray-300">{file.name}</span>
        </div>
        {file.type === 'directory' && isExpanded && (
          <div>
            {files
              .filter(f => f.path.startsWith(file.path + '/') && f.path.split('/').length === file.path.split('/').length + 1)
              .map(f => renderFile(f, level + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return <div className="text-center py-4 text-gray-500">Loading files...</div>;
  }

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Files</h4>
      </div>
      <div className="max-h-96 overflow-y-auto">
        {files.filter(f => !f.path.includes('/') || f.path.split('/').length === 1).map(file => renderFile(file))}
      </div>
    </div>
  );
}

