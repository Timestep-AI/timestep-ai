import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ItemPage } from '@/components/ItemPage';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MessageCircle, Calendar, Users, Hash, Send, Bot, RefreshCw } from 'lucide-react';
import { Chat as ChatType } from '@/types/chat';
import { Message } from '@/types/message';
import { Agent } from '@/types/agent';
import { Task, TaskStatusUpdateEvent, TaskArtifactUpdateEvent, TextPart, PendingToolCall } from '@/types/a2a';
import { chatsService } from '@/services/chatsService';
import { messagesService } from '@/services/messagesService';
import { agentsService } from '@/services/agentsService';
import { supabase } from '@/integrations/supabase/client';
import { MessageRow } from '@/components/MessageRow';
import { ToolCallApproval } from '@/components/ToolCallApproval';
import { A2AClient } from '@/services/a2aClient';
import { toast } from 'sonner';

export const Chat = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [chat, setChat] = useState<ChatType | null>(null);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState<string | undefined>(undefined);
  const [currentContextId, setCurrentContextId] = useState<string | undefined>(undefined);
  // Global streaming state - matches example client pattern
  const [streamingMessage, setStreamingMessage] = useState<Message | null>(null);
  const [lastDisplayedContent, setLastDisplayedContent] = useState<string>('');
  const [isCurrentlyStreaming, setIsCurrentlyStreaming] = useState<boolean>(false);
  const [streamedTaskIds, setStreamedTaskIds] = useState<Set<string>>(new Set());

  // Refs to avoid stale closures during fast streaming updates
  const streamingMessageRef = useRef<Message | null>(null);
  const lastDisplayedContentRef = useRef<string>('');
  const isCurrentlyStreamingRef = useRef<boolean>(false);
  const currentStreamingTaskIdRef = useRef<string | null>(null);

  // Keep refs in sync with state
  useEffect(() => {
    streamingMessageRef.current = streamingMessage;
  }, [streamingMessage]);

  useEffect(() => {
    lastDisplayedContentRef.current = lastDisplayedContent;
  }, [lastDisplayedContent]);

  useEffect(() => {
    isCurrentlyStreamingRef.current = isCurrentlyStreaming;
  }, [isCurrentlyStreaming]);


  // Shared stream event handler (matches example client pattern)
  // Tool event detection (like CLI)
  const checkForToolEvent = (message: any): {type: 'tool_call' | 'tool_response', name: string, arguments: string, output?: string} | null => {
    if (!message.parts) return null;

    for (const part of message.parts) {
      if (part.kind === 'data') {
        const data = part.data as Record<string, unknown>;

        // Skip handoff events - they should be displayed as Assistant messages, not Tool boxes
        const eventType = data?.['type'] as string;
        if (eventType === 'handoff_requested' || eventType === 'handoff_occurred') {
          return null;
        }

        // Check for tool call
        if (data?.['name'] && data?.['arguments']) {
          const toolName = data['name'] as string;
          const toolArgs = data['arguments'] as string;

          // Skip handoff function calls - they should be handled as Assistant messages only
          if (toolName.startsWith('transfer_to_')) {
            return null;
          }

          return {
            type: 'tool_call',
            name: toolName,
            arguments: toolArgs
          };
        }

        // Check for tool output/response
        if (data?.['type'] === 'function_call_result' && data?.['name'] && data?.['output']) {
          const toolName = data['name'] as string;
          const output = data?.['output'] as Record<string, unknown>;
          const outputText = output?.['text'] || JSON.stringify(output);

          return {
            type: 'tool_response',
            name: toolName,
            arguments: '{}', // We don't have the original arguments here
            output: typeof outputText === 'string' ? outputText : JSON.stringify(outputText)
          };
        }
      }
    }

    return null;
  };

  const handleStreamEvent = async (event: any) => {
    console.log('A2A Event:', event);
    console.log('Event kind:', event.kind, 'Event type:', typeof event);

    if (event.kind === 'status-update') {
      const statusEvent = event as TaskStatusUpdateEvent;
      console.log(`Task ${statusEvent.taskId} status: ${statusEvent.status.state}`, {
        final: statusEvent.final,
        hasMessage: !!statusEvent.status.message,
        messageContent: (statusEvent.status.message?.parts?.[0] as any)?.text?.substring(0, 100) || 'no content',
        fullStatus: statusEvent.status
      });

      // Update current task and context IDs (like CLI does)
      if (statusEvent.contextId && statusEvent.contextId !== currentContextId) {
        console.log(`Context created (ID: ${statusEvent.contextId})`);
        setCurrentContextId(statusEvent.contextId);
      }
      if (statusEvent.taskId && statusEvent.taskId !== currentTaskId) {
        console.log(`Task created (ID: ${statusEvent.taskId})`);
        setCurrentTaskId(statusEvent.taskId);
      }

      // Handle status message content (matches CLI logic)
      if (statusEvent.status.message) {
        // Check for output_text_delta events (like CLI does)
        const hasOutputTextDelta = statusEvent.status.message.parts?.some(
          p => p.kind === 'data' && 
          (p as any).data && 
          typeof (p as any).data === 'object' && 
          ((p as any).data as Record<string, unknown>)?.['type'] === 'output_text_delta'
        );

        if (hasOutputTextDelta) {
          // Handle streaming deltas (like CLI does)
          if (!isCurrentlyStreaming) {
            setIsCurrentlyStreaming(true);
            setStreamedTaskIds(prev => new Set([...prev, statusEvent.taskId]));
            setLastDisplayedContent('');

            // Create initial streaming message
            const tempMessage: Message = {
              id: `temp-${statusEvent.taskId}`,
              chatId: id!,
              content: '',
              sender: 'Assistant',
              type: 'assistant',
              status: 'sending',
              timestamp: new Date().toISOString()
            };

            setStreamingMessage(tempMessage);
            setLastDisplayedContent(''); // Reset accumulated content for new streaming message
            setMessages(prevMessages => {
              if (prevMessages.some(m => m.id === tempMessage.id)) return prevMessages;
              return [...prevMessages, tempMessage];
            });
          }

          // Process deltas and accumulate content
          let deltaContent = '';
          statusEvent.status.message.parts?.forEach((part: any) => {
            if (part.kind === 'data' && part.data?.type === 'output_text_delta') {
              deltaContent += part.data.delta || '';
            }
          });
          
          if (deltaContent) {
            setLastDisplayedContent(prev => {
              const newContent = prev + deltaContent;
              
              // Check if the accumulated content is a tool call
              const toolCallMatch = newContent.trim().match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\(\s*(.*)\s*\)\s*$/);
              const isToolCall = toolCallMatch && !toolCallMatch[1].startsWith('transfer_to_');
              
              let rawMessage = undefined;
              if (isToolCall && toolCallMatch) {
                const toolName = toolCallMatch[1];
                const argsString = toolCallMatch[2];
                const callId = `${toolName}-${statusEvent.taskId}-${argsString}`;
                rawMessage = {
                  name: toolName,
                  arguments: argsString,
                  callId: callId,
                  taskId: statusEvent.taskId
                };
              }
              
              // Update streaming message with accumulated content
            if (streamingMessageRef.current) {
              const updatedMessage = {
                ...streamingMessageRef.current,
                  content: newContent,
                  status: 'sending' as const,
                  isToolCall: isToolCall || false,
                  rawMessage: rawMessage
              };

              setStreamingMessage(updatedMessage);
              setMessages(prevMessages =>
                prevMessages.map(msg =>
                  msg.id === streamingMessageRef.current!.id ? updatedMessage : msg
                )
              );
            }
              
              return newContent;
            });
          }
        } else {
          // Check for tool responses in the message (like CLI does)
          const toolEvent = checkForToolEvent(statusEvent.status.message);
          if (toolEvent && toolEvent.type === 'tool_response') {
            // Tool responses are Tool messages (like CLI does)
            const responseId = `tool-response-${toolEvent.name}-${statusEvent.taskId}`;
            const toolResponseMessage: Message = {
              id: responseId,
              chatId: id!,
              content: toolEvent.output || '',
              sender: 'Tool',
              type: 'tool_response',
              status: 'sent',
              timestamp: new Date().toISOString()
            };
            
            // Check if this tool response message already exists to prevent duplication
            setMessages(prevMessages => {
              const existingMessage = prevMessages.find(m => m.id === responseId);
              if (existingMessage) {
                return prevMessages; // Don't add duplicate
              }
              return [...prevMessages, toolResponseMessage];
            });
          } else {
            // Regular non-streaming message - convert and add
            const agentMessage = A2AClient.convertFromA2AMessage(statusEvent.status.message, id!, statusEvent.taskId);
            
            // Add the message if it has content
            if (agentMessage.content && agentMessage.content.trim()) {
              setMessages(prevMessages => {
                // Check if this message already exists
                const existingIndex = prevMessages.findIndex(m => 
                  m.id === agentMessage.id || 
                  (m.content === agentMessage.content && m.sender === agentMessage.sender)
                );
                
                if (existingIndex >= 0) {
                  // Update existing message
                  const updated = [...prevMessages];
                  updated[existingIndex] = { ...updated[existingIndex], ...agentMessage } as Message;
                  return updated;
                } else {
                  // Add new message
                  return [...prevMessages, agentMessage as Message];
                }
              });
            }
          }
        }

        // Handle completion of streaming (like CLI does)
        if (statusEvent.status.state === 'completed' && statusEvent.final && isCurrentlyStreaming) {
            console.log('Completing streaming for task:', statusEvent.taskId);

            // Finalize the streaming message
            if (streamingMessageRef.current) {
              const finalMessage = await messagesService.create({
                chatId: id!,
                content: streamingMessageRef.current.content,
                sender: streamingMessageRef.current.sender,
                type: streamingMessageRef.current.type,
                status: 'sent',
                isToolCall: streamingMessageRef.current.isToolCall,
                rawMessage: streamingMessageRef.current.rawMessage
              });

              // Replace temporary with real message
              setMessages(prevMessages =>
                prevMessages.map(msg =>
                  msg.id === streamingMessageRef.current!.id ? finalMessage : msg
                )
              );

              // Clean up streaming state
              setStreamingMessage(null);
              setLastDisplayedContent('');
              setIsCurrentlyStreaming(false);
              currentStreamingTaskIdRef.current = null;
            }
          
          // Show task completed message (like CLI does)
          console.log(`Task completed (ID: ${statusEvent.taskId})`);
        }

        // Check if this is a tool call approval request from status message
        if (statusEvent.status.state === 'input-required' && statusEvent.status.message.parts) {
          for (const p of statusEvent.status.message.parts) {
            if (p.kind === 'text' && typeof p.text === 'string') {
              const m = p.text.match(/Human approval required for tool execution: (.+)/);
              if (m) {
                const callText = m[1];
                const tm = callText.match(/^(\w+)\((.*)\)$/);
                if (tm) {
                  const toolName = tm[1];
                  let parameters: Record<string, any> = {};
                  try {
                    parameters = tm[2] ? JSON.parse(tm[2]) : {};
                  } catch (_) {
                    parameters = {};
                  }
                  break;
                }
              }
            }
          }
        }
      }

      if (statusEvent.status.state === 'completed' && statusEvent.final) {
        console.log('Task completed');
        setCurrentTaskId(undefined); // Clear task ID when completed
        // Clean up any remaining streaming state
        if (isCurrentlyStreamingRef.current) {
          setIsCurrentlyStreaming(false);
          setStreamingMessage(null);
          setLastDisplayedContent('');
          currentStreamingTaskIdRef.current = null;
        }
      }
    } else if (event.kind === 'artifact-update') {
      const artifactEvent = event as TaskArtifactUpdateEvent;
      console.log(`Artifact received: ${artifactEvent.artifact.name || 'unnamed'}`);

      // Handle tool call artifacts
      const isToolCallArtifact = artifactEvent.artifact.parts.some(
        part => part.kind === 'data' &&
        part.data &&
        typeof part.data === 'object' &&
        part.data['toolCall']
      );

      if (isToolCallArtifact) {
        // Extract tool call information from the artifact
        const toolCallData = artifactEvent.artifact.parts.find(
          part => part.kind === 'data' && part.data && typeof part.data === 'object' && part.data['toolCall']
        );

      } else {
        // Handle other artifacts as messages - but only if not streaming
        if (!streamingMessageRef.current || !isCurrentlyStreamingRef.current) {
          const textParts = artifactEvent.artifact.parts.filter(p => p.kind === 'text') as TextPart[];
          if (textParts.length > 0) {
            const content = textParts.map(p => p.text).join('\n');
            
            // Check if the content is a tool call
            const toolCallMatch = content.trim().match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\(\s*(.*)\s*\)\s*$/);
            const isToolCall = toolCallMatch && !toolCallMatch[1].startsWith('transfer_to_');
            
            let rawMessage = undefined;
            if (isToolCall && toolCallMatch) {
              const toolName = toolCallMatch[1];
              const argsString = toolCallMatch[2];
              const callId = `${toolName}-${currentTaskId}-${argsString}`;
              rawMessage = {
                name: toolName,
                arguments: argsString,
                callId: callId,
                taskId: currentTaskId
              };
            }
            
            const newMessage = await messagesService.create({
              chatId: id!,
              content,
              sender: 'Agent',
              type: 'assistant',
              status: 'sent',
              isToolCall: isToolCall || false,
              rawMessage: rawMessage
            });

            // Add to local messages state (avoid duplicates)
            setMessages(prevMessages => {
              if (prevMessages.some(m => m.id === newMessage.id)) return prevMessages;
              return [...prevMessages, newMessage];
            });
          }
        } else {
          console.log('Artifact event: Skipping message creation because we are streaming');
        }
      }
    } else if (event.kind === 'task') {
      const task = event as Task;
      console.log(`Task created: ${task.id}`, {
        state: task.status.state,
        hasMessage: !!task.status.message,
        messageContent: (task.status.message?.parts?.[0] as any)?.text?.substring(0, 100) || 'no content',
        fullTask: task
      });

      if (task.id !== currentTaskId) {
        setCurrentTaskId(task.id);
      }
      if (task.contextId && task.contextId !== currentContextId) {
        setCurrentContextId(task.contextId);
      }

      if (task.status.message) {
        const agentMessage = A2AClient.convertFromA2AMessage(task.status.message, id!, task.id);

        // Only create message if we're not currently streaming
        if (!isCurrentlyStreaming) {
          const newMessage = await messagesService.create({
            chatId: id!,
            content: agentMessage.content!,
            sender: agentMessage.sender!,
            type: agentMessage.type!,
            status: 'sent',
            isToolCall: agentMessage.isToolCall,
            rawMessage: agentMessage.rawMessage
          });

          setMessages(prevMessages => {
            if (prevMessages.some(m => m.id === newMessage.id)) return prevMessages;
            return [...prevMessages, newMessage];
          });
        } else {
          console.log('Task event: Skipping message creation because we are streaming');
        }
      }
    }
  };


  useEffect(() => {
    const loadChatAndMessages = async () => {
      if (!id) return;
      
      try {
        setLoading(true);
        console.log('Loading chat and messages for ID:', id);
        
        // Load chat information
        const chats = await chatsService.getAll();
        const foundChat = chats.find(c => c.id === id);
        setChat(foundChat || null);
        
        if (!foundChat) {
          console.error('Chat not found:', id);
          toast.error('Chat not found');
          return;
        }

        console.log('Found chat:', foundChat);
        
        // Load conversation history from backend (like CLI does)
        console.log('Loading conversation history from backend...');
        const extractedMessages = await chatsService.getMessagesFromContext(id);
        console.log('Loaded messages from context:', extractedMessages);
        setMessages(extractedMessages);

        // Set current context ID from the chat
        setCurrentContextId(id);
        console.log('Set current context ID:', id);


        // Load agent information from the agents service
        if (foundChat?.agentId) {
          console.log('Loading agent with ID:', foundChat.agentId);
          const agentInfo = await agentsService.getById(foundChat.agentId);
          if (agentInfo) {
            console.log('Loaded agent:', agentInfo);
            setAgent(agentInfo);
          } else {
            console.error('Agent not found:', foundChat.agentId);
            setAgent(null);
            toast.error('Agent not found');
          }
        } else {
          console.log('No agentId found in chat');
          setAgent(null);
        }

        toast.success(`Loaded ${extractedMessages.length} messages from conversation history`);
      } catch (error) {
        console.error('Error loading chat and messages:', error);
        toast.error('Failed to load chat');
      } finally {
        setLoading(false);
      }
    };

    loadChatAndMessages();
  }, [id]);

  const handleEdit = () => {
    // TODO: Implement edit functionality
    console.log('Edit chat:', chat);
  };

  const handleDelete = async () => {
    if (!chat) return;
    
    try {
      await chatsService.delete(chat.id);
      navigate('/chats');
    } catch (error) {
      console.error('Error deleting chat:', error);
    }
  };

  const handleRefresh = async () => {
    if (!id) return;
    
    try {
      setRefreshing(true);
      toast.info('Refreshing conversation...');
      
      console.log('Refreshing conversation from backend...');
      const refreshedMessages = await chatsService.getMessagesFromContext(id);
      console.log('Refreshed messages:', refreshedMessages);
      setMessages(refreshedMessages);
      
      
      toast.success(`Refreshed ${refreshedMessages.length} messages`);
    } catch (error) {
      console.error('Error refreshing conversation:', error);
      toast.error('Failed to refresh conversation');
    } finally {
      setRefreshing(false);
    }
  };

  const handleEditMessage = (message: Message) => {
    // TODO: Implement edit message functionality
    console.log('Edit message:', message);
  };

  const handleDeleteMessage = async (message: Message) => {
    try {
      await messagesService.delete(message.id);
      const updatedMessages = await messagesService.getByChatId(id!);
      setMessages(updatedMessages);
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !id || sending) return;

    try {
      setSending(true);
      
      // Store the user input before clearing
      const userInput = newMessage.trim();
      
      // Clear input immediately for better UX
      setNewMessage('');

      // Display user message immediately (like CLI does)
      const userMessage: Message = {
        id: `temp-user-${Date.now()}`,
        chatId: id,
        content: userInput,
        sender: 'User',
        type: 'user',
        status: 'sent',
        timestamp: new Date().toISOString()
      };

      // Add user message to UI immediately (avoid duplicates)
      setMessages(prevMessages => {
        if (prevMessages.some(m => m.id === userMessage.id)) return prevMessages;
        return [...prevMessages, userMessage];
      });
      
      // Send to A2A agent (like CLI does)
      const a2aMessage = A2AClient.convertToA2AMessage(userMessage);
      a2aMessage.contextId = currentContextId || id; // Use current context ID
      const messageParams = { message: a2aMessage };

      // Reset streaming state for new conversation
      setStreamingMessage(null);
      setLastDisplayedContent('');
      setIsCurrentlyStreaming(false);
      setStreamedTaskIds(new Set());

      console.log('Sending message to agent:', agent?.name);
      toast.info(`Sending message to ${agent?.name || 'agent'}...`);

      // Create agent-specific client if available
      if (!agent || !agent.id) {
        throw new Error('No agent or agent ID available');
      }

      // Create agent card URL - the A2A SDK expects the full agent card URL
      const agentCardUrl = `https://ohzbghitbjryfpmucgju.supabase.co/functions/v1/server/agents/${agent.id}/.well-known/agent-card.json`;
      
      // Initialize client for agent (auth handled internally)
      const clientForAgent = await A2AClient.fromCardUrl(agentCardUrl);

      // Single stream for entire conversation (like CLI)
      const stream = clientForAgent.sendMessageStream(messageParams);
      let hasReceivedAgentMessage = false;

      for await (const event of stream) {
        await handleStreamEvent(event);

        // Track if we received any agent response
        if (event.kind === 'status-update') {
          hasReceivedAgentMessage = hasReceivedAgentMessage || !!event.status?.message;
        } else if (event.kind === 'artifact-update') {
          const textParts = event.artifact?.parts?.filter((p: any) => p.kind === 'text') || [];
          hasReceivedAgentMessage = hasReceivedAgentMessage || textParts.length > 0;
        } else if (event.kind === 'task') {
          hasReceivedAgentMessage = hasReceivedAgentMessage || !!event.status?.message;
        }
      }

      // Show success/failure toast
      if (hasReceivedAgentMessage) {
        toast.success('Message sent successfully!');
      } else {
        toast.warning('No response received from agent');
      }

      // Don't refresh from backend - the streaming response handles all message updates
      
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleToolCallApprove = async (toolCall: PendingToolCall, reason?: string) => {
    if (!agent) return;

    try {
      setSending(true);

      // Show success toast immediately when user approves
      toast.success('Tool call approved');

      // Create agent client
      const agentCardUrl = `https://ohzbghitbjryfpmucgju.supabase.co/functions/v1/server/agents/${agent.id}/.well-known/agent-card.json`;
      const clientForAgent = await A2AClient.fromCardUrl(agentCardUrl);

      // Find the message with this tool call to get task ID
      const toolCallMessage = messages.find(msg =>
        (msg.type === 'assistant' || msg.type === 'tool_call') &&
        msg.rawMessage &&
        (msg.rawMessage.callId === toolCall.id || msg.rawMessage.id === toolCall.id)
      );

      console.log('Found tool call message for approval:', toolCallMessage);
      console.log('Tool call raw message:', toolCallMessage?.rawMessage);

      // Extract task ID from raw message
      const taskId = toolCallMessage?.rawMessage?.taskId;
      console.log('Using task ID for approval:', taskId);

      // Create tool call response message - use current context ID and found task ID
      const toolResponse = A2AClient.createToolCallResponse(
        toolCall.id,
        toolCall.artifactId,
        'approve',
        reason,
        `Tool call approved by user${reason ? `: ${reason}` : ''}`,
        currentContextId || id, // Use current context ID
        taskId // Use task ID from raw message
      );

      // Send the response
      const messageParams = { message: toolResponse };
      const stream = clientForAgent.sendMessageStream(messageParams);

      // Route events through shared handler
      for await (const event of stream) {
        console.log('Tool call approve response event:', event.kind);
        await handleStreamEvent(event);
      }

      // Refresh messages from backend to get the latest state
      console.log('Refreshing messages after tool approval...');
      const refreshedMessages = await chatsService.getMessagesFromContext(id!);
      setMessages(refreshedMessages);

    } catch (error) {
      console.error('Error approving tool call:', error);
      toast.error('Failed to approve tool call');
    } finally {
      setSending(false);
    }
  };

  const handleToolCallReject = async (toolCall: PendingToolCall, reason?: string) => {
    if (!agent) return;

    try {
      setSending(true);

      // Show success toast immediately when user rejects
      toast.success('Tool call rejected');

      // Create agent client
      const agentCardUrl = `https://ohzbghitbjryfpmucgju.supabase.co/functions/v1/server/agents/${agent.id}/.well-known/agent-card.json`;
      const clientForAgent = await A2AClient.fromCardUrl(agentCardUrl);

      // Find the message with this tool call to get task ID
      const toolCallMessage = messages.find(msg =>
        (msg.type === 'assistant' || msg.type === 'tool_call') &&
        msg.rawMessage &&
        (msg.rawMessage.callId === toolCall.id || msg.rawMessage.id === toolCall.id)
      );

      console.log('Found tool call message for rejection:', toolCallMessage);
      console.log('Tool call raw message:', toolCallMessage?.rawMessage);

      // Extract task ID from raw message
      const taskId = toolCallMessage?.rawMessage?.taskId;
      console.log('Using task ID for rejection:', taskId);

      // Create tool call response message - use current context ID and found task ID
      const toolResponse = A2AClient.createToolCallResponse(
        toolCall.id,
        toolCall.artifactId,
        'reject',
        reason,
        `Tool call rejected by user${reason ? `: ${reason}` : ''}`,
        currentContextId || id, // Use current context ID
        taskId // Use task ID from raw message
      );

      // Send the response
      const messageParams = { message: toolResponse };
      const stream = clientForAgent.sendMessageStream(messageParams);

      // Route events through shared handler
      for await (const event of stream) {
        console.log('Tool call reject response event:', event.kind);
        await handleStreamEvent(event);
      }


      // Refresh messages from backend to get the latest state
      console.log('Refreshing messages after tool rejection...');
      const refreshedMessages = await chatsService.getMessagesFromContext(id!);
      setMessages(refreshedMessages);

    } catch (error) {
      console.error('Error rejecting tool call:', error);
      toast.error('Failed to reject tool call');
    } finally {
      setSending(false);
    }
  };

  const handleToolCallModify = (toolCall: PendingToolCall, paramName: string, value: any) => {
    // Since we're creating tool call data on-the-fly, we need to refresh the messages
    // to show the updated parameters. This is a simplified approach.
    console.log('Tool call parameter modified:', paramName, '=', value);
    toast.info(`Parameter ${paramName} modified to ${value}`);
  };

  const handleShowParams = (toolCall: PendingToolCall) => {
    console.log('Current tool call parameters:', toolCall.parameters);
      toast.info('Parameters logged to console');
  };

  const getStatusBadge = () => {
    switch (chat?.status) {
      case 'archived':
        return <Badge variant="secondary">Archived</Badge>;
      case 'paused':
        return <Badge variant="outline">Paused</Badge>;
      case 'active':
        return <Badge className="bg-success/10 text-success border-success/20">Active</Badge>;
      default:
        return null;
    }
  };

  return (
    <ItemPage
      loading={loading}
      item={chat}
      itemType="Chat"
      backPath="/chats"
      backLabel="Back to Chats"
      icon={<MessageCircle className="w-8 h-8 text-primary-foreground" />}
      onEdit={handleEdit}
      onDelete={handleDelete}
      statusBadge={getStatusBadge()}
    >
      {chat && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="flex items-center space-x-2 text-sm text-text-tertiary">
              <Calendar className="w-4 h-4 flex-shrink-0" />
              <span>Created: {chat.createdAt}</span>
            </div>
            
            <div className="flex items-center space-x-2 text-sm text-text-tertiary">
              <Hash className="w-4 h-4 flex-shrink-0" />
              <span>{messages.length} messages</span>
            </div>

            {agent && (
              <div className="flex items-center space-x-2 text-sm text-text-tertiary">
                <Bot className="w-4 h-4 flex-shrink-0" />
                <span>Agent: {agent.name}</span>
              </div>
            )}
            
            {chat.participants && chat.participants.length > 0 && (
              <div className="flex items-center space-x-2 text-sm text-text-tertiary">
                <Users className="w-4 h-4 flex-shrink-0" />
                <span>{chat.participants.length} participants</span>
              </div>
            )}
          </div>

          {/* Messages */}
          <div className="border-t border-border pt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-text-primary">Messages</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
            
            {messages.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-surface-elevated rounded-full flex items-center justify-center mx-auto mb-4">
                  <MessageCircle className="text-4xl text-text-tertiary" />
                </div>
                <h3 className="text-lg font-semibold text-text-primary mb-2">
                  No messages found
                </h3>
                <p className="text-text-secondary">
                  This chat doesn't have any messages yet.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((message, index) => {
                  // Check if this is a tool call message (either assistant with tool call or direct tool_call type)
                  // But skip handoff function calls (transfer_to_*) like the CLI does
                  const toolCallMatch = message.content?.trim().match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\(\s*.*\s*\)\s*$/);
                  const toolName = toolCallMatch?.[1];
                  const isHandoffFunction = toolName?.startsWith('transfer_to_');
                  
                  const isToolCallMessage = ((message.type === 'assistant' && 
                    (message.isToolCall || toolCallMatch)) || 
                    message.type === 'tool_call') && 
                    !isHandoffFunction;
                  
                  // Check if this tool call has been executed by looking for subsequent tool responses
                  // Only show approval for pending tool calls (like CLI does)
                  const hasSubsequentToolResponse = messages.slice(index + 1).some(laterMessage =>
                    laterMessage.type === 'tool_response' ||
                    (laterMessage.sender === 'Tool')
                  );
                  
                  // Show tool approval for all tool calls (pending or completed)
                  const shouldShowToolApproval = isToolCallMessage;
                  
                  // Debug logging for tool call detection
                  if ((message.type === 'assistant' && message.content) || message.type === 'tool_call') {
                    console.log('Tool call detection for message:', {
                      messageId: message.id,
                      content: message.content,
                      type: message.type,
                      isToolCall: message.isToolCall,
                      toolCallMatch: toolCallMatch,
                      isHandoffFunction: isHandoffFunction,
                      isToolCallMessage: isToolCallMessage,
                      hasSubsequentToolResponse: hasSubsequentToolResponse,
                      shouldShowToolApproval: shouldShowToolApproval,
                      rawMessage: message.rawMessage
                    });
                  }
                  
                  return (
                    <div key={message.id}>
                      <MessageRow message={message} contextId={currentContextId} taskId={currentTaskId} />
                      
                      {/* Show Tool Call Approval right after ANY assistant message with a tool call */}
                      {shouldShowToolApproval && (
                          <div className="mt-3">
                            {/* This tool call is pending (no subsequent tool response found) */}
                            {(() => {
                            // Get tool call information from message
                            let toolName = '';
                            let parameters: Record<string, any> = {};
                            
                            // Try to get tool name from rawMessage first, then from content
                            if (message.rawMessage?.name) {
                              toolName = message.rawMessage.name;
                              // Parse arguments string into parameters object
                              const argsString = message.rawMessage.arguments;
                              if (argsString && argsString.trim() !== '') {
                                try {
                                  const firstParse = JSON.parse(argsString);
                                  if (typeof firstParse === 'string') {
                                    parameters = JSON.parse(firstParse);
                                  } else {
                                    parameters = firstParse;
                                  }
                                } catch (error) {
                                  parameters = {};
                                }
                              }
                            } else if (toolCallMatch) {
                              toolName = toolCallMatch[1];
                              const argsString = toolCallMatch[2];
                              if (argsString && argsString.trim() !== '') {
                                try {
                                  const firstParse = JSON.parse(argsString);
                                  if (typeof firstParse === 'string') {
                                    parameters = JSON.parse(firstParse);
                                  } else {
                                    parameters = firstParse;
                                  }
                                } catch (error) {
                                  parameters = {};
                                }
                              }
                            }
                            
                            if (!toolName) return null;
                            
                            const realToolCallId = message.rawMessage?.callId || message.rawMessage?.id || message.id;
                            
                            const toolCallForApproval: PendingToolCall = {
                              id: realToolCallId,
                              name: toolName,
                              parameters,
                              artifactId: realToolCallId,
                              description: `Tool call: ${toolName}`,
                              approved: hasSubsequentToolResponse // Approved if there's a subsequent tool response
                            };
                            
                            return (
              <ToolCallApproval
                                toolCall={toolCallForApproval}
                                onApprove={(reason) => handleToolCallApprove(toolCallForApproval, reason)}
                                onReject={(reason) => handleToolCallReject(toolCallForApproval, reason)}
                                onModify={(paramName, value) => handleToolCallModify(toolCallForApproval, paramName, value)}
                                onShowParams={() => handleShowParams(toolCallForApproval)}
                                isVisible={true}
                              />
                            );
                          })()}
                          </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Message Input */}
            <div className="mt-6 border-t border-border pt-4">
              <div className="flex gap-2">
                <Textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your message here... (Press Enter to send, Shift+Enter for new line)"
                  className="flex-1 resize-none min-h-[80px]"
                  disabled={sending}
                />
                <Button 
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || sending}
                  className="self-end"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </ItemPage>
  );
};

export default Chat;