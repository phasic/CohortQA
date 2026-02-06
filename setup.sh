#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting Cohort QA Setup...${NC}"
echo ""

# Function to prompt for yes/no
prompt_yes_no() {
    local prompt="$1"
    local default="${2:-n}"
    local response
    
    while true; do
        if [ "$default" = "y" ]; then
            read -p "$prompt [Y/n]: " response
        else
            read -p "$prompt [y/N]: " response
        fi
        
        response=${response:-$default}
        case "$response" in
            [Yy]* ) return 0;;
            [Nn]* ) return 1;;
            * ) echo "Please answer yes or no.";;
        esac
    done
}

# Function to check if a command exists
command_exists() {
    type "$1" &> /dev/null
}

# Function to install Piper TTS binary
install_piper_binary() {
    echo -e "${BLUE}  Downloading Piper TTS binary...${NC}"
    
    # Detect architecture
    ARCH=$(uname -m)
    if [ "$ARCH" = "arm64" ] || [ "$ARCH" = "aarch64" ]; then
        PLATFORM="mac-arm64"
    else
        PLATFORM="mac-amd64"
    fi
    
    # Create bin directory
    PIPER_DIR="$HOME/.local/bin"
    mkdir -p "$PIPER_DIR"
    
    # Download latest release (using GitHub API to get latest version)
    LATEST_VERSION=$(curl -s https://api.github.com/repos/rhasspy/piper/releases/latest | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')
    
    if [ -z "$LATEST_VERSION" ]; then
        echo -e "${YELLOW}  Could not determine latest version, trying v1.2.0...${NC}"
        LATEST_VERSION="v1.2.0"
    fi
    
    PIPER_URL="https://github.com/rhasspy/piper/releases/download/${LATEST_VERSION}/piper_${PLATFORM}.tar.gz"
    
    echo "   Downloading from: $PIPER_URL"
    cd "$PIPER_DIR"
    curl -L -o piper.tar.gz "$PIPER_URL"
    
    if [ $? -eq 0 ] && [ -f "piper.tar.gz" ]; then
        tar -xzf piper.tar.gz
        rm piper.tar.gz
        chmod +x piper 2>/dev/null || true
        
        # Check if piper is now in PATH or add to PATH
        if [ -f "$PIPER_DIR/piper" ]; then
            echo -e "${GREEN}✓ Piper TTS binary downloaded to $PIPER_DIR${NC}"
            echo -e "${YELLOW}  Note: Make sure $PIPER_DIR is in your PATH${NC}"
            echo "   Add to ~/.zshrc or ~/.bashrc: export PATH=\"\$HOME/.local/bin:\$PATH\""
        else
            echo -e "${YELLOW}⚠️  Binary extraction may have failed${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  Binary download failed${NC}"
        echo "   You can install manually: pip install piper-tts"
        echo "   Or download from: https://github.com/rhasspy/piper/releases"
    fi
}

# Exit immediately if a command exits with a non-zero status.
set -e

# 1. Check Node.js version
echo -e "${BLUE}Checking Node.js version (requires 18+)...${NC}"
NODE_MAJOR_VERSION=$(node -v | cut -d '.' -f 1 | sed 's/v//')
if (( NODE_MAJOR_VERSION < 18 )); then
    echo -e "${RED}❌ Node.js version 18 or higher is required. Found v${NODE_MAJOR_VERSION}.${NC}"
    echo "   Please update Node.js. You can use nvm (Node Version Manager) for this."
    exit 1
fi
echo -e "${GREEN}✓ Node.js v${NODE_MAJOR_VERSION} is installed${NC}"
echo ""

# 2. Install npm dependencies
echo -e "${BLUE}📦 Installing npm dependencies...${NC}"
npm install
echo -e "${GREEN}✓ npm dependencies installed${NC}"
echo ""

# 3. Build TypeScript project
echo -e "${BLUE}🛠️ Building TypeScript project...${NC}"
npm run build
echo -e "${GREEN}✓ Project built successfully${NC}"
echo ""

# 4. Install Playwright browsers
echo -e "${BLUE}🌐 Installing Playwright browsers...${NC}"
npx playwright install chromium

if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠️  Playwright browser installation failed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Playwright browsers installed${NC}"
echo ""

# 5. Check for Ollama and Mistral (optional, for AI features)
echo -e "${BLUE}🤖 AI Integration Setup (Optional)${NC}"
echo ""

if prompt_yes_no "Do you want to enable AI-powered exploration? (Requires Ollama + Mistral model)" "n"; then
    echo ""
    echo -e "${BLUE}Checking for Ollama...${NC}"
    
    if command_exists ollama; then
        echo -e "${GREEN}✓ Ollama is installed${NC}"
        
        # Check if Ollama server is running
        if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Ollama server is running${NC}"
        else
            echo -e "${YELLOW}  Ollama server is not running. Attempting to start it...${NC}"
            # Start Ollama server in the background
            ollama serve > /dev/null 2>&1 &
            OLLAMA_PID=$!
            echo "  Ollama server started with PID: $OLLAMA_PID"
            echo "  Waiting for Ollama server to become ready..."
            # Wait for a few seconds for the server to start
            sleep 5
            if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
                echo -e "${GREEN}✓ Ollama server is now running${NC}"
            else
                echo -e "${RED}❌ Failed to start Ollama server automatically.${NC}"
                echo "   Please start it manually by running 'ollama serve' in a separate terminal."
                echo "   Then re-run this setup script or proceed without AI features."
                # Kill the background process if it failed to start properly
                kill $OLLAMA_PID 2>/dev/null || true
            fi
        fi

        # Check if mistral model is available
        if ollama list 2>/dev/null | grep -q "mistral"; then
            echo -e "${GREEN}✓ Mistral model is already available${NC}"
        else
            if prompt_yes_no "  Mistral model not found. Download it now? (~4GB)" "y"; then
                echo -e "${YELLOW}  Pulling Mistral model (this may take a few minutes)...${NC}"
                ollama pull mistral
                echo -e "${GREEN}✓ Mistral model installed${NC}"
            else
                echo -e "${YELLOW}  Skipping Mistral installation. You can install it later with: ollama pull mistral${NC}"
            fi
        fi
    else
        echo -e "${YELLOW}⚠️  Ollama is not installed${NC}"
        if prompt_yes_no "  Install Ollama now? (macOS: via Homebrew)" "y"; then
            if command_exists brew; then
                echo -e "${BLUE}  Installing Ollama via Homebrew...${NC}"
                brew install ollama
                echo -e "${GREEN}✓ Ollama installed${NC}"
                
                # Try to start Ollama server
                echo -e "${BLUE}  Starting Ollama server...${NC}"
                ollama serve > /dev/null 2>&1 &
                OLLAMA_PID=$!
                sleep 5
                
                if prompt_yes_no "  Download Mistral model now? (~4GB)" "y"; then
                    echo -e "${YELLOW}  Pulling Mistral model (this may take a few minutes)...${NC}"
                    ollama pull mistral
                    echo -e "${GREEN}✓ Mistral model installed${NC}"
                fi
            else
                echo -e "${RED}❌ Homebrew is not installed.${NC}"
                echo "   Please install Homebrew first: https://brew.sh"
                echo "   Or install Ollama manually: https://ollama.ai"
            fi
        else
            echo -e "${YELLOW}  Skipping Ollama installation. You can install it later:${NC}"
            echo "   - macOS: brew install ollama"
            echo "   - Or visit: https://ollama.ai"
        fi
    fi
else
    echo -e "${YELLOW}  Skipping AI setup. The planner will use heuristics instead.${NC}"
    echo "   You can enable AI later by installing Ollama and running: ollama pull mistral"
fi

echo ""

# 6. Check for Piper TTS (optional, for TTS features)
echo -e "${BLUE}🔊 Text-to-Speech Setup (Optional)${NC}"
echo ""

if prompt_yes_no "Do you want to enable text-to-speech? (Requires Piper TTS for natural voices)" "n"; then
    echo ""
    echo -e "${BLUE}Checking for Piper TTS...${NC}"
    
    if command_exists piper; then
        echo -e "${GREEN}✓ Piper TTS is installed${NC}"
        
        # Check if voice model exists
        VOICE_MODEL="$HOME/.local/share/piper/voices/en/en_US/amy/medium/en_US-amy-medium.onnx"
        if [ -f "$VOICE_MODEL" ]; then
            echo -e "${GREEN}✓ Voice model found${NC}"
        else
            if prompt_yes_no "  Voice model not found. Download it now? (~50MB)" "y"; then
                echo -e "${BLUE}  Downloading voice model (en_US-amy-medium)...${NC}"
                
                # Create voice directory
                VOICE_DIR="$HOME/.local/share/piper/voices/en/en_US/amy/medium"
                mkdir -p "$VOICE_DIR"
                cd "$VOICE_DIR"
                
                # Download voice model files
                if [ ! -f "en_US-amy-medium.onnx" ]; then
                    echo "   Downloading model file..."
                    curl -L -o en_US-amy-medium.onnx \
                        "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/amy/medium/en_US-amy-medium.onnx"
                fi
                
                if [ ! -f "en_US-amy-medium.onnx.json" ]; then
                    echo "   Downloading model config..."
                    curl -L -o en_US-amy-medium.onnx.json \
                        "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/amy/medium/en_US-amy-medium.onnx.json"
                fi
                
                if [ -f "en_US-amy-medium.onnx" ] && [ -f "en_US-amy-medium.onnx.json" ]; then
                    echo -e "${GREEN}✓ Voice model downloaded${NC}"
                else
                    echo -e "${YELLOW}⚠️  Voice model download failed${NC}"
                    echo "   You can download manually from: https://huggingface.co/rhasspy/piper-voices"
                fi
            else
                echo -e "${YELLOW}  Skipping voice model download. You can download it later.${NC}"
            fi
        fi
    else
        echo -e "${YELLOW}⚠️  Piper TTS is not installed${NC}"
        if prompt_yes_no "  Install Piper TTS now? (via pipx or binary download)" "y"; then
            # Try pipx first (recommended for Python applications)
            if command_exists pipx; then
                echo -e "${BLUE}  Installing Piper TTS via pipx...${NC}"
                pipx install piper-tts
                if [ $? -eq 0 ]; then
                    echo -e "${GREEN}✓ Piper TTS installed via pipx${NC}"
                    # Fix common dependency issues
                    echo -e "${BLUE}  Ensuring all dependencies are installed...${NC}"
                    pipx inject piper-tts pathvalidate 2>/dev/null || true
                    # Test if piper works
                    if ~/.local/bin/piper --help > /dev/null 2>&1; then
                        echo -e "${GREEN}✓ Piper TTS is working correctly${NC}"
                    else
                        echo -e "${YELLOW}  Piper TTS may have dependency issues. Trying to fix...${NC}"
                        pipx reinstall piper-tts 2>/dev/null || {
                            echo -e "${YELLOW}  pipx reinstall failed, trying binary download...${NC}"
                            install_piper_binary
                        }
                    fi
                else
                    echo -e "${YELLOW}  pipx installation failed, trying binary download...${NC}"
                    install_piper_binary
                fi
            elif command_exists brew; then
                # Offer to install pipx via Homebrew
                if prompt_yes_no "  pipx not found. Install pipx via Homebrew? (recommended)" "y"; then
                    echo -e "${BLUE}  Installing pipx via Homebrew...${NC}"
                    brew install pipx
                    if [ $? -eq 0 ]; then
                        echo -e "${GREEN}✓ pipx installed${NC}"
                        # Ensure pipx is in PATH
                        pipx ensurepath 2>/dev/null || true
                        echo -e "${BLUE}  Installing Piper TTS via pipx...${NC}"
                        pipx install piper-tts
                        if [ $? -eq 0 ]; then
                            echo -e "${GREEN}✓ Piper TTS installed via pipx${NC}"
                            # Fix common dependency issues
                            echo -e "${BLUE}  Ensuring all dependencies are installed...${NC}"
                            pipx inject piper-tts pathvalidate 2>/dev/null || true
                            # Test if piper works
                            if ~/.local/bin/piper --help > /dev/null 2>&1; then
                                echo -e "${GREEN}✓ Piper TTS is working correctly${NC}"
                            else
                                echo -e "${YELLOW}  Piper TTS may have dependency issues. Trying to fix...${NC}"
                                pipx reinstall piper-tts 2>/dev/null || {
                                    echo -e "${YELLOW}  pipx reinstall failed, trying binary download...${NC}"
                                    install_piper_binary
                                }
                            fi
                        else
                            echo -e "${YELLOW}  pipx installation failed, trying binary download...${NC}"
                            install_piper_binary
                        fi
                    else
                        echo -e "${YELLOW}  pipx installation failed, trying binary download...${NC}"
                        install_piper_binary
                    fi
                else
                    echo -e "${YELLOW}  Skipping pipx installation, downloading binary...${NC}"
                    install_piper_binary
                fi
            else
                echo -e "${YELLOW}  pipx not found and Homebrew not available, downloading binary...${NC}"
                install_piper_binary
            fi
            
            # After installation, prompt for voice model
            if prompt_yes_no "  Download voice model now? (~50MB)" "y"; then
                echo -e "${BLUE}  Downloading voice model (en_US-amy-medium)...${NC}"
                
                # Create voice directory
                VOICE_DIR="$HOME/.local/share/piper/voices/en/en_US/amy/medium"
                mkdir -p "$VOICE_DIR"
                cd "$VOICE_DIR"
                
                # Download voice model files
                if [ ! -f "en_US-amy-medium.onnx" ]; then
                    echo "   Downloading model file..."
                    curl -L -o en_US-amy-medium.onnx \
                        "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/amy/medium/en_US-amy-medium.onnx"
                fi
                
                if [ ! -f "en_US-amy-medium.onnx.json" ]; then
                    echo "   Downloading model config..."
                    curl -L -o en_US-amy-medium.onnx.json \
                        "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/amy/medium/en_US-amy-medium.onnx.json"
                fi
                
                if [ -f "en_US-amy-medium.onnx" ] && [ -f "en_US-amy-medium.onnx.json" ]; then
                    echo -e "${GREEN}✓ Voice model downloaded${NC}"
                else
                    echo -e "${YELLOW}⚠️  Voice model download failed${NC}"
                    echo "   You can download manually from: https://huggingface.co/rhasspy/piper-voices"
                fi
            fi
        else
            echo -e "${YELLOW}  Skipping Piper TTS installation. You can install it later:${NC}"
            echo "   - pipx: pipx install piper-tts (recommended)"
            echo "   - Or download binary from: https://github.com/rhasspy/piper/releases"
            echo "   - Or run: ./install-piper.sh"
        fi
    fi
else
    echo -e "${YELLOW}  Skipping TTS setup. The planner will not speak.${NC}"
    echo "   You can enable TTS later by installing Piper TTS or setting OPENAI_API_KEY"
fi

echo ""

# 7. Environment Variables Setup
echo -e "${BLUE}📝 Environment Variables Setup${NC}"
echo ""

# Use the create-env.sh script if it exists, otherwise create .env directly
if [ -f "create-env.sh" ]; then
    echo -e "${BLUE}  Running create-env.sh...${NC}"
    bash create-env.sh
else
    # Fallback: create .env directly if create-env.sh doesn't exist
    if [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            echo -e "${BLUE}  Creating .env file from .env.example...${NC}"
            cp .env.example .env
            echo -e "${GREEN}✓ .env file created${NC}"
            echo -e "${YELLOW}  ⚠️  Don't forget to edit .env and add your API keys!${NC}"
            echo "     - OPENAI_API_KEY for OpenAI TTS (optional)"
            echo "     - ANTHROPIC_API_KEY for Anthropic AI (optional)"
        else
            echo -e "${YELLOW}  .env.example not found, creating basic .env file...${NC}"
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

# Optional: AI Provider for decision making
# Options: openai, anthropic, ollama
# AI_PROVIDER=ollama

# Optional: Ollama settings (if using Ollama for AI)
# OLLAMA_URL=http://localhost:11434/api/chat
# OLLAMA_MODEL=mistral

# Optional: Piper TTS voice (if using Piper instead of OpenAI)
# Options: amy, lessac, joe, or full path to .onnx file
# PIPER_VOICE=amy
EOF
            echo -e "${GREEN}✓ .env file created${NC}"
            echo -e "${YELLOW}  ⚠️  Don't forget to edit .env and add your API keys!${NC}"
        fi
    else
        echo -e "${GREEN}✓ .env file already exists${NC}"
        echo "   Edit it to add or update your API keys"
    fi
fi

echo ""
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo "You can now use Cohort QA:"
echo "  npm start -- interactive    # Interactive mode"
echo "  npm start -- plan -u <url>  # Generate test plan"
echo "  npm start -- full -u <url>  # Full pipeline"
echo ""
echo "Options:"
echo "  --ai   Enable AI-powered exploration (requires Ollama/Mistral or API keys)"
echo "  --tts  Enable text-to-speech (requires Piper TTS or OPENAI_API_KEY)"
echo ""
echo "Examples:"
echo "  npm start -- plan -u <url> --ai        # With AI"
echo "  npm start -- plan -u <url> --tts        # With TTS"
echo "  npm start -- plan -u <url> --ai --tts   # With both"
echo ""
