import { useState } from 'react';
import { Settings } from 'lucide-react';
import { AI_MODELS, TTS_VOICES, getDefaultAIModel, getDefaultTTSVoice } from '../constants/providerOptions';
import { PERSONALITIES, PERSONALITY_OPTIONS, Personality } from '../constants/personalities';

interface ComponentSettings {
  useAI: boolean;
  aiProvider: string;
  aiModel: string;
  headless?: boolean; // Only for planner
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
  personality?: Personality; // Global personality setting
}

interface SettingsPanelProps {
  settings: SettingsData;
  onChange: (settings: SettingsData) => void;
  component: 'planner' | 'generator' | 'healer'; // Which component this panel is for
  onPersonalityChange?: (personality: Personality) => void; // Callback for personality change
}

export default function SettingsPanel({ 
  settings, 
  onChange, 
  component,
  onPersonalityChange,
}: SettingsPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const showTTS = component === 'planner';

  const updateComponentSetting = <K extends keyof ComponentSettings>(
    key: K,
    value: ComponentSettings[K]
  ) => {
    const updatedSettings = {
      ...settings,
      [component]: {
        ...settings[component],
        [key]: value,
      },
    };

    // If provider changed, reset model to default for that provider
    if (key === 'aiProvider') {
      const defaultModel = getDefaultAIModel(value as string);
      updatedSettings[component].aiModel = defaultModel;
    }

    onChange(updatedSettings);
  };

  const updateTTSSetting = <K extends keyof SettingsData['tts']>(
    key: K,
    value: SettingsData['tts'][K]
  ) => {
    const updatedTTS = {
      ...settings.tts,
      [key]: value,
    };

    // If provider changed, reset voice to default for that provider
    if (key === 'ttsProvider') {
      updatedTTS.ttsVoice = getDefaultTTSVoice(value as string);
    }

    onChange({
      ...settings,
      tts: updatedTTS,
    });
  };

  // Get available models for current AI provider
  const availableAIModels = AI_MODELS[settings[component].aiProvider as keyof typeof AI_MODELS] || [];
  const hasAIModelOptions = availableAIModels.length > 0;

  // Get available voices for current TTS provider
  const availableTTSVoices = TTS_VOICES[settings.tts.ttsProvider as keyof typeof TTS_VOICES] || [];
  const hasTTSVoiceOptions = availableTTSVoices.length > 0;

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
                  {hasAIModelOptions ? (
                    <select
                      value={settings[component].aiModel}
                      onChange={(e) => updateComponentSetting('aiModel', e.target.value)}
                      className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-700 dark:text-white text-sm px-2 py-1"
                    >
                      {availableAIModels.map((model) => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={settings[component].aiModel}
                      onChange={(e) => updateComponentSetting('aiModel', e.target.value)}
                      placeholder="Enter model name (e.g., custom-ollama-model)"
                      className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-700 dark:text-white text-sm px-2 py-1"
                    />
                  )}
                  {!hasAIModelOptions && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {settings[component].aiProvider === 'heuristic' 
                        ? 'Heuristic mode does not use AI models'
                        : 'Enter a custom model name'}
                    </p>
                  )}
                </div>

              </div>
            )}
          </div>

          {/* Browser Settings - Only for Planner */}
          {component === 'planner' && (
            <div>
              <div className="mb-2">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                  Browser Settings
                </span>
              </div>
              <label className="flex items-center mb-2">
                <input
                  type="checkbox"
                  checked={settings.planner.headless || false}
                  onChange={(e) => updateComponentSetting('headless', e.target.checked)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Run in headless mode
                </span>
              </label>
              <p className="ml-6 text-xs text-gray-500 dark:text-gray-400 mt-1">
                Browser will run in the background without a visible window
              </p>
            </div>
          )}

          {/* Personality Settings - Only for Planner */}
          {showTTS && (
            <div>
              <div className="mb-2">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                  AI Personality
                </span>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Personality
                </label>
                <select
                  value={settings.personality || 'playful'}
                  onChange={(e) => {
                    const personality = e.target.value as Personality;
                    onChange({
                      ...settings,
                      personality,
                    });
                    if (onPersonalityChange) {
                      onPersonalityChange(personality);
                    }
                  }}
                  className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-700 dark:text-white text-sm px-2 py-1"
                >
                  {PERSONALITY_OPTIONS.map((personality) => (
                    <option key={personality} value={personality}>
                      {PERSONALITIES[personality].name} - {PERSONALITIES[personality].description}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Sets the personality for both AI decision-making and TTS responses
                </p>
              </div>
            </div>
          )}

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
                    {hasTTSVoiceOptions ? (
                      <select
                        value={settings.tts.ttsVoice}
                        onChange={(e) => updateTTSSetting('ttsVoice', e.target.value)}
                        className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-700 dark:text-white text-sm px-2 py-1"
                      >
                        {availableTTSVoices.map((voice) => (
                          <option key={voice} value={voice}>
                            {voice}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={settings.tts.ttsVoice}
                        onChange={(e) => updateTTSSetting('ttsVoice', e.target.value)}
                        placeholder="Enter voice name"
                        className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-700 dark:text-white text-sm px-2 py-1"
                      />
                    )}
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

