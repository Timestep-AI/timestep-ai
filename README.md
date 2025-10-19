# Timestep AI

A modern AI agent platform built with React, Supabase, and OpenAI's Agents SDK. This application demonstrates how to build conversational AI agents with features like tracing, response tracking, and anonymous user support.

## Features

- **Multi-Agent Support**: Create and interact with multiple AI agents (Personal Assistant, Weather Assistant, and more)
- **OpenAI Agents SDK Integration**: Built on OpenAI's official Agents SDK with ChatKit React components
- **Anonymous Authentication**: Genuine anonymous users without requiring login
- **Conversation Tracing**: Track and visualize agent workflows, responses, and execution traces
- **Real-time Chat**: Interactive chat interface powered by Ionic framework
- **Supabase Backend**: Scalable backend with PostgreSQL database and edge functions
- **Mobile Ready**: Built with Capacitor for iOS and Android deployment

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **UI Framework**: Ionic React, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Edge Functions)
- **AI/Agents**: OpenAI Agents SDK, ChatKit React
- **Testing**: Playwright
- **Mobile**: Capacitor (iOS & Android)

## Prerequisites

- Node.js 18+ and npm
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- OpenAI API Key (for agent functionality)
- Optional: Hugging Face token (for AI features)

## Getting Started

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd timestep-ai
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env.local` file from the example:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your Supabase configuration:

```env
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=your-local-anon-key-from-supabase-start
```

### 4. Configure Supabase

Create a `supabase/config.toml` file from the example:

```bash
cp supabase/config.toml.example supabase/config.toml
```

Edit `supabase/config.toml` and add your API keys:

```toml
[edge_runtime.secrets]
HF_TOKEN = "your-huggingface-token"
OPENAI_API_KEY = "your-openai-api-key"
```

**Important**: Never commit `supabase/config.toml` to version control. It's already in `.gitignore`.

### 5. Start Supabase Local Development

```bash
npx supabase start
```

This will start a local Supabase instance. Note the `anon key` and `API URL` from the output and update your `.env.local` file accordingly.

### 6. Run Database Migrations

```bash
npx supabase db reset
```

This creates all necessary tables (users, traces, responses, spans, etc.).

### 7. Start the Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

### 8. Start Supabase Edge Functions (Optional for Development)

In a separate terminal:

```bash
npx supabase functions serve --no-verify-jwt
```

## Project Structure

```
timestep-ai/
├── src/
│   ├── components/        # React components
│   ├── pages/            # Page components (Chat, TraceDetail, etc.)
│   ├── services/         # API services
│   └── integrations/     # Supabase client setup
├── supabase/
│   ├── functions/        # Edge functions (agent-chat, openai-polyfill, mcp-env)
│   └── migrations/       # Database migrations
├── tests/                # Playwright E2E tests
└── public/              # Static assets
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm test` - Run Playwright tests
- `npm run test:ui` - Run tests with Playwright UI
- `npm run test:headed` - Run tests in headed mode

## Key Features Explained

### Anonymous Authentication

The app supports genuine anonymous users through Supabase's anonymous sign-in feature:

```typescript
const { data, error } = await supabase.auth.signInAnonymously()
```

Users can start chatting immediately without creating an account.

### Agent System

Agents are defined with instructions and tools:

- **Personal Assistant**: General-purpose assistant for everyday tasks
- **Weather Assistant**: Specialized agent for weather-related queries

### Tracing & Observability

Every agent interaction is tracked:

- **Traces**: Top-level workflow executions
- **Spans**: Individual steps within a trace (agent calls, tool usage, handoffs)
- **Responses**: AI model responses with input/output tracking

View traces at `/traces` and drill down into individual traces for detailed analysis.

### ChatKit Integration

Uses OpenAI's ChatKit React components for a polished chat experience with features like:

- Message streaming
- Tool/function call visualization
- Agent switching
- Thread management

## Testing

Run end-to-end tests:

```bash
npm test
```

Tests cover:

- Agent conversations
- Trace generation
- Response tracking
- Anonymous authentication flows

## Deployment

### Frontend Deployment

Build the production app:

```bash
npm run build
```

Deploy the `dist` folder to your hosting provider (Vercel, Netlify, etc.).

### Supabase Deployment

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Link your local project:
   ```bash
   npx supabase link --project-ref your-project-ref
   ```
3. Push migrations:
   ```bash
   npx supabase db push
   ```
4. Deploy edge functions:
   ```bash
   npx supabase functions deploy
   ```
5. Set secrets in Supabase dashboard:
   - `OPENAI_API_KEY`
   - `HF_TOKEN`

### Mobile Deployment

#### iOS

```bash
npx cap add ios
npx cap sync
npx cap open ios
```

#### Android

```bash
npx cap add android
npx cap sync
npx cap open android
```

## Environment Variables Reference

### Frontend (.env.local)

- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous key
- `VITE_SUPABASE_PROJECT_ID` - Optional: Your Supabase project ID

### Supabase Edge Functions (config.toml)

- `OPENAI_API_KEY` - OpenAI API key for agent functionality
- `HF_TOKEN` - Hugging Face token for AI features

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[Your License Here]

## Support

For issues and questions, please open an issue on GitHub.
