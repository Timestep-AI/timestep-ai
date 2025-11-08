# Timestep AI

A production-ready AI agent platform built with React, Supabase, and OpenAI's Agents SDK. This application demonstrates how to build sophisticated multi-agent systems with real-time streaming, conversation tracing, agent handoffs, and tool execution using the Model Context Protocol (MCP). The platform supports dual backend implementations (Python FastAPI and TypeScript/Deno Supabase Edge Functions) with seamless switching between them.

## Features

- **Multi-Agent Support**: Create and interact with multiple AI agents with specialized capabilities
  - Personal Assistant: General-purpose assistant for everyday tasks
  - Weather Assistant: Specialized agent with weather tool integration
- **Agent Handoffs**: Seamless agent-to-agent conversation transfers for complex workflows
- **OpenAI Agents SDK Integration**: Built on OpenAI's official Agents SDK with ChatKit React components
- **Model Context Protocol (MCP)**: Tool execution via MCP for extensible agent capabilities
- **Anonymous Authentication**: Genuine anonymous users without requiring login
- **Conversation Management**: Full thread lifecycle management (create, list, update, delete)
- **Real-Time Streaming**: Message streaming with event-driven architecture
- **Conversation Tracing**: Track and visualize agent workflows, responses, and execution traces
- **File Attachments**: Support for file uploads with vector store integration
- **Real-time Chat**: Interactive chat interface powered by Ionic framework
- **Dual Backend Support**: Switch between Python FastAPI and TypeScript/Deno Supabase Edge Functions backends
- **Multi-Model Provider Support**: Support for OpenAI, Anthropic, Hugging Face, and Ollama models
- **Supabase Backend**: Scalable backend with PostgreSQL database and edge functions
- **Mobile Ready**: Built with Capacitor for iOS and Android deployment
- **CI/CD Pipeline**: Automated deployment with GitHub Actions

## Tech Stack

### Frontend

- **Framework**: React 18, TypeScript, Vite
- **UI**: Ionic React, Tailwind CSS
- **Chat Components**: OpenAI ChatKit React
- **State Management**: TanStack React Query
- **Form Handling**: React Hook Form + Zod validation
- **Routing**: React Router
- **Charts**: Recharts
- **Notifications**: Sonner

### Backend

- **Platform**: Supabase (PostgreSQL, Edge Functions) and Python FastAPI
- **Runtimes**: 
  - Deno (Supabase Edge Functions - TypeScript)
  - Python 3.11+ (FastAPI - Python)
- **AI Framework**: OpenAI Agents SDK (@openai/agents-openai, @openai/agents-core)
- **Model Providers**: OpenAI, Anthropic, Hugging Face (inference endpoints & providers), Ollama (local & cloud)
- **Protocol**: Model Context Protocol (MCP)
- **Database**: PostgreSQL with Row-Level Security (RLS)
- **Authentication**: Supabase Auth (anonymous & authenticated users)

### DevOps & Testing

- **E2E Testing**: Cucumber (Gherkin) with Playwright
- **CI/CD**: GitHub Actions
- **Linting**: ESLint, Prettier
- **Mobile**: Capacitor (iOS & Android)
- **Package Managers**: npm/bun (frontend), uv (Python backend)

## Prerequisites

