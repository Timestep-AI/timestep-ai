# Timestep AI

A production-ready AI agent platform built with React, Supabase, and OpenAI's Agents SDK. This application demonstrates how to build sophisticated multi-agent systems with real-time streaming, conversation tracing, agent handoffs, and tool execution using the Model Context Protocol (MCP).

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
- **Platform**: Supabase (PostgreSQL, Edge Functions)
- **Runtime**: Deno (Edge Functions)
- **AI Framework**: OpenAI Agents SDK (@openai/agents-openai, @openai/agents-core)
- **Protocol**: Model Context Protocol (MCP)
- **Database**: PostgreSQL with Row-Level Security (RLS)
- **Authentication**: Supabase Auth (anonymous & authenticated users)

### DevOps & Testing
- **E2E Testing**: Playwright
- **CI/CD**: GitHub Actions
- **Linting**: ESLint, Prettier
- **Mobile**: Capacitor (iOS & Android)
- **Package Manager**: npm/bun

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
npx supabase functions serve
```

## Project Structure

```
timestep-ai/
├── src/                          # Frontend source code
│   ├── App.tsx                  # Root component with routing
│   ├── main.tsx                 # React entry point
│   ├── components/              # Reusable React components
│   │   └── SidebarMenu.tsx     # Agent settings sidebar
│   ├── pages/                   # Page components
│   │   └── Chat.tsx            # Main chat interface
│   ├── services/                # API services
│   │   └── agentsService.ts    # Agent API client
│   ├── integrations/            # Third-party integrations
│   │   └── supabase/           # Supabase client setup
│   │       ├── client.ts       # Supabase initialization
│   │       └── types.ts        # Generated TypeScript types
│   └── types/                   # TypeScript interfaces
│       └── agent.ts            # Agent type definitions
│
├── supabase/                     # Backend infrastructure
│   ├── functions/               # Edge Functions (Deno runtime)
│   │   ├── agent-chat/         # Main agent orchestration
│   │   │   ├── index.ts        # Request router & handler
│   │   │   ├── apis/           # HTTP API handlers
│   │   │   ├── services/       # Business logic layer
│   │   │   ├── stores/         # Database access layer
│   │   │   ├── types/          # ChatKit type definitions
│   │   │   └── utils/          # Helper utilities
│   │   ├── mcp-env/            # Model Context Protocol server
│   │   │   ├── index.ts        # MCP HTTP/SSE server
│   │   │   └── tools/          # MCP tools (weather, think)
│   │   └── openai-polyfill/    # OpenAI API polyfills
│   │
│   └── migrations/              # Database schema migrations
│       ├── *_initial_schema.sql
│       ├── *_threads_and_messages.sql
│       ├── *_files_and_vector_stores.sql
│       └── ...
│
├── tests/                        # Playwright E2E tests
│   ├── personal-assistant.spec.ts
│   └── weather-assistant.spec.ts
│
├── .github/
│   └── workflows/
│       └── ci-cd.yml            # GitHub Actions deployment
│
├── public/                       # Static assets
├── capacitor.config.ts          # Mobile app configuration
├── package.json                 # Dependencies & scripts
├── tsconfig.json                # TypeScript configuration
└── tailwind.config.ts           # Tailwind CSS configuration
```

## Available Scripts

- `npm run dev` - Start Vite development server (port 5173)
- `npm run build` - Build for production
- `npm run build:dev` - Build in development mode
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm test` - Run Playwright E2E tests
- `npm run test:ui` - Run tests with Playwright UI
- `npm run test:headed` - Run tests in headed mode (visible browser)

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

- **MCP Server**: HTTP/SSE server exposing tools (`mcp-env` edge function)
- **Built-in Tools**:
  - `get_weather`: Fetch real-time weather data for any location
  - `think`: Internal reasoning tool for agent reflection
- **Extensible**: Add custom tools by implementing MCP tool interface

## Testing

Run end-to-end tests with Playwright:

