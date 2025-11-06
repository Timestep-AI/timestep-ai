// Ollama will be dynamically imported when needed
import {
  Model,
  Usage,
  withGenerationSpan,
  resetCurrentSpan,
  createGenerationSpan,
  setCurrentSpan,
} from '@openai/agents-core';
import type { ModelRequest, ModelResponse, ResponseStreamEvent } from '@openai/agents-core';
import { protocol } from '@openai/agents-core';
import { Span } from '@openai/agents-core';

function generateOpenAIId(prefix: string, length: number): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = new Uint8Array(length);
  (globalThis as any).crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
  return `${prefix}${out}`;
}

function generateToolCallId(): string {
  return generateOpenAIId('call_', 24);
}

function generateCompletionId(): string {
  return generateOpenAIId('chatcmpl-', 29);
}

export class OllamaModel implements Model {
  #client: any; // Will be dynamically imported
  #model: string;

  constructor(model: string, ollama_client: any) {
    this.#client = ollama_client;
    this.#model = model;
  }

  private _convertOllamaToOpenai(ollamaResponse: any): any {
    const ollamaMessage = ollamaResponse['message'];

    const message: any = {
      role: ollamaMessage['role'],
      content: ollamaMessage['content'],
    };

    if (ollamaMessage['tool_calls'] && ollamaMessage['tool_calls'].length > 0) {
      message.tool_calls = ollamaMessage['tool_calls'].map((toolCall: any) => {
        const id =
          toolCall.id && typeof toolCall.id === 'string' && toolCall.id.startsWith('call_')
            ? toolCall.id
            : generateToolCallId();

        return {
          id: id,
          type: 'function',
          function: {
            name: toolCall.function.name,
            arguments: JSON.stringify(toolCall.function.arguments),
          },
        };
      });
    }

    const choice = {
      finish_reason: message.tool_calls ? 'tool_calls' : 'stop',
      index: 0,
      message: message,
    };

    const evalCount = ollamaResponse['eval_count'] || 0;
    const promptEvalCount = ollamaResponse['prompt_eval_count'] || 0;
    const totalTokens = evalCount + promptEvalCount;

    const usage = {
      completion_tokens: evalCount,
      prompt_tokens: promptEvalCount,
      total_tokens: totalTokens,
    };

    const result = {
      id: generateCompletionId(),
      choices: [choice],
      created: Math.floor(Date.now() / 1000),
      model: this.#model,
      object: 'chat.completion',
      usage: usage,
    };

    return result;
  }

  private convertHandoffTool(handoff: any) {
    return {
      type: 'function',
      function: {
        name: handoff.toolName,
        description: handoff.toolDescription || '',
        parameters: handoff.inputJsonSchema,
      },
    };
  }

