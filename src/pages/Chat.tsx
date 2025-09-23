import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ItemPage } from '@/components/ItemPage';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MessageCircle, Calendar, Users, Hash, Send, Bot } from 'lucide-react';
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
  const [pendingToolCall, setPendingToolCall] = useState<PendingToolCall | null>(null);
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
  const pendingToolCallRef = useRef<PendingToolCall | null>(null);

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

  useEffect(() => {
    pendingToolCallRef.current = pendingToolCall;
  }, [pendingToolCall]);

  // Shared stream event handler (matches example client pattern)
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

      // Update current task and context IDs
      if (statusEvent.taskId && statusEvent.taskId !== currentTaskId) {
        setCurrentTaskId(statusEvent.taskId);
      }
      if (statusEvent.contextId && statusEvent.contextId !== currentContextId) {
        setCurrentContextId(statusEvent.contextId);
      }

      // Handle status message content (matches example client logic)
      if (statusEvent.status.message) {
        const agentMessage = A2AClient.convertFromA2AMessage(statusEvent.status.message, id!);

        // Detect streaming mode (working state and not final) - matches example client
        const isStreaming = statusEvent.status.state === 'working' && !statusEvent.final;

        console.log('Streaming Debug:', {
          state: statusEvent.status.state,
          final: statusEvent.final,
          isStreaming,
          taskId: statusEvent.taskId,
          hasStreamedThisTask: streamedTaskIds.has(statusEvent.taskId),
          lastDisplayedLength: lastDisplayedContent.length,
          currentContentLength: agentMessage.content?.length || 0,
          content: agentMessage.content?.substring(0, 50) + '...'
        });

        if (isStreaming) {
          // Start streaming message once per task
          if (!streamingMessageRef.current || currentStreamingTaskIdRef.current !== statusEvent.taskId) {
            console.log('Starting streaming for task:', statusEvent.taskId);
            setIsCurrentlyStreaming(true);
            setStreamedTaskIds(prev => new Set([...prev, statusEvent.taskId]));
            currentStreamingTaskIdRef.current = statusEvent.taskId;
            setLastDisplayedContent('');

            // Create initial streaming message
            const tempMessage: Message = {
              id: `temp-${statusEvent.taskId}`, // Use task ID to ensure uniqueness
              chatId: id!,
              content: agentMessage.content!,
              sender: agentMessage.sender!,
              type: agentMessage.type!,
              status: 'sending',
              timestamp: new Date().toISOString()
            };

            // Set ref immediately to avoid race on next tick
            streamingMessageRef.current = tempMessage;
            setStreamingMessage(tempMessage);
            setMessages(prevMessages => {
              if (prevMessages.some(m => m.id === tempMessage.id)) return prevMessages;
              return [...prevMessages, tempMessage];
            });
          }

          // Update streaming content (matches example delta logic)
          const currentText = agentMessage.content!;
          if (currentText.length > (lastDisplayedContentRef.current?.length || 0) &&
              currentText.startsWith(lastDisplayedContentRef.current || '')) {
            // Show only the delta (new content)
            console.log('Delta update detected');
            setLastDisplayedContent(currentText);

            // Update the streaming message
            if (streamingMessageRef.current) {
              const updatedMessage = {
                ...streamingMessageRef.current,
                content: currentText,
                status: 'sending' as const
              };

              setStreamingMessage(updatedMessage);
              setMessages(prevMessages =>
                prevMessages.map(msg =>
                  msg.id === streamingMessageRef.current!.id ? updatedMessage : msg
                )
              );
            }
          } else if (currentText !== lastDisplayedContentRef.current) {
            // Content changed completely
            console.log('Complete content replacement');
            setLastDisplayedContent(currentText);

            if (streamingMessageRef.current) {
              const updatedMessage = {
                ...streamingMessageRef.current,
                content: currentText,
                status: 'sending' as const
              };

              setStreamingMessage(updatedMessage);
              setMessages(prevMessages =>
                prevMessages.map(msg =>
                  msg.id === streamingMessageRef.current!.id ? updatedMessage : msg
                )
              );
            }
          }
        } else {
          // For non-streaming mode, check if we were just streaming (matches example)
          if (isCurrentlyStreamingRef.current && statusEvent.status.state === 'completed' && statusEvent.final) {
            console.log('Completing streaming for task:', statusEvent.taskId);

            // Finalize the streaming message
            if (streamingMessageRef.current) {
              const finalMessage = await messagesService.create({
                chatId: id!,
                content: agentMessage.content!,
                sender: agentMessage.sender!,
                type: agentMessage.type!,
                status: 'sent'
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
          } else {
            // Regular non-streaming message (tool approvals, etc.)
            console.log('Creating non-streaming message for state:', statusEvent.status.state);
            // Only persist final non-streaming messages once
            const newMessage = await messagesService.create({
              chatId: id!,
              content: agentMessage.content!,
              sender: agentMessage.sender!,
              type: agentMessage.type!,
              status: 'sent'
            });

            setMessages(prevMessages => [...prevMessages, newMessage]);
          }
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
                  // Avoid duplicate prompts if one is already pending
                  if (!pendingToolCallRef.current) {
                    const newPending: PendingToolCall = {
                      id: `call_${Date.now()}`,
                      name: toolName,
                      parameters,
                      artifactId: `tool-call-${Date.now()}`,
                      description: 'Tool execution requires human approval'
                    };
                    setPendingToolCall(newPending);
                    toast.info('Tool call requires approval');
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

        if (toolCallData && toolCallData.kind === 'data') {
          const toolCall = toolCallData.data.toolCall;
          if (!pendingToolCallRef.current) {
            const newPending: PendingToolCall = {
              id: toolCall.id || `call_${Date.now()}`,
              name: toolCall.name || 'Unknown Tool',
              parameters: toolCall.parameters || {},
              artifactId: artifactEvent.artifact.artifactId,
              description: artifactEvent.artifact.name || 'Tool execution request'
            };
            setPendingToolCall(newPending);
            toast.info('Tool call requires approval');
          }
        }
      } else {
        // Handle other artifacts as messages - but only if not streaming
        if (!streamingMessageRef.current || !isCurrentlyStreamingRef.current) {
          const textParts = artifactEvent.artifact.parts.filter(p => p.kind === 'text') as TextPart[];
          if (textParts.length > 0) {
            const content = textParts.map(p => p.text).join('\n');
            const newMessage = await messagesService.create({
              chatId: id!,
              content,
              sender: 'Agent',
              type: 'assistant',
              status: 'sent'
            });

            // Add to local messages state
            setMessages(prevMessages => [...prevMessages, newMessage]);
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
        const agentMessage = A2AClient.convertFromA2AMessage(task.status.message, id!);

        // Only create message if we're not currently streaming
        if (!isCurrentlyStreaming) {
          const newMessage = await messagesService.create({
            chatId: id!,
            content: agentMessage.content!,
            sender: agentMessage.sender!,
            type: agentMessage.type!,
            status: 'sent'
          });

          setMessages(prevMessages => [...prevMessages, newMessage]);
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
        const chats = await chatsService.getAll();
        const foundChat = chats.find(c => c.id === id);
        setChat(foundChat || null);
        
        // Extract messages from taskHistories instead of using messagesService
        let extractedMessages: Message[] = [];
        if (foundChat) {
          extractedMessages = await chatsService.getMessagesFromContext(id);
        }
        setMessages(extractedMessages);

        // Load agent information from the agents service
        if (foundChat?.agentId) {
          console.log('Chat: Using agent ID:', foundChat.agentId);
          const agentInfo = await agentsService.getById(foundChat.agentId);
          if (agentInfo) {
            console.log('Chat: Loaded agent from service:', agentInfo);
            setAgent(agentInfo);
          } else {
            console.error('Chat: Agent not found in service:', foundChat.agentId);
            setAgent(null);
          }
        } else {
          console.log('Chat: No agentId found in chat:', foundChat);
          setAgent(null);
        }
      } catch (error) {
        console.error('Error loading chat and messages:', error);
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
      
      // Create user message first
      const userMessage = await messagesService.create({
        chatId: id,
        content: newMessage,
        sender: 'User',
        type: 'user',
        status: 'sent'
      });

      // Update messages list immediately
      const updatedMessages = await messagesService.getByChatId(id);
      setMessages(updatedMessages);
      
      // Clear input
      setNewMessage('');

      // Send to A2A agent
      const a2aMessage = A2AClient.convertToA2AMessage(userMessage);
      a2aMessage.contextId = id; // Use the chat ID as context ID
      const messageParams = { message: a2aMessage };

      // Reset streaming state for new conversation
      setStreamingMessage(null);
      setLastDisplayedContent('');
      setIsCurrentlyStreaming(false);

      toast.info(`Sending message to ${agent?.name || 'agent'}...`);

      // Create agent-specific client if available
      console.log('Agent object:', agent);
      console.log('Agent ID:', agent?.id);
      if (!agent || !agent.id) {
        throw new Error('No agent or agent ID available');
      }

      // Create agent card URL - the A2A SDK expects the full agent card URL
      const agentCardUrl = `https://ohzbghitbjryfpmucgju.supabase.co/functions/v1/server/agents/${agent.id}/.well-known/agent-card.json`;
      
      // Initialize client for agent (auth handled internally)
      const clientForAgent = await A2AClient.fromCardUrl(agentCardUrl);

      // Single stream for entire conversation
      const stream = clientForAgent.sendMessageStream(messageParams);
      let hasReceivedAgentMessage = false;

      for await (const event of stream) {
        await handleStreamEvent(event);

        // Minimal success detection without duplicating logic
        if (event.kind === 'status-update') {
          hasReceivedAgentMessage = hasReceivedAgentMessage || !!event.status?.message;
        } else if (event.kind === 'artifact-update') {
          const textParts = event.artifact?.parts?.filter((p: any) => p.kind === 'text') || [];
          hasReceivedAgentMessage = hasReceivedAgentMessage || textParts.length > 0;
        } else if (event.kind === 'task') {
          hasReceivedAgentMessage = hasReceivedAgentMessage || !!event.status?.message;
        }
      }

      toast[hasReceivedAgentMessage ? 'success' : 'warning'](
        hasReceivedAgentMessage ? 'Message sent successfully!' : 'No response received from agent'
      );
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

  const handleToolCallApprove = async (reason?: string) => {
    if (!pendingToolCall || !agent) return;

    try {
      setSending(true);

      // Store the current tool call ID before processing
      const currentToolCallId = pendingToolCall.id;

      // Reuse same agent client used for main stream to avoid parallel streams
      const clientForAgent = await A2AClient.fromAgentId(agent.id);

      // Create tool call response message
      const toolResponse = A2AClient.createToolCallResponse(
        pendingToolCall.id,
        pendingToolCall.artifactId,
        'approve',
        reason,
        `Tool call approved by user${reason ? `: ${reason}` : ''}`,
        currentContextId,
        currentTaskId
      );

      // Clear current pending request immediately to allow subsequent approvals to surface
      setPendingToolCall(null);

      // Send the response
      const messageParams = { message: toolResponse };
      const stream = clientForAgent.sendMessageStream(messageParams);

      // Route events through shared handler; do not create new temp messages here
      for await (const event of stream) {
        console.log('Tool call approve response event:', event.kind);
        await handleStreamEvent(event);
      }

      // Only clear pending tool call if no new one was set during processing
      // (i.e., if the current pending tool call is still the one we processed)
      setPendingToolCall(prev => {
        // If a new tool call was set during processing, keep it
        if (prev && prev.id !== currentToolCallId) {
          return prev;
        }
        // Otherwise, clear it
        return null;
      });
      const refreshedMessages = await messagesService.getByChatId(id!);
      setMessages(refreshedMessages);

      toast.success('Tool call approved');
    } catch (error) {
      console.error('Error approving tool call:', error);
      toast.error('Failed to approve tool call');
    } finally {
      setSending(false);
    }
  };

  const handleToolCallReject = async (reason?: string) => {
    if (!pendingToolCall || !agent) return;

    try {
      setSending(true);

      // Store the current tool call ID before processing
      const currentToolCallId = pendingToolCall.id;

      // Use the new static method for creating client
      const clientForAgent = await A2AClient.fromAgentId(agent.id);

      // Create tool call response message
      const toolResponse = A2AClient.createToolCallResponse(
        pendingToolCall.id,
        pendingToolCall.artifactId,
        'reject',
        reason,
        `Tool call rejected by user${reason ? `: ${reason}` : ''}`,
        currentContextId,
        currentTaskId
      );

      // Clear current pending request immediately to allow subsequent approvals to surface
      setPendingToolCall(null);

      // Send the response
      const messageParams = { message: toolResponse };
      const stream = clientForAgent.sendMessageStream(messageParams);

      // Process the response stream - but this creates a separate stream from the main handler
      // This means the main handler won't see these events, which is why messages don't appear in the UI
      for await (const event of stream) {
        console.log('Tool call approve response event:', event.kind);
        await handleStreamEvent(event);
        // Handle the response similar to regular messages
        if (event.kind === 'status-update') {
          const statusEvent = event as TaskStatusUpdateEvent;
          if (statusEvent.status.message) {
            const agentMessage = A2AClient.convertFromA2AMessage(statusEvent.status.message, id!);
            // Handle streaming updates the same way as main handler
            const isStreamingUpdate = statusEvent.status.state === 'working' && !statusEvent.final;
            
            if (isStreamingUpdate) {
              // For streaming updates, update existing message or create temporary one
              if (!streamingMessage) {
                const tempMessage: Message = {
                  id: `temp-${Date.now()}`,
                  chatId: id!,
                  content: agentMessage.content!,
                  sender: agentMessage.sender!,
                  type: agentMessage.type!,
                  status: 'sending',
                  timestamp: new Date().toISOString()
                };
                setStreamingMessage(tempMessage);
                setMessages(prevMessages => [...prevMessages, tempMessage]);
              } else {
                // Update existing streaming message
                setStreamingMessage(prev => prev ? { ...prev, content: agentMessage.content! } : null);
                setMessages(prevMessages => 
                  prevMessages.map(msg => 
                    msg.id === streamingMessage.id 
                      ? { ...msg, content: agentMessage.content! }
                      : msg
                  )
                );
              }
            } else {
              // Final update - create real message
              if (streamingMessage) {
                const newMessage = await messagesService.create({
                  chatId: id!,
                  content: agentMessage.content!,
                  sender: agentMessage.sender!,
                  type: agentMessage.type!,
                  status: agentMessage.status!
                });
                
                // Replace temporary message with real one
                setMessages(prevMessages => 
                  prevMessages.map(msg => 
                    msg.id === streamingMessage.id ? newMessage : msg
                  )
                );
                setStreamingMessage(null);
              } else {
                const newMessage = await messagesService.create({
                  chatId: id!,
                  content: agentMessage.content!,
                  sender: agentMessage.sender!,
                  type: agentMessage.type!,
                  status: agentMessage.status!
                });
                setMessages(prevMessages => [...prevMessages, newMessage]);
              }
            }

            // Surface next approval request from status text if present
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
                      setPendingToolCall({
                        id: `call_${Date.now()}`,
                        name: toolName,
                        parameters,
                        artifactId: `tool-call-${Date.now()}`,
                        description: 'Tool execution requires human approval'
                      });
                      toast.info('Tool call requires approval');
                      break;
                    }
                  }
                }
              }
            }
          }
        } else if (event.kind === 'artifact-update') {
          const artifactEvent = event as TaskArtifactUpdateEvent;
          const isToolCallArtifact = artifactEvent.artifact.parts.some(
            part => part.kind === 'data' &&
              part.data && typeof part.data === 'object' && (part.data as any)['toolCall']
          );
          if (isToolCallArtifact) {
            const toolCallData = artifactEvent.artifact.parts.find(
              part => part.kind === 'data' && part.data && typeof part.data === 'object' && (part.data as any)['toolCall']
            );
            if (toolCallData && toolCallData.kind === 'data') {
              const toolCall = (toolCallData.data as any).toolCall;
              setPendingToolCall({
                id: toolCall.id || crypto.randomUUID(),
                name: toolCall.name || 'Unknown Tool',
                parameters: toolCall.parameters || {},
                artifactId: artifactEvent.artifact.artifactId,
                description: artifactEvent.artifact.name || 'Tool execution request'
              });
              toast.info('Tool call requires approval');
            }
          }
        } else if (event.kind === 'task') {
          const task = event as Task;
          console.log(`Tool call response task: ${task.id}`);
          console.log(`Task status:`, task.status);
          console.log(`Task message:`, task.status.message);

          if (task.status.message) {
            const agentMessage = A2AClient.convertFromA2AMessage(task.status.message, id!);
            console.log(`Converted agent message:`, agentMessage);
            // Handle streaming updates the same way as main handler
            const isStreamingUpdate = task.status.state === 'working';
            
            if (isStreamingUpdate) {
              // For streaming updates, update existing message or create temporary one
              if (!streamingMessage) {
                const tempMessage: Message = {
                  id: `temp-${Date.now()}`,
                  chatId: id!,
                  content: agentMessage.content!,
                  sender: agentMessage.sender!,
                  type: agentMessage.type!,
                  status: 'sending',
                  timestamp: new Date().toISOString()
                };
                setStreamingMessage(tempMessage);
                setMessages(prevMessages => [...prevMessages, tempMessage]);
              } else {
                // Update existing streaming message
                setStreamingMessage(prev => prev ? { ...prev, content: agentMessage.content! } : null);
                setMessages(prevMessages => 
                  prevMessages.map(msg => 
                    msg.id === streamingMessage.id 
                      ? { ...msg, content: agentMessage.content! }
                      : msg
                  )
                );
              }
            } else {
              // Final update - create real message
              if (streamingMessage) {
                const newMessage = await messagesService.create({
                  chatId: id!,
                  content: agentMessage.content!,
                  sender: agentMessage.sender!,
                  type: agentMessage.type!,
                  status: agentMessage.status!
                });
                
                // Replace temporary message with real one
                setMessages(prevMessages => 
                  prevMessages.map(msg => 
                    msg.id === streamingMessage.id ? newMessage : msg
                  )
                );
                setStreamingMessage(null);
              } else {
                const newMessage = await messagesService.create({
                  chatId: id!,
                  content: agentMessage.content!,
                  sender: agentMessage.sender!,
                  type: agentMessage.type!,
                  status: agentMessage.status!
                });
                setMessages(prevMessages => [...prevMessages, newMessage]);
              }
            }
            console.log(`Message saved successfully`);
          } else {
            console.log(`No message in task status`);
          }
        }
      }

      // Only clear pending tool call if no new one was set during processing
      // (i.e., if the current pending tool call is still the one we processed)
      setPendingToolCall(prev => {
        // If a new tool call was set during processing, keep it
        if (prev && prev.id !== currentToolCallId) {
          return prev;
        }
        // Otherwise, clear it
        return null;
      });
      const refreshedMessages = await messagesService.getByChatId(id!);
      setMessages(refreshedMessages);

      toast.success('Tool call rejected');
    } catch (error) {
      console.error('Error rejecting tool call:', error);
      toast.error('Failed to reject tool call');
    } finally {
      setSending(false);
    }
  };

  const handleToolCallModify = (paramName: string, value: any) => {
    if (!pendingToolCall) return;

    setPendingToolCall({
      ...pendingToolCall,
      parameters: {
        ...pendingToolCall.parameters,
        [paramName]: value
      }
    });

    toast.info(`Modified parameter ${paramName} to ${value}`);
  };

  const handleShowParams = () => {
    if (pendingToolCall) {
      console.log('Current tool call parameters:', pendingToolCall.parameters);
      toast.info('Parameters logged to console');
    }
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
            <h2 className="text-xl font-semibold text-text-primary mb-4">Messages</h2>
            
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
                {messages.map((message) => (
                  <MessageRow
                    key={message.id}
                    message={message}
                  />
                ))}
              </div>
            )}

            {/* Tool Call Approval */}
            {pendingToolCall && (
              <ToolCallApproval
                toolCall={pendingToolCall}
                onApprove={handleToolCallApprove}
                onReject={handleToolCallReject}
                onModify={handleToolCallModify}
                onShowParams={handleShowParams}
                isVisible={!!pendingToolCall}
              />
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