```bash
npm test              # Run all tests
npm run test:ui       # Run with Playwright UI
npm run test:headed   # Run in headed mode (visible browser)
```

**Test Coverage**:
- **Personal Assistant**: Tests general conversation flows
- **Weather Assistant**: Tests weather queries and tool execution
- **Anonymous Authentication**: Verifies anonymous user flows
- **Thread Management**: Tests conversation persistence
- **Agent Interactions**: Validates agent responses and behavior

Test files located in `/tests` directory.

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
   - `HF_TOKEN` - Hugging Face token (optional)
   - `DEFAULT_AGENT_MODEL` - Default model (e.g., `gpt-4`)

### CI/CD Pipeline

The project includes a GitHub Actions workflow (`.github/workflows/ci-cd.yml`) that automatically:

1. Links to Supabase project
2. Runs database migrations
3. Deploys edge functions

**Required GitHub Secrets**:
- `SUPABASE_ACCESS_TOKEN` - Supabase access token
- `SUPABASE_DB_PASSWORD` - Database password

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

- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous key
- `VITE_SUPABASE_PROJECT_ID` - Optional: Your Supabase project ID

### Supabase Edge Functions (config.toml)

- `OPENAI_API_KEY` - OpenAI API key for agent functionality
- `HF_TOKEN` - Hugging Face token (optional, for AI features)
- `DEFAULT_AGENT_MODEL` - Default OpenAI model (e.g., `gpt-4`, `gpt-4o-mini`)

**Note**: These are configured locally in `supabase/config.toml` (gitignored) and in production via Supabase dashboard secrets.

## Architecture

### Frontend Architecture

The frontend follows a component-based architecture with clear separation of concerns:

- **Pages**: Top-level route components (e.g., `Chat.tsx`)
- **Components**: Reusable UI components (e.g., `SidebarMenu.tsx`)
- **Services**: API clients for backend communication
- **Integrations**: Third-party service configurations (Supabase)
- **Types**: TypeScript interfaces and type definitions

### Backend Architecture

The backend uses a **service-layer pattern** with Supabase Edge Functions:

```
API Layer (index.ts)
    ↓
Service Layer (services/)
    ↓
Data Access Layer (stores/)
    ↓
Database (PostgreSQL)
```

**Key Components**:
- **API Handlers** (`apis/`): Process HTTP requests and responses
- **Services** (`services/`): Business logic and orchestration
- **Stores** (`stores/`): Database queries and data persistence
- **Utils** (`utils/`): Helper functions and utilities

### Data Flow

1. **User Action**: User sends message in chat interface
2. **Frontend**: ChatKit component captures message
3. **HTTP Request**: Custom fetch with auth headers sent to edge function
4. **Backend Processing**:
   - Authenticate user via JWT
   - Load conversation thread from database
   - Build agent with tools and configuration
   - Execute agent with OpenAI SDK
   - Stream events back to client
5. **Tool Execution**: Agent calls MCP tools if needed
6. **Response**: Assistant message streamed to frontend
7. **Persistence**: Thread, messages, and run state saved to database

### Database Schema

**Key Tables**:
- `agents`: Agent configurations (instructions, tools, model settings)
- `threads`: Conversation threads
- `thread_messages`: Individual messages in conversations
- `thread_run_states`: Serialized agent execution state
- `profiles`: User profile information
- `mcp_servers`: MCP server configurations

All tables use **Row-Level Security (RLS)** for data isolation by user ID.

## API Endpoints

### Edge Function: agent-chat

**Base URL**: `{SUPABASE_URL}/functions/v1/agent-chat`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/agents` | List all agents for authenticated user |
| POST | `/agents/{agentId}/chatkit` | ChatKit protocol endpoint (threads, messages) |
| POST | `/agents/{agentId}/chatkit/upload` | File upload for attachments |

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
- Check `.env.local` has correct `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

**Agent not responding**
- Verify `OPENAI_API_KEY` is set in `supabase/config.toml`
- Check edge function logs: `npx supabase functions logs agent-chat`

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
