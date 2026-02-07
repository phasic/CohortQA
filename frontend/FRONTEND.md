# Cohort QA Frontend

Standalone Progressive Web App (PWA) frontend for Cohort QA.

## Features

### Planner Page
- Enter start URL
- Configure maximum navigations
- Add/remove ignored tags (header, nav, footer, etc.)
- Override AI and TTS settings
- Run planner and view results

### Generator Page
- View latest generated test plan
- Edit test plan before generating
- Configure base URL
- Override AI settings
- Generate Playwright tests

### Healer Page
- Browse generated test suites (folders)
- Select test suite to heal
- Override AI settings
- Run healing operations

### Settings Panel
Available on all pages to override global `config.yaml` settings:
- Enable/disable AI
- Select AI provider (heuristic, ollama, openai, anthropic)
- Configure AI model
- Enable/disable TTS
- Select TTS provider (openai, piper, macos)
- Configure TTS voice

## Setup

```bash
# Install dependencies
cd frontend
npm install

# Start development server
npm run dev
```

The frontend will run on http://localhost:3000

## API Server

The frontend communicates with the backend via an API server. Start it in a separate terminal:

```bash
# From project root
npm run api
```

The API server runs on http://localhost:3001

## Building for Production

```bash
cd frontend
npm run build
```

The built files will be in `frontend/dist/` and can be served with any static file server.

## PWA Installation

After building, the app can be installed as a PWA:
1. Open the app in a browser
2. Look for the install prompt or use browser menu
3. Install to home screen/desktop
4. App will work offline after first load

## Architecture

- **React 18** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for styling
- **React Router** for navigation
- **Axios** for API communication
- **Vite PWA Plugin** for PWA capabilities

## API Endpoints

- `POST /api/planner/run` - Run planner
- `GET /api/generator/test-plan` - Get latest test plan
- `POST /api/generator/run` - Generate tests
- `GET /api/healer/test-suites` - List test suites
- `POST /api/healer/run` - Heal tests
- `GET /api/health` - Health check

