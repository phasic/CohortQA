/**
 * Provider-specific options for AI models and TTS voices
 */

export const AI_MODELS = {
  heuristic: [],
  ollama: [
    'mistral',
    'llama2',
    'llama3',
    'codellama',
    'phi',
    'neural-chat',
    'starling-lm',
    'mixtral',
  ],
  openai: [
    'gpt-4o-mini',
    'gpt-4o',
    'gpt-4-turbo',
    'gpt-4',
    'gpt-3.5-turbo',
  ],
  anthropic: [
    'claude-3-haiku-20240307',
    'claude-3-opus-20240229',
    'claude-3-sonnet-20240229',
    'claude-3-5-sonnet-20241022',
  ],
};

export const TTS_VOICES = {
  openai: [
    'alloy',
    'echo',
    'fable',
    'onyx',
    'nova',
    'shimmer',
  ],
  piper: [
    'amy',
    'lessac',
    'joe',
  ],
  macos: [
    'Samantha',
    'Alex',
    'Victoria',
    'Daniel',
    'Karen',
    'Moira',
    'Tessa',
    'Veena',
    'Fiona',
    'Fred',
  ],
};

export const TTS_MODELS = {
  openai: [
    'tts-1',
    'tts-1-hd',
  ],
  piper: [], // Piper doesn't use model selection in the same way
  macos: [], // macOS doesn't use model selection
};

/**
 * Get default model for a provider
 */
export function getDefaultAIModel(provider: string): string {
  const models = AI_MODELS[provider as keyof typeof AI_MODELS];
  return models && models.length > 0 ? models[0] : '';
}

/**
 * Get default TTS voice for a provider
 */
export function getDefaultTTSVoice(provider: string): string {
  const voices = TTS_VOICES[provider as keyof typeof TTS_VOICES];
  return voices && voices.length > 0 ? voices[0] : '';
}

/**
 * Get default TTS model for a provider
 */
export function getDefaultTTSModel(provider: string): string {
  const models = TTS_MODELS[provider as keyof typeof TTS_MODELS];
  return models && models.length > 0 ? models[0] : 'tts-1';
}

