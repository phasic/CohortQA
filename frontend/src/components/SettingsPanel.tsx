import { useState } from 'react';
import { Settings } from 'lucide-react';

interface ComponentSettings {
  useAI: boolean;
  aiProvider: string;
  aiModel: string;
}

interface SettingsData {
  planner: ComponentSettings;
  generator: ComponentSettings;
  healer: ComponentSettings;
  tts: {
    useTTS: boolean;
    ttsProvider: string;
    ttsVoice: string;
  };
}

interface SettingsPanelProps {
  settings: SettingsData;
  onChange: (settings: SettingsData) => void;
  component: 'planner' | 'generator' | 'healer'; // Which component this panel is for
}

export default function SettingsPanel({ settings, onChange, component }: SettingsPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const showTTS = component === 'planner';

  const updateComponentSetting = <K extends keyof ComponentSettings>(
    key: K,
    value: ComponentSettings[K]
  ) => {
    onChange({
      ...settings,
      [component]: {
        ...settings[component],
        [key]: value,
      },
    });
  };

  const updateTTSSetting = <K extends keyof SettingsData['tts']>(
    key: K,
    value: SettingsData['tts'][K]
  ) => {
    onChange({
      ...settings,
      tts: {
        ...settings.tts,
        [key]: value,
      },
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between text-left border-b border-gray-200 dark:border-gray-700"
      >
        <div className="flex items-center">
          <Settings className="w-5 h-5 mr-2 text-gray-500 dark:text-gray-400" />
          <span className="font-medium text-gray-900 dark:text-white">Settings</span>
        </div>
        <svg
          className={`w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform ${
            expanded ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="p-4 space-y-4">
          {/* Component-specific AI Settings */}
          <div>
            <div className="mb-2">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                {component.charAt(0).toUpperCase() + component.slice(1)} AI Settings
              </span>
            </div>
            <label className="flex items-center mb-2">
              <input
                type="checkbox"
                checked={settings[component].useAI}
                onChange={(e) => updateComponentSetting('useAI', e.target.checked)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                Enable AI
              </span>
            </label>

            {settings[component].useAI && (
              <div className="ml-6 space-y-2 mt-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    AI Provider
                  </label>
                  <select
                    value={settings[component].aiProvider}
                    onChange={(e) => updateComponentSetting('aiProvider', e.target.value)}
                    className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-700 dark:text-white text-sm px-2 py-1"
                  >
                    <option value="heuristic">Heuristic</option>
                    <option value="ollama">Ollama</option>
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    AI Model
                  </label>
                  <input
                    type="text"
                    value={settings[component].aiModel}
                    onChange={(e) => updateComponentSetting('aiModel', e.target.value)}
                    placeholder="e.g., mistral, gpt-4o-mini"
                    className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-700 dark:text-white text-sm px-2 py-1"
                  />
                </div>
              </div>
            )}
          </div>

          {/* TTS Settings - Only for Planner */}
          {showTTS && (
            <div>
              <div className="mb-2">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                  TTS Settings
                </span>
              </div>
              <label className="flex items-center mb-2">
                <input
                  type="checkbox"
                  checked={settings.tts.useTTS}
                  onChange={(e) => updateTTSSetting('useTTS', e.target.checked)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Enable TTS
                </span>
              </label>

              {settings.tts.useTTS && (
                <div className="ml-6 space-y-2 mt-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      TTS Provider
                    </label>
                    <select
                      value={settings.tts.ttsProvider}
                      onChange={(e) => updateTTSSetting('ttsProvider', e.target.value)}
                      className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-700 dark:text-white text-sm px-2 py-1"
                    >
                      <option value="openai">OpenAI</option>
                      <option value="piper">Piper</option>
                      <option value="macos">macOS</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      TTS Voice
                    </label>
                    <input
                      type="text"
                      value={settings.tts.ttsVoice}
                      onChange={(e) => updateTTSSetting('ttsVoice', e.target.value)}
                      placeholder="e.g., nova, amy"
                      className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-700 dark:text-white text-sm px-2 py-1"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

