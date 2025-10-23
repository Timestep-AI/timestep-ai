import { useEffect, useState, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { ChatKit, useChatKit } from '@openai/chatkit-react';
import { agentsService } from '@/services/agentsService';
import type { AgentRecord } from '../../supabase/functions/agent-chat/stores/agents_store';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonSelect,
  IonSelectOption,
  IonIcon,
  IonSpinner,
  IonButtons,
  IonButton,
  IonList,
  IonItem,
  IonLabel,
  IonPopover,
} from '@ionic/react';
import { personCircleOutline, chatbubblesOutline, addOutline } from 'ionicons/icons';
import SidebarMenu from '@/components/SidebarMenu';

const Chat = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<AgentRecord | null>(null);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [threads, setThreads] = useState<any[]>([]);
  const [showThreads, setShowThreads] = useState(false);

  // Settings state
  const [darkMode, setDarkMode] = useState(true);

  // Agent details state
  const [agentDetails, setAgentDetails] = useState<AgentRecord | null>(null);
  const [loadingAgentDetails, setLoadingAgentDetails] = useState(false);

  // Menu refs
  const leftMenuRef = useRef<HTMLIonMenuElement>(null);
  const rightMenuRef = useRef<HTMLIonMenuElement>(null);

  // Get server base URL
  const getServerBaseUrl = () => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
    return `${supabaseUrl}/functions/v1/agent-chat`;
  };

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
  }, [selectedAgent]);

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

  // Load all threads for the current user
  const loadThreads = useCallback(async () => {
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(
        `${getServerBaseUrl()}/agents/${selectedAgent?.id || '00000000-0000-0000-0000-000000000000'}/chatkit`,
        {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            type: 'threads.list',
            params: { limit: 50, order: 'desc' }
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        setThreads(data.data || []);
        
        // Auto-select the most recent thread if no thread is selected
        if (data.data && data.data.length > 0 && !currentThreadId) {
          const mostRecentThread = data.data[0];
          console.log('Loading most recent thread:', mostRecentThread.id);
          setCurrentThreadId(mostRecentThread.id);
        }
      }
    } catch (error) {
      console.error('Error loading threads:', error);
    }
  }, [selectedAgent, currentThreadId]);

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

  // Load agent details when selected agent changes
  useEffect(() => {
    if (selectedAgent?.id) {
      loadAgentDetails(selectedAgent.id);
    }
  }, [selectedAgent?.id]);

  // Load threads when agent is selected
  useEffect(() => {
    if (selectedAgent && isAuthenticated) {
      loadThreads();
    }
  }, [selectedAgent, isAuthenticated, loadThreads]);

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
  const handleAgentChange = (e: CustomEvent) => {
    const agentId = e.detail.value;
    const agent = agents.find((a) => a.id === agentId);
    if (agent) {
      console.log('Switching to agent:', agent.name, 'ID:', agent.id);
      setSelectedAgent(agent);
      toast.success(`Switched to ${agent.name}`);
    }
  };

  // Create a new thread
  const handleCreateThread = async () => {
    try {
      // Clear current thread to start fresh
      setCurrentThreadId(null);
      toast.success('New thread started');
    } catch (error) {
      console.error('Error creating thread:', error);
      toast.error('Failed to create thread');
    }
  };

  // Switch to a different thread
  const handleSelectThread = async (threadId: string) => {
    try {
      setCurrentThreadId(threadId);
      setShowThreads(false);
      
      // Force ChatKit to reload with the new thread
      window.location.reload();
    } catch (error) {
      console.error('Error switching thread:', error);
      toast.error('Failed to switch thread');
    }
  };

  // ChatKit configuration - use a generic agents endpoint and route dynamically
  const chatKitUrl = `${getServerBaseUrl()}/agents`;
  console.log('ChatKit URL:', chatKitUrl, 'Selected Agent:', selectedAgent?.name);

  const { control } = useChatKit({
    onThreadChange: ({ threadId }) => {
      console.log('Thread changed:', threadId);
      setCurrentThreadId(threadId);
      loadThreads();
    },
    api: {
      url: chatKitUrl,

      // Custom fetch with auth injection and dynamic agent routing
      async fetch(url: string, options: RequestInit) {
        const auth = await getAuthHeaders();

        // Route requests to the currently selected agent
        let targetUrl = url;
        if (selectedAgent && url.includes('/agents')) {
          // Replace the generic /agents endpoint with the specific agent endpoint
          targetUrl = url.replace('/agents', `/agents/${selectedAgent.id}/chatkit`);
          console.log('Routing request to agent:', selectedAgent.name, 'URL:', targetUrl);
        }

        return fetch(targetUrl, {
          ...options,
          headers: {
            ...options.headers,
            ...auth,
          },
        });
      },

      // Upload strategy for attachments - also route dynamically
      uploadStrategy: {
        type: 'direct',
        uploadUrl: selectedAgent
          ? `${getServerBaseUrl()}/agents/${selectedAgent.id}/chatkit/upload`
          : `${getServerBaseUrl()}/agents/chatkit/upload`,
      },

      // Domain key for security
      domainKey: 'localhost-dev',
    },
    composer: {
      placeholder: `Message your ${selectedAgent?.name} AI agent...`,
      // tools: [{ id: "rate", label: "Rate", icon: "star", pinned: true }],
    },
    header: null,
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

  console.log('ChatKit: Control object:', control);

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
          <IonToolbar>
            <IonTitle>Timestep AI</IonTitle>
            <IonButtons slot="start">
              <IonButton id="threads-trigger">
                <IonIcon slot="icon-only" icon={chatbubblesOutline} />
              </IonButton>
              <IonButton onClick={handleCreateThread}>
                <IonIcon slot="icon-only" icon={addOutline} />
              </IonButton>
            </IonButtons>
            <IonButtons slot="end">
              <IonIcon
                icon={personCircleOutline}
                style={{ fontSize: '24px', marginRight: '8px' }}
              />
              <IonSelect
                value={selectedAgent?.id || ''}
                placeholder="Select Agent"
                onIonChange={handleAgentChange}
                interface="popover"
              >
                {agents.map((agent) => (
                  <IonSelectOption key={agent.id} value={agent.id}>
                    {agent.name}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        
        <IonPopover trigger="threads-trigger" dismissOnSelect={true}>
          <IonContent>
            <IonList>
              {threads.length === 0 ? (
                <IonItem>
                  <IonLabel>No threads yet</IonLabel>
                </IonItem>
              ) : (
                threads.map((thread) => (
                  <IonItem
                    key={thread.id}
                    button
                    onClick={() => handleSelectThread(thread.id)}
                    color={thread.id === currentThreadId ? 'primary' : undefined}
                  >
                    <IonLabel>
                      <h3>{thread.metadata?.title || 'Untitled Thread'}</h3>
                      <p>{new Date(thread.created_at * 1000).toLocaleString()}</p>
                    </IonLabel>
                  </IonItem>
                ))
              )}
            </IonList>
          </IonContent>
        </IonPopover>

        <IonContent fullscreen>
          <ChatKit control={control} className="h-full w-full" />
        </IonContent>
      </IonPage>
    </>
  );
};

export default Chat;
