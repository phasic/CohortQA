#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔊 Installing Piper TTS for natural, free, offline voices...${NC}"
echo ""

# Function to check if a command exists
command_exists() {
    type "$1" &> /dev/null
}

# Function to check if a command exists
command_exists() {
    type "$1" &> /dev/null
}

# Try pipx first (recommended for Python applications)
if command_exists pipx; then
    echo -e "${BLUE}📦 Installing Piper TTS via pipx...${NC}"
    pipx install piper-tts
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Piper TTS installed via pipx${NC}"
        # Fix common dependency issues
        echo -e "${BLUE}  Ensuring all dependencies are installed...${NC}"
        pipx inject piper-tts pathvalidate 2>/dev/null || true
        # Test if piper works
        if ~/.local/bin/piper --help > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Piper TTS is working correctly${NC}"
            PIPER_INSTALLED=true
        else
            echo -e "${YELLOW}⚠️  Piper TTS may have dependency issues. Trying to fix...${NC}"
            pipx reinstall piper-tts 2>/dev/null
            if [ $? -eq 0 ] && ~/.local/bin/piper --help > /dev/null 2>&1; then
                echo -e "${GREEN}✓ Piper TTS reinstalled and working${NC}"
                PIPER_INSTALLED=true
            else
                echo -e "${YELLOW}⚠️  pipx reinstall failed, trying binary download...${NC}"
                PIPER_INSTALLED=false
            fi
        fi
    else
        echo -e "${YELLOW}⚠️  pipx installation failed, trying binary download...${NC}"
        PIPER_INSTALLED=false
    fi
elif command_exists brew; then
    # Offer to install pipx
    echo -e "${YELLOW}⚠️  pipx not found. Installing pipx via Homebrew...${NC}"
    brew install pipx
    if [ $? -eq 0 ]; then
        pipx ensurepath 2>/dev/null || true
        echo -e "${BLUE}📦 Installing Piper TTS via pipx...${NC}"
        pipx install piper-tts
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓ Piper TTS installed via pipx${NC}"
            # Fix common dependency issues
            echo -e "${BLUE}  Ensuring all dependencies are installed...${NC}"
            pipx inject piper-tts pathvalidate 2>/dev/null || true
            # Test if piper works
            if ~/.local/bin/piper --help > /dev/null 2>&1; then
                echo -e "${GREEN}✓ Piper TTS is working correctly${NC}"
                PIPER_INSTALLED=true
            else
                echo -e "${YELLOW}⚠️  Piper TTS may have dependency issues. Trying to fix...${NC}"
                pipx reinstall piper-tts 2>/dev/null
                if [ $? -eq 0 ] && ~/.local/bin/piper --help > /dev/null 2>&1; then
                    echo -e "${GREEN}✓ Piper TTS reinstalled and working${NC}"
                    PIPER_INSTALLED=true
                else
                    echo -e "${YELLOW}⚠️  pipx reinstall failed, trying binary download...${NC}"
                    PIPER_INSTALLED=false
                fi
            fi
        else
            echo -e "${YELLOW}⚠️  pipx installation failed, trying binary download...${NC}"
            PIPER_INSTALLED=false
        fi
    else
        echo -e "${YELLOW}⚠️  pipx installation failed, trying binary download...${NC}"
        PIPER_INSTALLED=false
    fi
else
    echo -e "${YELLOW}⚠️  pipx not found and Homebrew not available, trying binary download...${NC}"
    PIPER_INSTALLED=false
fi

# Fallback to binary download if pip failed
if [ "$PIPER_INSTALLED" != "true" ]; then
    echo -e "${BLUE}📦 Downloading Piper TTS binary...${NC}"
    
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
    
    # Download latest release
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
        
        if [ -f "$PIPER_DIR/piper" ]; then
            echo -e "${GREEN}✓ Piper TTS binary downloaded${NC}"
            echo -e "${YELLOW}  Note: Make sure $PIPER_DIR is in your PATH${NC}"
            echo "   Add to ~/.zshrc or ~/.bashrc: export PATH=\"\$HOME/.local/bin:\$PATH\""
            PIPER_INSTALLED=true
        else
            echo -e "${RED}❌ Binary extraction failed${NC}"
            PIPER_INSTALLED=false
        fi
    else
        echo -e "${RED}❌ Binary download failed${NC}"
        PIPER_INSTALLED=false
    fi
fi

if [ "$PIPER_INSTALLED" != "true" ]; then
    echo -e "${RED}❌ Failed to install Piper TTS${NC}"
    echo "   You can try:"
    echo "   - pipx install piper-tts (recommended)"
    echo "   - Or download binary from: https://github.com/rhasspy/piper/releases"
    exit 1
fi

echo ""

# Download a voice model
echo -e "${BLUE}🎤 Downloading voice model (en_US-amy-medium)...${NC}"
echo "   This is a natural-sounding English voice"

# Create voice directory
VOICE_DIR="$HOME/.local/share/piper/voices"
mkdir -p "$VOICE_DIR/en/en_US/amy/medium"

# Download voice model files
cd "$VOICE_DIR/en/en_US/amy/medium"

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

echo ""
echo -e "${GREEN}✅ Piper TTS setup complete!${NC}"
echo ""
echo "The planner will now use Piper TTS for natural, free, offline voices."
echo "Run: npm start -- plan -u <url> --ai --tts"
echo ""

