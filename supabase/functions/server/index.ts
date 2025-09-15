import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { Application, Router } from 'https://deno.land/x/oak@v11.1.0/mod.ts';
import * as timestep from 'npm:@timestep-ai/timestep@2025.9.151135';

// Default agent data
const DEFAULT_AGENTS = [
  {
    id: '00000000-0000-0000-0000-000000000000',
    name: 'Personal Assistant',
    instructions: '# System context\nYou are part of a multi-agent system called the Agents SDK, designed to make agent coordination and execution easy. Agents uses two primary abstraction: **Agents** and **Handoffs**. An agent encompasses instructions and tools and can hand off a conversation to another agent when appropriate. Handoffs are achieved by calling a handoff function, generally named `transfer_to_<agent_name>`. Transfers between agents are handled seamlessly in the background; do not mention or draw attention to these transfers in your conversation with the user.\nYou are an AI agent acting as a personal assistant.',
    handoffIds: ['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444', '55555555-5555-5555-5555-555555555555', '66666666-6666-6666-6666-666666666666'],
    model: 'ollama/gpt-oss:20b',
    modelSettings: { temperature: 0.0 },
    createdAt: '8/31/2025, 3:06:26 PM',
    status: 'active',
    isHandoff: false,
  },
  {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Administrative Assistant',
    instructions: 'You must always use the tools to answer questions.',
    handoffDescription: 'An administrative assistant that can manage administrative tasks on behalf of the user.',
    model: 'ollama/gpt-oss:20b',
    modelSettings: { temperature: 0.0 },
    createdAt: '8/31/2025, 3:06:26 PM',
    status: 'active',
    isHandoff: true,
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'Communications Coordinator',
    instructions: 'You must always use the tools to answer questions.',
    handoffDescription: 'A communications coordinator that can manage communications on behalf of the user.',
    model: 'ollama/gpt-oss:20b',
    modelSettings: { temperature: 0.0 },
    createdAt: '8/31/2025, 3:06:26 PM',
    status: 'active',
    isHandoff: true,
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    name: 'Content Creator',
    instructions: 'You must always use the tools to answer questions.',
    handoffDescription: 'A content creator that can create content on behalf of the user.',
    model: 'ollama/gpt-oss:20b',
    modelSettings: { temperature: 0.0 },
    createdAt: '8/31/2025, 3:06:26 PM',
    status: 'active',
    isHandoff: true,
  },
  {
    id: '44444444-4444-4444-4444-444444444444',
    name: 'Project Manager',
    instructions: 'You must always use the tools to answer questions.',
    handoffDescription: 'A project manager that can manage projects on behalf of the user.',
    model: 'ollama/gpt-oss:20b',
    modelSettings: { temperature: 0.0 },
    createdAt: '8/31/2025, 3:06:26 PM',
    status: 'active',
    isHandoff: true,
  },
  {
    id: '55555555-5555-5555-5555-555555555555',
    name: 'Research Assistant',
    instructions: 'You must always use the tools to answer questions.',
    handoffDescription: 'A research assistant that can research on behalf of the user.',
    model: 'ollama/gpt-oss:20b',
    modelSettings: { temperature: 0.0 },
    createdAt: '8/31/2025, 3:06:26 PM',
    status: 'active',
    isHandoff: true,
  },
  {
    id: '66666666-6666-6666-6666-666666666666',
    name: 'Scheduling Coordinator',
    instructions: 'You must always use the tools to answer questions.',
    handoffDescription: 'A scheduling coordinator that can schedule appointments on behalf of the user.',
    model: 'ollama/gpt-oss:20b',
    modelSettings: { temperature: 0.0 },
    createdAt: '8/31/2025, 3:06:27 PM',
    status: 'active',
    isHandoff: true,
  },
];

// In-memory storage for demo purposes
let agents = [...DEFAULT_AGENTS];
let nextId = 1000;

const router = new Router();

// CORS middleware
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

