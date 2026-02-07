import { useState, useEffect } from 'react';
import { X, RotateCcw } from 'lucide-react';

interface PersonalityDescriptions {
  thinking: string;
  realizing: string;
  deciding: string;
  acting: string;
}

interface PersonalityEditorProps {
  isOpen: boolean;
  onClose: () => void;
  currentDescriptions: PersonalityDescriptions;
  defaultDescriptions: PersonalityDescriptions;
  onSave: (descriptions: PersonalityDescriptions) => void;
}

export default function PersonalityEditor({
  isOpen,
  onClose,
  currentDescriptions,
  defaultDescriptions,
  onSave,
}: PersonalityEditorProps) {
  const [descriptions, setDescriptions] = useState<PersonalityDescriptions>(currentDescriptions);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDescriptions(currentDescriptions);
      setHasChanges(false);
    }
  }, [isOpen, currentDescriptions]);

  const handleChange = (personality: keyof PersonalityDescriptions, value: string) => {
    const updated = { ...descriptions, [personality]: value };
    setDescriptions(updated);
    setHasChanges(
      JSON.stringify(updated) !== JSON.stringify(defaultDescriptions)
    );
  };

  const handleRevert = () => {
    setDescriptions(defaultDescriptions);
    setHasChanges(false);
  };

  const handleSave = () => {
    onSave(descriptions);
    setHasChanges(false);
    onClose();
  };

  const handleCancel = () => {
    setDescriptions(currentDescriptions);
    setHasChanges(false);
    onClose();
  };

  if (!isOpen) return null;

  const personalityLabels: Record<keyof PersonalityDescriptions, string> = {
    thinking: 'Thinking',
    realizing: 'Realizing',
    deciding: 'Deciding',
    acting: 'Acting',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Edit TTS Personality Descriptions
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
              Customize the personality descriptions used in TTS prefix generation. These descriptions guide the AI on what type of prefix to generate for each personality type.
            </p>
            <button
              onClick={handleRevert}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Revert to Default
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4">
            {(Object.keys(descriptions) as Array<keyof PersonalityDescriptions>).map((personality) => (
              <div key={personality} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {personalityLabels[personality]} Personality
                </label>
                <textarea
                  value={descriptions[personality]}
                  onChange={(e) => handleChange(personality, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-600 dark:text-white text-sm resize-none"
                  rows={2}
                  placeholder={`Enter description for ${personalityLabels[personality].toLowerCase()} personality...`}
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Used when generating prefixes for {personalityLabels[personality].toLowerCase()} moments
                </p>
              </div>
            ))}
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

