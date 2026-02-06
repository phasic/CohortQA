#!/bin/bash

echo "🔍 Checking AI Setup..."
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check Ollama installation
if command -v ollama &> /dev/null; then
    echo -e "${GREEN}✓ Ollama is installed${NC}"
    OLLAMA_PATH=$(which ollama)
    echo "  Location: $OLLAMA_PATH"
else
    echo -e "${RED}✗ Ollama is not installed${NC}"
    echo "  Install with: brew install ollama"
    exit 1
fi

echo ""

# Check if Ollama server is running
echo "Checking Ollama server status..."
if curl -s http://localhost:11434/api/tags &> /dev/null; then
    echo -e "${GREEN}✓ Ollama server is running${NC}"
    SERVER_RUNNING=true
else
    echo -e "${RED}✗ Ollama server is NOT running${NC}"
    echo -e "${YELLOW}  Start it with: ollama serve${NC}"
    SERVER_RUNNING=false
fi

echo ""

# Check for Mistral model
if [ "$SERVER_RUNNING" = true ]; then
    echo "Checking for Mistral model..."
    if curl -s http://localhost:11434/api/tags | grep -q "mistral"; then
        echo -e "${GREEN}✓ Mistral model is available${NC}"
    else
        echo -e "${YELLOW}⚠ Mistral model not found${NC}"
        echo -e "${YELLOW}  Pull it with: ollama pull mistral${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Cannot check models - server is not running${NC}"
fi

echo ""

# Check environment variables
echo "Checking environment variables..."
if [ -n "$OPENAI_API_KEY" ]; then
    echo -e "${GREEN}✓ OPENAI_API_KEY is set${NC}"
else
    echo -e "${YELLOW}  OPENAI_API_KEY not set (optional)${NC}"
fi

if [ -n "$ANTHROPIC_API_KEY" ]; then
    echo -e "${GREEN}✓ ANTHROPIC_API_KEY is set${NC}"
else
    echo -e "${YELLOW}  ANTHROPIC_API_KEY not set (optional)${NC}"
fi

if [ -n "$AI_PROVIDER" ]; then
    echo -e "${GREEN}✓ AI_PROVIDER is set to: $AI_PROVIDER${NC}"
else
    echo -e "${YELLOW}  AI_PROVIDER not set (will auto-detect)${NC}"
fi

echo ""

# Summary
if [ "$SERVER_RUNNING" = true ]; then
    echo -e "${GREEN}✅ AI setup looks good!${NC}"
    echo ""
    echo "You can now use: npm start -- plan -u <url> --ai"
else
    echo -e "${RED}❌ AI setup incomplete${NC}"
    echo ""
    echo "To fix:"
    echo "  1. Start Ollama server: ollama serve"
    echo "  2. In another terminal, pull the model: ollama pull mistral"
    echo "  3. Then run your command again"
fi