- Node.js 18+ and npm
- Python 3.11+ and [uv](https://github.com/astral-sh/uv) (for Python backend)
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- OpenAI API Key (for agent functionality)
- Optional: Anthropic API Key, Hugging Face token, Ollama API Key (for additional model providers)

## Getting Started

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd timestep-ai
```

### 2. Install Dependencies

**Frontend dependencies:**
```bash
npm install
```

**Python backend dependencies (if using Python backend):**
```bash
uv sync
```

### 3. Configure Environment Variables

Create a `.env.local` file from the example:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your configuration. **All environment variables are required** - the application will throw errors if they are missing:

```env
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=your-local-anon-key-from-supabase-start
VITE_PYTHON_BACKEND_URL=http://127.0.0.1:8000
```

**Note**: `VITE_PYTHON_BACKEND_URL` is required if you plan to use the Python backend. Set it to your local FastAPI server base URL (without `/api/v1` - it will be appended automatically).

### 4. Configure Supabase

Create a `supabase/config.toml` file from the example:

```bash
cp supabase/config.toml.example supabase/config.toml
```

Edit `supabase/config.toml` and add your API keys:

```toml
[edge_runtime.secrets]
ANTHROPIC_API_KEY = "your-anthropic-api-key"
DEFAULT_AGENT_MODEL = "openai/gpt-4.1"
HF_TOKEN = "your-huggingface-token"
OLLAMA_API_KEY = "your-ollama-cloud-api-key"
OPENAI_API_KEY = "your-openai-api-key"
```

**For Python backend**, create a `.env` file in the `api/` directory (or set environment variables):

```env
OPENAI_API_KEY=your-openai-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key
HF_TOKEN=your-huggingface-token
OLLAMA_API_KEY=your-ollama-cloud-api-key
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
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

**Start the frontend:**
```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

### 8. Start Backend (Choose One)

**Option A: TypeScript/Deno Backend (Supabase Edge Functions)**

In a separate terminal:
```bash
npx supabase functions serve
```

**Option B: Python Backend (FastAPI)**

In a separate terminal:
```bash
npm run dev:api
# or
uv run uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```

The Python backend will be available at `http://127.0.0.1:8000`.

**Note**: You can switch between backends using the backend selector in the UI. The frontend defaults to the TypeScript backend but can be configured to use the Python backend.

## Project Structure

```
timestep-ai/
├── src/                          # Frontend source code
│   ├── App.tsx                  # Root component with routing
│   ├── main.tsx                 # React entry point
│   ├── components/              # Reusable React components
│   │   ├── CombinedAgentSelector.tsx  # Agent/thread selector
│   │   └── SidebarMenu.tsx     # Agent settings sidebar
│   ├── pages/                   # Page components
│   │   └── Chat.tsx            # Main chat interface
│   ├── services/                # API services
│   │   ├── agentsService.ts    # Agent API client
│   │   ├── backendConfig.ts    # Backend type configuration
│   │   └── threadsService.ts    # Thread API client
│   ├── integrations/            # Third-party integrations
│   │   └── supabase/           # Supabase client setup
│   │       ├── client.ts       # Supabase initialization
│   │       └── types.ts        # Generated TypeScript types
│   └── types/                   # TypeScript interfaces
│       ├── agent.ts            # Agent type definitions
│       └── thread.ts           # Thread type definitions
│
├── api/                          # Python FastAPI backend
│   ├── main.py                  # FastAPI application entry point
│   ├── stores.py                # ChatKit data store implementation
│   └── utils/                   # Utility modules
│       ├── multi_model_provider.py    # Multi-provider support
│       ├── ollama_model_provider.py   # Ollama provider
│       └── ollama_model.py            # Ollama model implementation
│
├── supabase/                     # TypeScript/Deno backend
│   ├── functions/               # Edge Functions (Deno runtime)
│   │   ├── _shared/             # Shared code between edge functions
│   │   │   ├── stores.ts       # ChatKit data store implementation
│   │   │   ├── store.ts        # Store interfaces
│   │   │   ├── types.ts        # ChatKit type definitions
│   │   │   ├── errors.ts       # Error types
│   │   │   └── widgets.ts      # Widget types
│   │   ├── agents/              # Main agent orchestration
│   │   │   ├── index.ts        # Request router & handler
│   │   │   ├── chatkit/        # ChatKit implementation
│   │   │   └── utils/          # Helper utilities
│   │   │       ├── multi_model_provider.ts
│   │   │       ├── ollama_model_provider.ts
│   │   │       └── ollama_model.ts
│   │   ├── threads/             # Threads management edge function
│   │   │   └── index.ts        # Threads list endpoint
│   │   └── openai-polyfill/    # OpenAI API polyfills
│   │
│   └── migrations/              # Database schema migrations
│       ├── *_initial_schema.sql
│       ├── *_add_chatkit_tables.sql
│       ├── *_files_and_vector_stores.sql
│       ├── *_remove_threads_tables.sql
│       └── ...
│
├── tests/                        # E2E tests
│   ├── cucumber/                # Cucumber/Gherkin tests
│   │   ├── features/           # Feature files
│   │   ├── steps/              # Step definitions
│   │   └── support/            # Test support files
│   └── helpers/                 # Test helper functions
│
├── .github/
│   └── workflows/
│       └── ci-cd.yml            # GitHub Actions deployment
│
├── public/                       # Static assets
├── capacitor.config.ts          # Mobile app configuration
├── package.json                 # Frontend dependencies & scripts
├── pyproject.toml               # Python backend dependencies
├── tsconfig.json                # TypeScript configuration
└── tailwind.config.ts           # Tailwind CSS configuration
```

## Available Scripts

**Frontend:**
- `npm run dev` - Start Vite development server (port 5173)
- `npm run dev:api` - Start Python FastAPI backend (port 8000)
- `npm run build` - Build for production
- `npm run build:dev` - Build in development mode
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting

**Testing:**
- `npm test` - Run Cucumber E2E tests
- `npm run test:feature` - Run specific Cucumber feature

## Key Features Explained

### Anonymous Authentication

The app supports genuine anonymous users through Supabase's anonymous sign-in feature:

```typescript
const { data, error } = await supabase.auth.signInAnonymously();
```

Users can start chatting immediately without creating an account.

### Agent System

Agents are defined with customizable configurations:

- **Instructions**: Custom system prompts for agent behavior
- **Tools**: MCP tools available to the agent (e.g., `get_weather`, `think`)
- **Model Settings**: Temperature, tool choice strategy, and model selection
- **Handoffs**: Define which agents can transfer conversations to this agent

**Built-in Agents**:

- **Personal Assistant**: General-purpose assistant for everyday tasks
- **Weather Assistant**: Specialized agent with weather tool for location-based queries

Agents can seamlessly transfer conversations to each other via handoffs, enabling complex multi-agent workflows.

### Tracing & Observability

Every agent interaction is tracked:

- **Traces**: Top-level workflow executions
- **Spans**: Individual steps within a trace (agent calls, tool usage, handoffs)
- **Responses**: AI model responses with input/output tracking

View traces at `/traces` and drill down into individual traces for detailed analysis.

### ChatKit Integration

Uses OpenAI's ChatKit React components for a polished chat experience with features like:

- **Message Streaming**: Real-time event-driven message streaming (NDJSON)
- **Tool Call Visualization**: Display tool executions and results
- **Agent Switching**: Seamless agent selection and handoffs
- **Thread Management**: Create, list, update, and delete conversation threads
- **File Uploads**: Attach files to conversations with vector store integration
- **Markdown Support**: Rich text formatting in messages

### Model Context Protocol (MCP)

The app integrates MCP for extensible tool execution:

- **Built-in Tools**:
  - `get_weather`: Fetch real-time weather data for any location
  - `think`: Internal reasoning tool for agent reflection
- **Extensible**: Add custom tools by implementing MCP tool interface

### Multi-Model Provider Support

The app supports multiple AI model providers through a unified interface:

- **OpenAI**: Default provider, supports all OpenAI models (e.g., `gpt-4.1`, `gpt-4o-mini`)
- **Anthropic**: Supports Claude models (e.g., `anthropic/claude-3-5-sonnet-20241022`)
- **Hugging Face**: Supports inference endpoints and provider router (e.g., `hf_inference_endpoints/model-name`)
- **Ollama**: Supports local and cloud Ollama models (e.g., `ollama/gpt-oss:20b`)

Models are selected by prefix in the model name. The multi-provider system automatically routes requests to the appropriate provider based on the model name prefix.

## Testing

Run end-to-end tests with Cucumber (Gherkin):

```bash
npm test              # Run all Cucumber tests
npm run test:feature  # Run specific feature by name
```

**Test Coverage**:

- **Theme Switching**: Tests theme switching functionality for both Python and TypeScript backends
- **Conversation Flows**: Tests general conversation flows
- **Backend Switching**: Tests switching between Python and TypeScript backends

Test files are located in `/tests/cucumber` directory. Tests use Cucumber/Gherkin syntax with Playwright for browser automation.

## Deployment

### Frontend Deployment

Build the production app:

```bash
npm run build
```

Deploy the `dist` folder to your hosting provider (Vercel, Netlify, etc.).

**Important**: Set the following environment variables in your hosting provider (Vercel, Netlify, etc.):

- `VITE_SUPABASE_URL` - Your production Supabase project URL (e.g., `https://your-project.supabase.co`)
- `VITE_SUPABASE_ANON_KEY` - Your production Supabase anonymous/public key
- `VITE_PYTHON_BACKEND_URL` - Your production Python backend base URL without `/api/v1` (e.g., `https://your-domain.com`) - Required if using Python backend. The `/api/v1` prefix will be appended automatically.

**Note**: All environment variables are required. The application will throw errors if they are missing.

### Supabase Deployment

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Link your local project:
   ```bash
   npx supabase link --project-ref your-project-ref
   ```
3. Push database migrations:
   ```bash
   npx supabase db push
   ```
4. Deploy edge functions:
   ```bash
   npx supabase functions deploy
   ```
5. Set environment secrets in Supabase dashboard:
   - `OPENAI_API_KEY` - OpenAI API key for agent functionality
   - `ANTHROPIC_API_KEY` - Anthropic API key (optional)
   - `HF_TOKEN` - Hugging Face token (optional)
   - `OLLAMA_API_KEY` - Ollama Cloud API key (optional)
   - `DEFAULT_AGENT_MODEL` - Default model (e.g., `openai/gpt-4.1`)

### CI/CD Pipeline

The project includes a GitHub Actions workflow (`.github/workflows/ci-cd.yml`) that automatically:

1. Links to Supabase project
2. Runs database migrations
3. Deploys edge functions

**Required GitHub Secrets**:

- `SUPABASE_ACCESS_TOKEN` - Supabase access token
- `SUPABASE_DB_PASSWORD` - Database password
- `VITE_SUPABASE_URL` - Production Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Production Supabase anonymous/public key
- `VITE_PYTHON_BACKEND_URL` - Production Python backend base URL without `/api/v1` (required if using Python backend). The `/api/v1` prefix will be appended automatically.
- `VERCEL_TOKEN` - Vercel deployment token
- `VERCEL_ORG_ID` - Vercel organization ID
- `VERCEL_PROJECT_ID` - Vercel project ID

The workflow runs on:

- Push to `main` branch
- Manual trigger via `workflow_dispatch`

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

**All environment variables are required** - the application will throw errors if they are missing:

- `VITE_SUPABASE_URL` - **Required**: Your Supabase project URL (e.g., `http://127.0.0.1:54321` for local, `https://your-project.supabase.co` for production)
- `VITE_SUPABASE_ANON_KEY` - **Required**: Your Supabase anonymous/public key
- `VITE_PYTHON_BACKEND_URL` - **Required if using Python backend**: Your Python backend base URL without `/api/v1` (e.g., `http://127.0.0.1:8000` for local, `https://your-domain.com` for production). The `/api/v1` prefix will be appended automatically.

### Backend Configuration

**TypeScript/Deno Backend (supabase/config.toml):**

- `OPENAI_API_KEY` - OpenAI API key for agent functionality
- `ANTHROPIC_API_KEY` - Anthropic API key (optional, for Claude models)
- `HF_TOKEN` - Hugging Face token (optional, for Hugging Face models)
- `OLLAMA_API_KEY` - Ollama Cloud API key (optional, for Ollama models)
- `DEFAULT_AGENT_MODEL` - Default model (e.g., `openai/gpt-4.1`, `anthropic/claude-3-5-sonnet-20241022`)

**Python Backend (api/.env or environment variables):**

- `OPENAI_API_KEY` - OpenAI API key for agent functionality
- `ANTHROPIC_API_KEY` - Anthropic API key (optional)
- `HF_TOKEN` - Hugging Face token (optional)
- `OLLAMA_API_KEY` - Ollama Cloud API key (optional)
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key

**Note**: 
- TypeScript backend secrets are configured locally in `supabase/config.toml` (gitignored) and in production via Supabase dashboard secrets.
- Python backend uses environment variables or a `.env` file in the `api/` directory.

## Architecture

### Frontend Architecture

The frontend follows a component-based architecture with clear separation of concerns:

- **Pages**: Top-level route components (e.g., `Chat.tsx`)
- **Components**: Reusable UI components (e.g., `SidebarMenu.tsx`)
- **Services**: API clients for backend communication
- **Integrations**: Third-party service configurations (Supabase)
- **Types**: TypeScript interfaces and type definitions

### Backend Architecture

The application supports **dual backend implementations**:

**TypeScript/Deno Backend (Supabase Edge Functions):**
```
Agents Function (agents/index.ts)
    ↓
ChatKit Server (chatkit/server.ts)
    ↓
Data Access Layer (_shared/stores.ts)
    ↓
Database (PostgreSQL via Supabase)

Threads Function (threads/index.ts)
    ↓
Data Access Layer (_shared/stores.ts)
    ↓
Database (PostgreSQL via Supabase)
```

**Python Backend (FastAPI):**
```
API Layer (main.py)
    ↓
ChatKit Server (chatkit.server)
    ↓
Data Access Layer (stores.py)
    ↓
Database (PostgreSQL via Supabase)
```

**Key Components**:

- **API Handlers**: Process HTTP requests and responses
- **ChatKit Server**: Handles ChatKit protocol operations
- **Stores**: Database queries and data persistence (ChatKitDataStore, ChatKitAttachmentStore) - shared via `_shared/` directory
- **Utils**: Helper functions and utilities (multi-model providers, Ollama support)
- **Edge Functions**: 
  - `agents`: Main agent orchestration and ChatKit protocol
  - `threads`: Thread listing and management
  - `openai-polyfill`: OpenAI API compatibility layer

Both backends share the same database schema and provide identical API interfaces, allowing seamless switching between them. Shared code between edge functions is located in `_shared/` to avoid duplication.

### Data Flow

1. **User Action**: User sends message in chat interface
2. **Frontend**: ChatKit component captures message
3. **Backend Selection**: Frontend routes to selected backend (Python or TypeScript)
4. **HTTP Request**: Custom fetch with auth headers sent to backend
5. **Backend Processing**:
   - Authenticate user via JWT
   - Load conversation thread from database
   - Build agent with tools and configuration
   - Select model provider based on model name prefix (openai/, anthropic/, ollama/, etc.)
   - Execute agent with OpenAI Agents SDK
   - Stream events back to client
6. **Tool Execution**: Agent calls MCP tools if needed
7. **Response**: Assistant message streamed to frontend
8. **Persistence**: Thread, messages, and run state saved to database

### Database Schema

**Key Tables**:

- `agents`: Agent configurations (instructions, tools, model settings)
- `chatkit_threads`: Conversation threads (ChatKit format)
- `chatkit_thread_items`: Individual messages and items in conversations (ChatKit format)
- `profiles`: User profile information
- `mcp_servers`: MCP server configurations

All tables use **Row-Level Security (RLS)** for data isolation by user ID.

**Note**: The legacy `threads`, `thread_messages`, and `thread_run_states` tables have been removed in favor of the ChatKit tables (`chatkit_threads` and `chatkit_thread_items`).

## API Endpoints

### TypeScript/Deno Backend (Supabase Edge Functions)

**Agents Function** - Base URL: `{SUPABASE_URL}/functions/v1/agents`

| Method | Path                               | Description                                   |
| ------ | ---------------------------------- | --------------------------------------------- |
| GET    | `/agents`                          | List all agents for authenticated user        |
| POST   | `/agents/{agentId}/chatkit`        | ChatKit protocol endpoint (threads, messages) |
| POST   | `/agents/{agentId}/chatkit/upload` | File upload for attachments                   |

**Threads Function** - Base URL: `{SUPABASE_URL}/functions/v1/threads`

| Method | Path                               | Description                                   |
| ------ | ---------------------------------- | --------------------------------------------- |
| GET    | `/threads/list`                    | List all threads for authenticated user       |

### Python Backend (FastAPI)

**Base URL**: `http://127.0.0.1:8000/api/v1` (development) or your deployment URL with `/api/v1` prefix (e.g., `https://your-domain.com/api/v1`)

| Method | Path                               | Description                                   |
| ------ | ---------------------------------- | --------------------------------------------- |
| GET    | `/agents`                          | List all agents for authenticated user        |
| POST   | `/agents/{agentId}/chatkit`        | ChatKit protocol endpoint (threads, messages) |
| POST   | `/agents/{agentId}/chatkit/upload` | File upload for attachments                   |

Both backends provide identical API interfaces and can be used interchangeably.

### ChatKit Operations

Via POST to `/agents/{agentId}/chatkit`:

- `threads.create` - Create new conversation thread
- `threads.list` - List user's threads
- `threads.get_by_id` - Retrieve specific thread
- `threads.update` - Update thread metadata
- `threads.delete` - Delete thread
- `threads.add_user_message` - Add message to thread
- `threads.action` - Handle tool approvals
- `items.list` - List thread messages

## Security

### Authentication & Authorization

- **JWT Tokens**: All requests authenticated via Supabase JWT
- **Anonymous Auth**: Anonymous users get unique UUIDs
- **Service Role**: Backend uses service role for database access

### Row-Level Security (RLS)

All tables enforce RLS policies:

- Users can only access their own data
- Policies filter by `user_id`
- Service role bypasses RLS for backend operations

### Data Privacy

- **User Isolation**: Each user's data isolated by UUID
- **Anonymous Users**: Same security guarantees as authenticated users
- **Secrets Management**: API keys stored as environment secrets (never in code)

## Troubleshooting

### Common Issues

**Supabase connection failed**

- Ensure Supabase is running: `npx supabase status`
- Check `.env.local` has all required environment variables:
  - `VITE_SUPABASE_URL` - Required
  - `VITE_SUPABASE_ANON_KEY` - Required
  - `VITE_PYTHON_BACKEND_URL` - Required if using Python backend
- The application will throw clear errors if environment variables are missing

**Agent not responding**

- Verify `OPENAI_API_KEY` is set in `supabase/config.toml` (TypeScript backend) or environment variables (Python backend)
- Check backend logs:
  - TypeScript: `npx supabase functions logs agents`
  - Python: Check console output from `npm run dev:api`
- Verify the correct backend is selected in the UI
- Check that the backend server is running (TypeScript: Supabase functions serve, Python: FastAPI server)

**Database migration errors**

- Reset database: `npx supabase db reset`
- Check migration status: `npx supabase migration list`

**Build errors**

- Clear cache: `rm -rf node_modules dist && npm install`
- Check TypeScript errors: `npm run build`

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development Guidelines

1. Follow TypeScript best practices
2. Use Prettier for code formatting: `npm run format`
3. Run ESLint: `npm run lint`
4. Write E2E tests for new features
5. Update README for significant changes

## License

MIT License - See LICENSE file for details

## Support

For issues and questions, please open an issue on GitHub.

## Acknowledgments

- Built with [OpenAI Agents SDK](https://github.com/openai/openai-agents-sdk)
- Powered by [Supabase](https://supabase.com)
- UI components from [Ionic Framework](https://ionicframework.com)