router
  // GET /server/agents - Get all agents
  .get('/server/agents', (context) => {
    console.log('GET /agents - Returning all agents, count:', agents.length);
    context.response.headers.set('Access-Control-Allow-Origin', '*');
    context.response.headers.set('Content-Type', 'application/json');
    context.response.body = agents;
  })
  
  // GET /server/agents/search - Search agents
  .get('/server/agents/search', (context) => {
    const query = context.request.url.searchParams.get('q') || '';
    console.log(`GET /agents/search?q=${query} - Searching agents`);
    
    context.response.headers.set('Access-Control-Allow-Origin', '*');
    context.response.headers.set('Content-Type', 'application/json');
    
    if (!query.trim()) {
      context.response.body = agents;
      return;
    }
    
    const lowercaseQuery = query.toLowerCase();
    const filtered = agents.filter(agent => 
      agent.name.toLowerCase().includes(lowercaseQuery) ||
      (agent.description && agent.description.toLowerCase().includes(lowercaseQuery))
    );
    
    context.response.body = filtered;
  })
  
  // GET /server/agents/:id - Get agent by ID
  .get('/server/agents/:id', (context) => {
    const id = context.params.id;
    console.log(`GET /agents/${id} - Finding agent by ID`);
    
    const agent = agents.find(a => a.id === id);
    context.response.headers.set('Access-Control-Allow-Origin', '*');
    context.response.headers.set('Content-Type', 'application/json');
    
    if (!agent) {
      context.response.status = 404;
      context.response.body = { error: 'Agent not found' };
      return;
    }
    
    context.response.body = agent;
  })
  
  // POST /server/agents - Create new agent
  .post('/server/agents', async (context) => {
    const result = context.request.body({ type: 'json', limit: 0 });
    const requestBody = await result.value;
    console.log('POST /agents - Creating new agent:', requestBody);
    
    const newAgent = {
      id: `agent-${nextId++}`,
      name: requestBody.name,
      description: requestBody.description,
      instructions: requestBody.instructions,
      handoffIds: requestBody.handoffIds || [],
      handoffDescription: requestBody.handoffDescription,
      model: requestBody.model,
      modelSettings: requestBody.modelSettings || {},
      status: requestBody.status || 'active',
      isHandoff: requestBody.isHandoff || false,
      createdAt: new Date().toLocaleString(),
    };

    agents.push(newAgent);
    
    context.response.status = 201;
    context.response.headers.set('Access-Control-Allow-Origin', '*');
    context.response.headers.set('Content-Type', 'application/json');
    context.response.body = newAgent;
  })
  
  // POST /server/agents/defaults - Create default agents
  .post('/server/agents/defaults', (context) => {
    console.log('POST /agents/defaults - Creating default agents');
    
    agents = DEFAULT_AGENTS.map(agent => ({
      ...agent,
      createdAt: new Date().toLocaleString(),
    }));
    
    context.response.headers.set('Access-Control-Allow-Origin', '*');
    context.response.headers.set('Content-Type', 'application/json');
    context.response.body = agents;
  })
  
  // PUT /server/agents/:id - Update agent
  .put('/server/agents/:id', async (context) => {
    const id = context.params.id;
    const result = context.request.body({ type: 'json', limit: 0 });
    const requestBody = await result.value;
    console.log(`PUT /agents/${id} - Updating agent:`, requestBody);
    
    const index = agents.findIndex(a => a.id === id);
    context.response.headers.set('Access-Control-Allow-Origin', '*');
    context.response.headers.set('Content-Type', 'application/json');
    
    if (index === -1) {
      context.response.status = 404;
      context.response.body = { error: 'Agent not found' };
      return;
    }

    const updatedAgent = { ...agents[index], ...requestBody };
    agents[index] = updatedAgent;
    
    context.response.body = updatedAgent;
  })
  
  // DELETE /server/agents/:id - Delete agent
  .delete('/server/agents/:id', (context) => {
    const id = context.params.id;
    console.log(`DELETE /agents/${id} - Deleting agent`);
    
    const index = agents.findIndex(a => a.id === id);
    context.response.headers.set('Access-Control-Allow-Origin', '*');
    
    if (index === -1) {
      context.response.status = 404;
      context.response.headers.set('Content-Type', 'application/json');
      context.response.body = { error: 'Agent not found' };
      return;
    }

    agents.splice(index, 1);
    context.response.status = 204;
  })
  
  // DELETE /server/agents - Delete all agents
  .delete('/server/agents', (context) => {
    console.log('DELETE /agents - Deleting all agents');
    agents = [];
    
    context.response.status = 204;
    context.response.headers.set('Access-Control-Allow-Origin', '*');
  });

const app = new Application();

// CORS middleware for OPTIONS requests
app.use(async (context, next) => {
  if (context.request.method === 'OPTIONS') {
    context.response.headers.set('Access-Control-Allow-Origin', '*');
    context.response.headers.set('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');
    context.response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    context.response.status = 200;
    return;
  }
  await next();
});

// Error handling middleware
app.use(async (context, next) => {
  try {
    await next();
  } catch (error) {
    console.error('Error in server function:', error);
    context.response.status = 500;
    context.response.headers.set('Access-Control-Allow-Origin', '*');
    context.response.headers.set('Content-Type', 'application/json');
    context.response.body = { 
      error: error.message,
      stack: error.stack
    };
  }
});

app.use(router.routes());
app.use(router.allowedMethods());

await app.listen({ port: 8000 });