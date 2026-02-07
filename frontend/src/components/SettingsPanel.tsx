import { useState } from 'react';
import { Settings, FileText, User } from 'lucide-react';
import { AI_MODELS, TTS_VOICES, getDefaultAIModel, getDefaultTTSVoice } from '../constants/providerOptions';
import PromptEditor from './PromptEditor';
import PersonalityEditor from './PersonalityEditor';
import { DEFAULT_PROMPTS } from '../constants/defaultPrompts';

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
}

interface SettingsPanelProps {
  settings: SettingsData;
  onChange: (settings: SettingsData) => void;
  component: 'planner' | 'generator' | 'healer'; // Which component this panel is for
  customPrompts?: {
    planner?: string;
    generator?: string;
    healer?: string;
    tts?: {
      prefix?: string;
      thinking?: string;
      personalityDescriptions?: {
        thinking?: string;
        realizing?: string;
        deciding?: string;
        acting?: string;
      };
    };
  };
  onPromptChange?: (component: 'planner' | 'generator' | 'healer', prompt: string) => void;
  onTTSPromptChange?: (type: 'prefix' | 'thinking', prompt: string) => void;
  onTTSPersonalityChange?: (descriptions: {
    thinking: string;
    realizing: string;
    deciding: string;
    acting: string;
  }) => void;
}

export default function SettingsPanel({ 
  settings, 
  onChange, 
  component,
  customPrompts,
  onPromptChange,
  onTTSPromptChange,
  onTTSPersonalityChange,
}: SettingsPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const [promptEditorOpen, setPromptEditorOpen] = useState(false);
  const [ttsPromptEditorOpen, setTTSPromptEditorOpen] = useState(false);
  const [personalityEditorOpen, setPersonalityEditorOpen] = useState(false);
  const [ttsPromptType, setTTSPromptType] = useState<'prefix' | 'thinking'>('prefix');
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

                {/* Prompt Editor Button */}
                {settings[component].useAI && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <button
                      onClick={() => setPromptEditorOpen(true)}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-md transition-colors"
                    >
                      <FileText className="w-4 h-4" />
                      Edit System Prompt
                    </button>
                    {customPrompts?.[component] && customPrompts[component] !== DEFAULT_PROMPTS[component] && (
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 italic">
                        Using custom prompt
                      </p>
                    )}
                  </div>
                )}
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

                  {/* TTS Prompt Editor Button */}
                  {settings.tts.useTTS && (
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                      <div className="mb-2">
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          TTS Prompts
                        </label>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setTTSPromptType('prefix');
                              setTTSPromptEditorOpen(true);
                            }}
                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-md transition-colors"
                          >
                            <FileText className="w-4 h-4" />
                            Edit Prefix Prompt
                          </button>
                          <button
                            onClick={() => {
                              setTTSPromptType('thinking');
                              setTTSPromptEditorOpen(true);
                            }}
                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-md transition-colors"
                          >
                            <FileText className="w-4 h-4" />
                            Edit Thinking Prompt
                          </button>
                        </div>
                        {(customPrompts?.tts?.prefix || customPrompts?.tts?.thinking) && (
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 italic">
                            Using custom TTS prompts
                          </p>
                        )}
                      </div>

                      {/* Personality Descriptions Editor Button */}
                      {settings.tts.useTTS && (
                        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                          <button
                            onClick={() => setPersonalityEditorOpen(true)}
                            className="flex items-center justify-center gap-2 w-full px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-md transition-colors"
                          >
                            <User className="w-4 h-4" />
                            Edit Personality Descriptions
                          </button>
                          {customPrompts?.tts?.personalityDescriptions && (
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 italic">
                              Using custom personality descriptions
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* AI Prompt Editor Modal */}
      {onPromptChange && (
        <PromptEditor
          isOpen={promptEditorOpen}
          onClose={() => setPromptEditorOpen(false)}
          component={component}
          currentPrompt={customPrompts?.[component] || DEFAULT_PROMPTS[component]}
          defaultPrompt={DEFAULT_PROMPTS[component]}
          onSave={(prompt) => {
            onPromptChange(component, prompt);
            setPromptEditorOpen(false);
          }}
        />
      )}

      {/* TTS Prompt Editor Modal */}
      {onTTSPromptChange && showTTS && (
        <PromptEditor
          isOpen={ttsPromptEditorOpen}
          onClose={() => setTTSPromptEditorOpen(false)}
          component="planner"
          currentPrompt={
            customPrompts?.tts?.[ttsPromptType] || 
            DEFAULT_PROMPTS.tts[ttsPromptType]
          }
          defaultPrompt={DEFAULT_PROMPTS.tts[ttsPromptType]}
          onSave={(prompt) => {
            onTTSPromptChange(ttsPromptType, prompt);
            setTTSPromptEditorOpen(false);
          }}
          title={`Edit TTS ${ttsPromptType === 'prefix' ? 'Prefix' : 'Thinking'} Prompt`}
        />
      )}

      {/* Personality Descriptions Editor Modal */}
      {onTTSPersonalityChange && showTTS && (
        <PersonalityEditor
          isOpen={personalityEditorOpen}
          onClose={() => setPersonalityEditorOpen(false)}
          currentDescriptions={{
            thinking: customPrompts?.tts?.personalityDescriptions?.thinking || DEFAULT_PROMPTS.tts.personalityDescriptions.thinking,
            realizing: customPrompts?.tts?.personalityDescriptions?.realizing || DEFAULT_PROMPTS.tts.personalityDescriptions.realizing,
            deciding: customPrompts?.tts?.personalityDescriptions?.deciding || DEFAULT_PROMPTS.tts.personalityDescriptions.deciding,
            acting: customPrompts?.tts?.personalityDescriptions?.acting || DEFAULT_PROMPTS.tts.personalityDescriptions.acting,
          }}
          defaultDescriptions={DEFAULT_PROMPTS.tts.personalityDescriptions}
          onSave={(descriptions) => {
            onTTSPersonalityChange(descriptions);
            setPersonalityEditorOpen(false);
          }}
        />
      )}
    </div>
  );
}

