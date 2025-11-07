import { useEffect, useState, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { ChatKit, useChatKit } from '@openai/chatkit-react';
import { agentsService } from '@/services/agentsService';
import { threadsService } from '@/services/threadsService';
import { getBackendType, setBackendType, getBackendBaseUrl, getChatKitUrl, type BackendType } from '@/services/backendConfig';
import type { AgentRecord } from '@/types/agent';
import type { ThreadMetadata } from '@/types/thread';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonIcon,
  IonSpinner,
  IonButtons,
} from '@ionic/react';
import { personCircleOutline } from 'ionicons/icons';
import SidebarMenu from '@/components/SidebarMenu';
import CombinedAgentSelector from '@/components/CombinedAgentSelector';

const Chat = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<AgentRecord | null>(null);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [threads, setThreads] = useState<ThreadMetadata[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(false);

  // Settings state
  const [darkMode, setDarkMode] = useState(true);
  const [backendType, setBackendTypeState] = useState<BackendType>(getBackendType());

  // Agent details state
  const [agentDetails, setAgentDetails] = useState<AgentRecord | null>(null);
  const [loadingAgentDetails, setLoadingAgentDetails] = useState(false);

  // Menu refs
  const leftMenuRef = useRef<HTMLIonMenuElement>(null);
  const rightMenuRef = useRef<HTMLIonMenuElement>(null);

  // Get server base URL based on selected backend
  const getServerBaseUrl = () => getBackendBaseUrl(backendType);

  // Load agents
  const loadAgents = useCallback(async () => {
    try {
      setLoadingAgents(true);
      const agentsData = await agentsService.getAll();
      setAgents(agentsData);

      // Auto-select the first agent if available
      if (agentsData.length > 0 && !selectedAgent) {
        setSelectedAgent(agentsData[0]);
      }
    } catch (error) {
      console.error('Error loading agents:', error);
      toast.error('Failed to load agents');
    } finally {
      setLoadingAgents(false);
    }
  }, [selectedAgent, backendType]);

  // Load agent details
  const loadAgentDetails = async (agentId: string) => {
    try {
      setLoadingAgentDetails(true);
      const details = await agentsService.getById(agentId);
      setAgentDetails(details);
    } catch (error) {
      console.error('Error loading agent details:', error);
      toast.error('Failed to load agent details');
    } finally {
      setLoadingAgentDetails(false);
    }
  };

  // Load threads for the current agent
  const loadThreads = useCallback(async (skipAutoSelect: boolean = false) => {
    if (!selectedAgent) {
      setThreads([]);
      return;
    }

    try {
      setLoadingThreads(true);
      const response = await threadsService.listThreads(backendType, 50);
      setThreads(response.data);
      
      // Auto-select the most recent thread if available and no thread is selected
      // Skip auto-selection if explicitly requested (e.g., when creating a new thread)
      if (!skipAutoSelect) {
        setCurrentThreadId((prevThreadId) => {
          if (response.data.length > 0 && !prevThreadId) {
            return response.data[0].id;
          }
          return prevThreadId;
        });
      }
    } catch (error) {
      console.error('Error loading threads:', error);
      toast.error('Failed to load threads');
      setThreads([]);
    } finally {
      setLoadingThreads(false);
    }
  }, [selectedAgent, backendType]);

  // Check for existing session or sign in anonymously on component mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // First, check if there's already a valid session
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (session && !sessionError) {
          // We have a valid session, use it
          setIsAuthenticated(true);
          await loadAgents();
        } else {
          // No valid session, sign in anonymously
          const { data, error } = await supabase.auth.signInAnonymously();
          if (error) {
            console.error('Anonymous sign-in error:', error);
            toast.error('Failed to initialize chat');
          } else {
            setIsAuthenticated(true);
            await loadAgents();
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        toast.error('Failed to initialize chat');
      }
    };

    initializeAuth();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setIsAuthenticated(false);
        // Optionally sign in anonymously again
        supabase.auth.signInAnonymously();
      } else if (event === 'SIGNED_IN' && session) {
        setIsAuthenticated(true);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadAgents]);

  // Load agent details and threads when selected agent changes
  useEffect(() => {
    if (selectedAgent?.id) {
      loadAgentDetails(selectedAgent.id);
      // Reset thread selection when agent changes
      setCurrentThreadId(null);
      loadThreads();
    } else {
      setThreads([]);
      setCurrentThreadId(null);
    }
  }, [selectedAgent?.id, loadThreads]);

  // Handle backend type change
  const handleBackendChange = (newBackendType: BackendType) => {
    setBackendTypeState(newBackendType);
    setBackendType(newBackendType);
  };

  // Reload agents when backend changes
  useEffect(() => {
    if (isAuthenticated) {
      loadAgents();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backendType, isAuthenticated]);

  // Helper function to get auth headers
  const getAuthHeaders = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error('No valid session found. Please sign in.');
    }

    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    };
  };

  // Handle agent switching
  const handleAgentChange = (agentId: string) => {
    const agent = agents.find((a) => a.id === agentId);
    if (agent) {
      setSelectedAgent(agent);
      // Reset thread when switching agents
      setCurrentThreadId(null);
    }
  };

  // ChatKit configuration - use a generic agents endpoint and route dynamically
  const chatKitUrl = getChatKitUrl(backendType);

  const chatKitHook = useChatKit({
    onThreadChange: ({ threadId }) => {
      // Update thread ID when ChatKit changes it (e.g., when a new message creates a thread)
      setCurrentThreadId((prevThreadId) => {
        // Only update if threadId actually changed (avoid infinite loops)
        if (threadId !== prevThreadId) {
          // Reload threads when a new thread is created, but don't auto-select
          // since we're already on the new thread
          if (threadId) {
            setTimeout(() => {
              loadThreads(true); // Skip auto-selection since we're already on this thread
            }, 500);
          }
          return threadId;
        }
        return prevThreadId;
      });
    },
    onClientTool: async (invocation) => {
      if (invocation.name === "switch_theme") {
        const requested = invocation.params.theme;
        if (requested === "light" || requested === "dark") {
          if (import.meta.env.DEV) {
            console.debug("[Chat] switch_theme", requested);
          }
          setDarkMode(requested === "dark");
          console.log("onClientTool; returning success: true");
          return { success: true }; // TODO: do we need to return an id here?
        }
        console.log("onClientTool; returning success: false; case 1");
        return { success: false };
      }
      console.log("onClientTool; returning success: false; case 2");
      return { success: false };
    },
    api: {
      url: chatKitUrl,

      // Custom fetch with auth injection and dynamic agent routing
      async fetch(url: string, options: RequestInit) {
        const auth = await getAuthHeaders();

        // Route requests to the currently selected agent
        let targetUrl = url;
        if (selectedAgent && url.includes('/agents')) {
          targetUrl = url.replace('/agents', `/agents/${selectedAgent.id}/chatkit`);
        }

        const response = await fetch(targetUrl, {
          ...options,
          headers: {
            ...options.headers,
            ...auth,
          },
        });

        // Error handling (don't consume body for SSE streams)
        if (!response.ok && !response.headers.get('content-type')?.includes('text/event-stream')) {
          const errorText = await response.text();
          console.error('Fetch error:', errorText);
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        return response;
      },

      // Upload strategy for attachments - also route dynamically
      uploadStrategy: {
        type: 'direct',
        uploadUrl: selectedAgent
          ? `${getServerBaseUrl()}/agents/${selectedAgent.id}/chatkit/upload`
          : `${getServerBaseUrl()}/agents/chatkit/upload`,
      },

      // Domain key for security
      domainKey: 'domain_pk_68e5537e61b881908e1bbba95290d09c0e054864a95b3bbe',
    },
    composer: {
      placeholder: `Message your ${selectedAgent?.name} AI agent...`,
      // tools: [{ id: "rate", label: "Rate", icon: "star", pinned: true }],
    },
    history: {
      enabled: false, // Disable built-in history management
    },
    header: {
      enabled: false, // Disable built-in header to use our custom one
    },
    startScreen: {
      // greeting: selectedAgent ? `Welcome to Timestep AI! You're chatting with ${selectedAgent.name}` : "Welcome to Timestep AI!",
      // prompts: [
      //   {
      //     prompt: "How many R's are there in the word 'strawberry'?", label: "How many R's are there in the word 'strawberry'?"
      //   },
      //   {
      //     prompt: "What's the weather in Oakland and San Francisco?", label: "What's the weather in Oakland and San Francisco?"
      //   }
      // ]
    },
    theme: {
      colorScheme: darkMode ? 'dark' : 'light',
      color: { accent: { primary: '#D7263D', level: 2 } },
      radius: 'round',
      density: 'normal',
      typography: { fontFamily: 'Open Sans, sans-serif' },
    },
  });

  // Extract control and setThreadId from the hook
  const { control, setThreadId } = chatKitHook;

  // Handle thread switching
  const handleThreadChange = (threadId: string | null) => {
    // Just update state - the useEffect will handle calling setThreadId
    setCurrentThreadId(threadId);
  };

  // Handle creating a new thread
  const handleCreateNewThread = () => {
    // Just update state - the useEffect will handle calling setThreadId
    setCurrentThreadId(null);
    // Reload threads to get the new one when it's created, but skip auto-selection
    // so we don't automatically switch away from the new thread
    setTimeout(() => {
      loadThreads(true); // Skip auto-selection
    }, 1000);
  };

  // Set initial thread when component mounts or thread changes
  // Only call setThreadId when we have a valid thread ID (not null) or when explicitly setting to null for new thread
  useEffect(() => {
    if (setThreadId && currentThreadId !== undefined && selectedAgent) {
      // Only set thread ID if we have a valid thread ID or explicitly want to create a new thread
      setThreadId(currentThreadId);
    }
  }, [setThreadId, currentThreadId, selectedAgent]);

  if (!isAuthenticated || loadingAgents) {
    return (
      <IonPage>
        <IonContent className="ion-padding">
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
            }}
          >
            <IonSpinner name="crescent" />
            <p style={{ marginTop: '1rem' }}>
              {!isAuthenticated ? 'Initializing chat...' : 'Loading agents...'}
            </p>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <>
      <SidebarMenu
        ref={leftMenuRef}
        id="left-menu"
        side="start"
        title="Settings"
        color="primary"
        darkMode={darkMode}
        onDarkModeChange={setDarkMode}
        agentDetails={agentDetails}
        loadingAgentDetails={loadingAgentDetails}
      />

      <SidebarMenu
        ref={rightMenuRef}
        id="right-menu"
        side="end"
        title="Settings"
        color="primary"
        darkMode={darkMode}
        onDarkModeChange={setDarkMode}
        agentDetails={agentDetails}
        loadingAgentDetails={loadingAgentDetails}
      />

      <IonPage id="main-content">
        <IonHeader>
          <IonToolbar mode="ios">
            <IonButtons slot="start">
              <span style={{ marginRight: '8px', marginLeft: '16px', fontSize: '16px' }}>
                Agent:
              </span>
              <CombinedAgentSelector
                backendType={backendType}
                selectedAgent={selectedAgent}
                agents={agents}
                threads={threads}
                selectedThreadId={currentThreadId}
                loadingThreads={loadingThreads}
                onBackendChange={handleBackendChange}
                onAgentChange={handleAgentChange}
                onThreadChange={handleThreadChange}
                onCreateNewThread={handleCreateNewThread}
              />
            </IonButtons>
            <IonTitle>Timestep AI</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent fullscreen>
          <ChatKit control={control} className="h-full w-full" />
        </IonContent>
      </IonPage>
    </>
  );
};

export default Chat;
