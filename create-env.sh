#!/bin/bash

# Simple script to create .env file

if [ -f ".env" ]; then
    echo "✅ .env file already exists"
    exit 0
fi

if [ -f ".env.example" ]; then
    echo "📋 Copying .env.example to .env..."
    cp .env.example .env
    echo "✅ .env file created from .env.example"
else
    echo "📝 Creating basic .env file..."
    cat > .env << 'EOF'
# OpenAI API Key for Text-to-Speech
# Get your API key from: https://platform.openai.com/api-keys
# OPENAI_API_KEY=your-openai-api-key-here

# Optional: OpenAI TTS Model (default: tts-1)
# Options: tts-1, tts-1-hd
# OPENAI_MODEL=tts-1

# Optional: OpenAI TTS Voice (default: nova)
# Options: alloy, echo, fable, onyx, nova, shimmer
# OPENAI_VOICE=nova

# Planner AI Provider (for element selection)
# Options: openai, anthropic, ollama
# Default: ollama (Mistral)
# PLANNER_AI_PROVIDER=ollama
# PLANNER_AI_MODEL=mistral

# TTS Provider (for text-to-speech)
# Options: openai, piper, macos
# Default: openai (if OPENAI_API_KEY is set), otherwise piper or macos
# TTS_PROVIDER=openai
# TTS_MODEL=tts-1
# TTS_VOICE=nova

# Optional: Ollama settings (if using Ollama for AI)
# OLLAMA_URL=http://localhost:11434/api/chat
# OLLAMA_MODEL=mistral

# Optional: Piper TTS voice (if using Piper instead of OpenAI)
# Options: amy, lessac, joe, or full path to .onnx file
# PIPER_VOICE=amy
EOF
    echo "✅ .env file created"
fi

echo ""
echo "⚠️  Don't forget to edit .env and add your API keys!"
echo "   - Uncomment and set OPENAI_API_KEY for OpenAI TTS"
echo "   - Or set other API keys as needed"

