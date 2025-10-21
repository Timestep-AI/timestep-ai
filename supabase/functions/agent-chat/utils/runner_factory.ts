import { Runner } from '@openai/agents-core';
import { OpenAIProvider } from '@openai/agents-openai';
import type { ThreadMetadata } from '../types/chatkit.ts';

export interface RunnerConfig {
  threadId: string;
  userId: string;
  workflowName?: string;
}

export class RunnerFactory {
  static async createRunner(config: RunnerConfig): Promise<Runner> {
    // Dynamically import multi-provider components only when needed
    const { OllamaModelProvider } = await import('./ollama_model_provider.ts');
    const { MultiProvider, MultiProviderMap } = await import('./multi_provider.ts');

    const modelProviderMap = new MultiProviderMap();

    if (Deno.env.get('OLLAMA_API_KEY')) {
      modelProviderMap.addProvider(
        'ollama',
        new OllamaModelProvider({
          apiKey: Deno.env.get('OLLAMA_API_KEY') || '',
        })
      );
    }

    // Add Anthropic provider using OpenAI interface
    if (Deno.env.get('ANTHROPIC_API_KEY')) {
      modelProviderMap.addProvider(
        'anthropic',
        new OpenAIProvider({
          apiKey: Deno.env.get('ANTHROPIC_API_KEY') || '',
          baseURL: 'https://api.anthropic.com/v1/',
          useResponses: false,
        })
      );
    }

    // Use MultiProvider for model selection - it will delegate to OpenAIProvider by default
    const modelProvider = new MultiProvider({
      provider_map: modelProviderMap,
      openai_use_responses: true,
    });

    const runConfig = {
      modelProvider,
      traceIncludeSensitiveData: true,
      tracingDisabled: false,
      ...(config.workflowName && { workflowName: config.workflowName }),
      groupId: config.threadId,
      metadata: { user_id: config.userId },
    };

    return new Runner(runConfig);
  }
}
