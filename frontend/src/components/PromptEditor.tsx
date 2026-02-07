import { useState, useEffect } from 'react';
import { X, RotateCcw } from 'lucide-react';

interface PromptEditorProps {
  isOpen: boolean;
  onClose: () => void;
  component: 'planner' | 'generator' | 'healer';
  currentPrompt: string;
  defaultPrompt: string;
  onSave: (prompt: string) => void;
  title?: string; // Optional custom title
}

export default function PromptEditor({
  isOpen,
  onClose,
  component,
  currentPrompt,
  defaultPrompt,
  onSave,
  title,
}: PromptEditorProps) {
  const [prompt, setPrompt] = useState(currentPrompt);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPrompt(currentPrompt);
      setHasChanges(false);
    }
  }, [isOpen, currentPrompt]);

  const handleChange = (value: string) => {
    setPrompt(value);
    setHasChanges(value !== defaultPrompt);
  };

  const handleRevert = () => {
    setPrompt(defaultPrompt);
    setHasChanges(false);
  };

  const handleSave = () => {
    onSave(prompt);
    setHasChanges(false);
    onClose();
  };

  const handleCancel = () => {
    setPrompt(currentPrompt);
    setHasChanges(false);
    onClose();
  };

  if (!isOpen) return null;

  const componentName = component.charAt(0).toUpperCase() + component.slice(1);
  const displayTitle = title || `Edit ${componentName} System Prompt`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {displayTitle}
          </h2>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col p-4">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Customize the system prompt that guides the AI for {component} operations.
              Use placeholders like {'{title}'}, {'{url}'}, etc. that will be replaced at runtime.
            </p>
            <button
              onClick={handleRevert}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Revert to Default
            </button>
          </div>

          <div className="flex-1 overflow-hidden flex flex-col">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              System Prompt
            </label>
            <textarea
              value={prompt}
              onChange={(e) => handleChange(e.target.value)}
              className="flex-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white font-mono text-sm resize-none"
              placeholder="Enter the system prompt..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-md transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

