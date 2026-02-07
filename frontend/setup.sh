#!/bin/bash

# Frontend setup script for Cohort QA

echo "🚀 Setting up Cohort QA Frontend..."

# Check Node.js version
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Install dependencies
echo "📦 Installing frontend dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo ""
echo "✅ Frontend setup complete!"
echo ""
echo "To start the frontend:"
echo "  cd frontend && npm run dev"
echo ""
echo "To start the API server (in another terminal):"
echo "  npm run api"
echo ""
echo "Or start both together:"
echo "  npm run api:dev  # Terminal 1"
echo "  cd frontend && npm run dev  # Terminal 2"

