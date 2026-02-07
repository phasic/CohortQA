# Cohort QA Frontend

Standalone PWA frontend for Cohort QA - Playwright Test Agents.

## Features

- **Planner**: Explore web applications and generate test plans
- **Generator**: Generate Playwright tests from test plans
- **Healer**: Run and automatically fix failing tests
- **Settings Override**: Configure AI, TTS, and model settings per operation
- **PWA**: Installable as a standalone app

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## API Server

The frontend communicates with the backend via an API server. Make sure the API server is running on port 3001.

See `../src/api/server.ts` for the API server implementation.

## Configuration

The frontend allows overriding global `config.yaml` settings per operation:
- AI provider and model selection
- TTS provider and voice selection
- Planner-specific settings (ignored tags, etc.)