  async #fetchResponse(
    request: ModelRequest,
    span: Span<any> | undefined,
    stream: true
  ): Promise<any>;
  async #fetchResponse(
    request: ModelRequest,
    span: Span<any> | undefined,
    stream: false
  ): Promise<any>;
  async #fetchResponse(
    request: ModelRequest,
    span: Span<any> | undefined,
    stream: boolean
  ): Promise<any> {
    let convertedMessages: any[] = [];

    if (typeof request.input === 'string') {
      convertedMessages = [{ role: 'user', content: request.input }];
    } else {
      convertedMessages = request.input
        .map((item: any) => {
          if (item.role === 'tool') {
            return {
              role: 'tool',
              content: item.content || '',
              tool_call_id: item.tool_call_id || '',
            };
          } else if (item.type === 'function_call') {
            let parsedArguments;
            try {
              parsedArguments = JSON.parse(item.arguments);
            } catch (e) {
              parsedArguments = item.arguments;
            }

            return {
              role: 'assistant',
              content: '',
              tool_calls: [
                {
                  id: (item as any).callId || (item as any).call_id,
                  type: 'function',
                  function: {
                    name: item.name,
                    arguments: parsedArguments,
                  },
                },
              ],
            };
          } else if (item.type === 'function_call_result') {
            let content = '';
            if (typeof item.output === 'string') {
              content = item.output;
            } else if (item.output?.text) {
              content = item.output.text;
            } else if (item.output?.content) {
              content = item.output.content;
            } else {
              content = JSON.stringify(item.output) || '';
            }

            return {
              role: 'tool',
              content: content,
              tool_call_id: (item as any).callId || (item as any).call_id,
            };
          } else if (item.role) {
            const msg: any = {
              role: item.role,
              content: item.content || item.text || '',
            };

            if (item.tool_calls) {
              msg.tool_calls = item.tool_calls;
            }

            return msg;
          } else {
            return {
              role: 'user',
              content: item.content || item.text || '',
            };
          }
        })
        .filter((msg) => msg !== null);
    }

    if (request.systemInstructions) {
      convertedMessages.unshift({
        content: request.systemInstructions,
        role: 'system',
      });
    }

    if (span && request.tracing === true) {
      span.spanData.input = convertedMessages;
    }

    const ollamaMessages = [];
    for (const msg of convertedMessages) {
      let content = '';
      if (typeof msg['content'] === 'string') {
        content = msg['content'];
      } else if (Array.isArray(msg['content'])) {
        for (const part of msg['content']) {
          if (part.type === 'input_text' && part.text) {
            content += part.text;
          } else if (typeof part === 'string') {
            content += part;
          } else if (part.text) {
            content += part.text;
          }
        }
      } else if (msg['content'] && typeof msg['content'] === 'object' && msg['content'].text) {
        content = msg['content'].text;
      }

      const ollamaMsg: any = {
        role: msg['role'],
        content: content,
      };

      if (msg['role'] === 'tool' && msg['tool_call_id']) {
        ollamaMsg['tool_call_id'] = msg['tool_call_id'];
      }

      if (msg['role'] === 'assistant' && msg['tool_calls']) {
        ollamaMsg['tool_calls'] = msg['tool_calls'].map((toolCall: any) => {
          const result = { ...toolCall };
          if (result.function && result.function.arguments) {
            if (typeof result.function.arguments === 'string') {
              try {
                result.function.arguments = JSON.parse(result.function.arguments);
              } catch (error) {
                result.function.arguments = {};
              }
            }
          }
          return result;
        });
      }

      ollamaMessages.push(ollamaMsg);
    }

    console.log('[ollama_model] Processing tools, count:', request.tools?.length || 0);
    console.log('[ollama_model] Tools structure:', JSON.stringify(request.tools, null, 2));

    const ollamaTools =
      request.tools
        ?.map((tool) => {
          console.log('[ollama_model] Processing tool:', {
            hasName: !!(tool as any).name,
            hasParamsJsonSchema: !!(tool as any).paramsJsonSchema,
            hasParameters: !!(tool as any).parameters,
            hasType: !!(tool as any).type,
            type: (tool as any).type,
            keys: Object.keys(tool),
          });

          // Handle FunctionTool objects (from tool() function in agents-core)
          if ((tool as any).name && (tool as any).paramsJsonSchema) {
            console.log('[ollama_model] Matched FunctionTool with paramsJsonSchema:', (tool as any).name);
            const paramsSchema = (tool as any).paramsJsonSchema;

            return {
              type: 'function',
              function: {
                name: (tool as any).name,
                description: (tool as any).description || '',
                parameters: paramsSchema || {},
              },
            };
          }
          // Handle Tool objects with type='function'
          if (tool.type === 'function') {
            console.log('[ollama_model] Matched Tool with type=function:', tool.name);
            return {
              type: 'function',
              function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters,
              },
            };
          }
          // Handle dict-based tools
          if (typeof tool === 'object' && tool !== null && !Array.isArray(tool) && (tool as any).type === 'function') {
            console.log('[ollama_model] Matched dict-based tool with type=function:', (tool as any).name);
            return {
              type: 'function',
              function: {
                name: (tool as any).name,
                description: (tool as any).description || '',
                parameters: (tool as any).parameters || {},
              },
            };
          }
          console.log('[ollama_model] Tool did not match any pattern, returning null');
          return null;
        })
        .filter((tool) => tool !== null) || [];

    console.log('[ollama_model] Final ollama tools:', JSON.stringify(ollamaTools, null, 2));

    if ((request as any).handoffs && Array.isArray((request as any).handoffs)) {
      for (const handoff of (request as any).handoffs) {
        try {
          const handoffTool = this.convertHandoffTool(handoff);
          if (handoffTool) {
            ollamaTools.push(handoffTool);
          }
        } catch (e) {
          console.warn('🔍 Failed to convert handoff to tool:', e);
        }
      }
    }

    const chatOptions: any = {
      model: this.#model,
      messages: ollamaMessages,
      stream: stream as any,
    };

    // Set temperature directly on the request (not in options)
    if (request.modelSettings?.temperature !== undefined) {
      chatOptions.temperature = request.modelSettings.temperature;
    }

    // Add model settings if provided
    if (request.modelSettings) {
      // Handle reasoning settings - map reasoning.effort to think
      // OpenAI Agents SDK: reasoning: { effort: 'minimal' | 'low' | 'medium' | 'high' }
      // Ollama: think: boolean | 'low' | 'medium' | 'high'
      if (request.modelSettings.reasoning !== undefined) {
        if (typeof request.modelSettings.reasoning === 'object' && request.modelSettings.reasoning !== null) {
          const effort = request.modelSettings.reasoning.effort;
          if (effort === 'minimal') {
            chatOptions.think = 'low'; // Map minimal to low
          } else if (effort === 'low' || effort === 'medium' || effort === 'high') {
            chatOptions.think = effort;
          } else if (effort === null) {
            chatOptions.think = false; // Disable thinking
          }
        } else if (request.modelSettings.reasoning === false) {
          chatOptions.think = false; // Disable thinking mode for consistent responses
        }
      }

      // Map standard model settings to Ollama options
      if (request.modelSettings.temperature !== undefined) {
        chatOptions.options = chatOptions.options || {};
        chatOptions.options.temperature = request.modelSettings.temperature;
      }
      if (request.modelSettings.topP !== undefined) {
        chatOptions.options = chatOptions.options || {};
        chatOptions.options.top_p = request.modelSettings.topP;
      }
      if (request.modelSettings.frequencyPenalty !== undefined) {
        chatOptions.options = chatOptions.options || {};
        chatOptions.options.frequency_penalty = request.modelSettings.frequencyPenalty;
      }
      if (request.modelSettings.presencePenalty !== undefined) {
        chatOptions.options = chatOptions.options || {};
        chatOptions.options.presence_penalty = request.modelSettings.presencePenalty;
      }
    }

    if (ollamaTools.length > 0) {
      chatOptions.tools = ollamaTools;
    }

    const responseData = await this.#client.chat(chatOptions);

    if (stream) {
      return responseData;
    }

    const ret = this._convertOllamaToOpenai(responseData);

    return ret;
  }

  private toResponseUsage(usage: any) {
    return {
      requests: 1,
      input_tokens: usage.prompt_tokens || 0,
      output_tokens: usage.completion_tokens || 0,
      total_tokens: usage.total_tokens || 0,
      input_tokens_details: {
        cached_tokens: usage.prompt_tokens_details?.cached_tokens || 0,
      },
      output_tokens_details: {
        reasoning_tokens: usage.completion_tokens_details?.reasoning_tokens || 0,
      },
    };
  }

  async getResponse(request: ModelRequest): Promise<ModelResponse> {
    const response = await withGenerationSpan(async (span) => {
      span.spanData.model = this.#model;
      span.spanData.model_config = request.modelSettings
        ? {
            temperature: request.modelSettings.temperature,
            top_p: request.modelSettings.topP,
            frequency_penalty: request.modelSettings.frequencyPenalty,
            presence_penalty: request.modelSettings.presencePenalty,
          }
        : { base_url: 'ollama_client' };
      const response = await this.#fetchResponse(request, span, false);
      if (span && request.tracing === true) {
        span.spanData.output = [response];
      }
      return response;
    });

    const output: protocol.OutputModelItem[] = [];
    if (response.choices && response.choices[0]) {
      const message = response.choices[0].message;

      if (
        message.content !== undefined &&
        message.content !== null &&
        // Azure OpenAI returns empty string instead of null for tool calls, causing parser rejection
        !(message.tool_calls && message.content === '')
      ) {
        const { content, ...rest } = message;
        output.push({
          id: response.id,
          type: 'message',
          role: 'assistant',
          content: [
            {
              type: 'output_text',
              text: content || '',
              provider_data: rest, // Match Python: 'provider_data' (snake_case, line 420)
            },
          ],
          status: 'completed',
        });
      } else if (message.refusal) {
        const { refusal, ...rest } = message;
        output.push({
          id: response.id,
          type: 'message',
          role: 'assistant',
          content: [
            {
              type: 'refusal',
              refusal: refusal || '',
              provider_data: rest, // Match Python: 'provider_data' (snake_case, line 436)
            },
          ],
          status: 'completed',
        });
      } else if (message.tool_calls) {
        for (const tool_call of message.tool_calls) {
          if (tool_call.type === 'function') {
            const { id: callId, ...remainingToolCallData } = tool_call;
            const { arguments: args, name, ...remainingFunctionData } = tool_call.function;
            output.push({
              id: response.id,
              type: 'function_call',
              arguments: args,
              name: name,
              call_id: callId, // Match Python: 'call_id' (snake_case, line 454)
              status: 'completed',
              provider_data: { // Match Python: 'provider_data' (snake_case, line 456)
                ...remainingToolCallData,
                ...remainingFunctionData,
              },
            });
          }
        }
      }
    }

    const modelResponse: ModelResponse = {
      usage: response.usage ? new Usage(this.toResponseUsage(response.usage)) : new Usage(),
      output,
      responseId: response.id,
    };

    return modelResponse;
  }

  async *getStreamedResponse(request: ModelRequest): AsyncIterable<ResponseStreamEvent> {
    const span = request.tracing ? createGenerationSpan() : undefined;
    try {
      console.log('[ollama_model] getStreamedResponse called with input:', {
        length: Array.isArray(request.input) ? request.input.length : 'not array',
        type: typeof request.input,
        isArray: Array.isArray(request.input),
        input: JSON.stringify(request.input, null, 2),
      });
      if (span) {
        span.start();
        setCurrentSpan(span);
      }
      const stream = await this.#fetchResponse(request, span, true);
      console.log('[ollama_model] #fetchResponse returned, starting to yield events...');

      yield* this.convertOllamaStreamToResponses(stream, span, request.tracing === true);
    } catch (error) {
      if (span) {
        span.setError({
          message: 'Error streaming response',
          data: {
            error:
              request.tracing === true
                ? String(error)
                : error instanceof Error
                  ? error.name
                  : undefined,
          },
        });
      }
      throw error;
    } finally {
      if (span) {
        span.end();
        resetCurrentSpan();
      }
    }
  }

  private async *convertOllamaStreamToResponses(
    stream: any,
    span?: Span<any>,
    tracingEnabled?: boolean
  ): AsyncIterable<ResponseStreamEvent> {
    // Match Python: Match Python implementation exactly - yield OpenAI Response API events
    let usage: any = undefined;
    let accumulatedText = '';
    const responseId = generateCompletionId();
    // Generate a temporary item_id for streaming events (matches Python line 517)
    const itemId = generateCompletionId();

    for await (const chunk of stream) {
      if (chunk.eval_count || chunk.prompt_eval_count) {
        usage = {
          prompt_tokens: chunk.prompt_eval_count || 0,
          completion_tokens: chunk.eval_count || 0,
          total_tokens: (chunk.prompt_eval_count || 0) + (chunk.eval_count || 0),
        };
      }

      if (chunk.message && chunk.message.content) {
        // Match Python: Yield ResponseTextDeltaEvent for streaming text (lines 529-537)
        yield {
          type: 'response.output_text.delta',
          item_id: itemId,
          content_index: 0,
          output_index: 0,
          delta: chunk.message.content,
          sequence_number: 1,
          logprobs: [],
        } as any;
        accumulatedText += chunk.message.content;
      }

      if (chunk.message && chunk.message.tool_calls) {
        for (const tool_call of chunk.message.tool_calls) {
          if (tool_call.function) {
            const callId =
              tool_call.id && typeof tool_call.id === 'string' && tool_call.id.startsWith('call_')
                ? tool_call.id
                : generateToolCallId();

            // Match Python: Create output with tool call - use proper ResponseFunctionToolCall type (lines 550-556)
            const toolCallOutputItem = {
              id: responseId,
              type: 'function_call',
              call_id: callId,
              name: tool_call.function.name,
              arguments: JSON.stringify(tool_call.function.arguments || {}),
            };

            const toolCallOutput = [toolCallOutputItem];

            // Match Python: Create ResponseUsage for tool (lines 559-567)
            let responseUsageForTool: any = null;
            if (usage) {
              responseUsageForTool = {
                input_tokens: usage.prompt_tokens || 0,
                output_tokens: usage.completion_tokens || 0,
                total_tokens: usage.total_tokens || 0,
                input_tokens_details: { cached_tokens: 0 },
                output_tokens_details: { reasoning_tokens: 0 },
              };
            }

            // Match Python: Create Response object (lines 569-579)
            const responseForTool = {
              id: responseId,
              created_at: Math.floor(Date.now() / 1000),
              model: 'ollama',
              object: 'response',
              output: toolCallOutput,
              parallel_tool_calls: false,
              tool_choice: 'none',
              tools: [],
              usage: responseUsageForTool,
            };

            if (span && tracingEnabled === true) {
              span.spanData.output = toolCallOutput;
            }

            // Match Python: Yield ResponseCompletedEvent (lines 585-589)
            yield {
              type: 'response.completed',
              response: responseForTool,
              sequence_number: 1,
            } as any;
            return;
          }
        }
      }

      if (chunk.done) {
        const outputs: any[] = [];

        if (accumulatedText) {
          // Match Python: Yield response.output_text.done event for chatkit (lines 597-605)
          yield {
            type: 'response.output_text.done',
            item_id: itemId,
            content_index: 0,
            output_index: 0,
            text: accumulatedText,
            sequence_number: 1,
            logprobs: [],
          } as any;

          // Match Python: Create proper ResponseOutputMessage with ResponseOutputText content (lines 608-620)
          const outputText = {
            type: 'output_text',
            text: accumulatedText,
            annotations: [],
            logprobs: null,
          };

          const outputMessage = {
            id: itemId, // Use item_id for message id to match deltas (matches Python line 615)
            type: 'message',
            role: 'assistant',
            status: 'completed',
            content: [outputText],
          };

          outputs.push(outputMessage);

          // Match Python: Yield response.output_item.added event for chatkit (needed before done) (lines 624-629)
          yield {
            type: 'response.output_item.added',
            item: outputMessage,
            output_index: 0,
            sequence_number: 1,
          } as any;

          // Match Python: Yield response.output_item.done event for chatkit (lines 632-637)
          yield {
            type: 'response.output_item.done',
            item: outputMessage,
            output_index: 0,
            sequence_number: 1,
          } as any;
        }

        if (span && tracingEnabled === true) {
          span.spanData.output = outputs;
        }

        // Match Python: Yield ResponseCompletedEvent for agents library to extract final_response (lines 668-672)
        let responseUsage: any = null;
        if (usage) {
          responseUsage = {
            input_tokens: usage.prompt_tokens || 0,
            output_tokens: usage.completion_tokens || 0,
            total_tokens: usage.total_tokens || 0,
            input_tokens_details: { cached_tokens: 0 },
            output_tokens_details: { reasoning_tokens: 0 },
          };
        }

        const response = {
          id: responseId,
          created_at: Math.floor(Date.now() / 1000),
          model: 'ollama',
          object: 'response',
          output: outputs,
          parallel_tool_calls: false,
          tool_choice: 'none',
          tools: [],
          usage: responseUsage,
        };

        yield {
          type: 'response.completed',
          response: response,
          sequence_number: 1,
        } as any;
        break;
      }
    }
  }
}
