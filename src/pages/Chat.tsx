import { useEffect, useState, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { ChatKit, useChatKit } from '@openai/chatkit-react';
import { agentsService } from '@/services/agentsService';
import type { AgentRecord } from '@/types/agent';
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
import { personCircleOutline, chatbubblesOutline, addOutline, cogOutline } from 'ionicons/icons';
import SidebarMenu, { type ThemeSettings } from '@/components/SidebarMenu';

const Chat = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<AgentRecord | null>(null);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [threads, setThreads] = useState<any[]>([]);
  const [showThreads, setShowThreads] = useState(false);

  // Theme settings state
  const [themeSettings, setThemeSettings] = useState<ThemeSettings>(() => {
    const saved = localStorage.getItem('chatkitTheme');
    return saved ? JSON.parse(saved) : {
      colorScheme: 'dark' as const,
      accentColor: '#D7263D',
      accentLevel: 2,
      radius: 'round' as const,
      density: 'normal' as const,
      fontFamily: "'Open Sans', sans-serif"
    };
  });

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

      // Only set initial agent on first load
      if (!selectedAgent) {
        const savedAgentId = localStorage.getItem('selectedAgentId');
        const savedAgent = savedAgentId ? agentsData.find((a) => a.id === savedAgentId) : null;

        if (savedAgent) {
          setSelectedAgent(savedAgent);
        } else if (agentsData.length > 0) {
          setSelectedAgent(agentsData[0]);
        }
      }
    } catch (error) {
      console.error('Error loading agents:', error);
      toast.error('Failed to load agents');
    } finally {
      setLoadingAgents(false);
    }
  }, []); // Remove selectedAgent from dependencies

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

  // Handle theme changes
  const handleThemeChange = (updates: Partial<ThemeSettings>) => {
    const newSettings = { ...themeSettings, ...updates };
    setThemeSettings(newSettings);
    localStorage.setItem('chatkitTheme', JSON.stringify(newSettings));
  };

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
      console.log('Switching to agent:', agent.name, 'ID:', agent.id);
      const preservedThreadId = currentThreadId;
      setSelectedAgent(agent);
      localStorage.setItem('selectedAgentId', agent.id);
      if (preservedThreadId) {
        localStorage.setItem('currentThreadId', preservedThreadId);
      }
    }
  };

  // Create a new thread
  const handleCreateThread = async () => {
    if (!setThreadId) return;
    
    try {
      await setThreadId(null);
      setCurrentThreadId(null);
      toast.success('New thread started');
    } catch (error) {
      console.error('Error creating thread:', error);
      toast.error('Failed to create thread');
    }
  };

  // Switch to a different thread  
  const handleSelectThread = async (threadId: string) => {
    if (!setThreadId) return;
    
    try {
      const targetId: string | null = threadId && threadId.length > 0 ? threadId : null;
      await setThreadId(targetId);
      setCurrentThreadId(targetId);

      if (targetId) {
        localStorage.setItem('currentThreadId', targetId);
      } else {
        localStorage.removeItem('currentThreadId');
      }
    } catch (error) {
      console.error('Error switching thread:', error);
      toast.error('Failed to switch thread');
    }
  };

  // ChatKit configuration - use a generic agents endpoint and route dynamically
  const chatKitUrl = `${getServerBaseUrl()}/agents`;
  const selectedAgentRef = useRef(selectedAgent);
  
  // Keep ref updated without triggering re-renders
  useEffect(() => {
    selectedAgentRef.current = selectedAgent;
  }, [selectedAgent]);

  console.log('ChatKit URL:', chatKitUrl, 'Selected Agent:', selectedAgent?.name);

  const { control, setThreadId } = useChatKit({
    onThreadChange: ({ threadId }) => {
      console.log('Thread changed:', threadId);
      setCurrentThreadId(threadId);
      if (threadId) localStorage.setItem('currentThreadId', threadId);
      else localStorage.removeItem('currentThreadId');
      loadThreads();
    },
    api: {
      url: chatKitUrl,

      // Custom fetch with auth injection and dynamic agent routing
      async fetch(url: string, options: RequestInit) {
        const auth = await getAuthHeaders();
        const currentAgent = selectedAgentRef.current;

        // Route requests to the currently selected agent
        let targetUrl = url;
        if (currentAgent && url.includes('/agents')) {
          // Replace the generic /agents endpoint with the specific agent endpoint
          targetUrl = url.replace('/agents', `/agents/${currentAgent.id}/chatkit`);
          console.log('Routing request to agent:', currentAgent.name, 'URL:', targetUrl);
        }

        return fetch(targetUrl, {
          ...options,
          headers: {
            ...options.headers,
            ...auth,
          },
        });
      },

      // Upload strategy for attachments - use generic endpoint
      uploadStrategy: {
        type: 'direct',
        uploadUrl: `${getServerBaseUrl()}/agents/chatkit/upload`,
      },

      // Domain key for security
      domainKey: 'localhost-dev',
    },
    composer: {
      placeholder: 'Message your AI agent...',
    },
    header: { enabled: false },
    history: { enabled: false },
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
      colorScheme: themeSettings.colorScheme,
      color: { accent: { primary: themeSettings.accentColor, level: themeSettings.accentLevel } },
      radius: themeSettings.radius,
      density: themeSettings.density,
      typography: { fontFamily: themeSettings.fontFamily },
    },
  });

  // Restore saved thread when available (after ChatKit is ready)
  useEffect(() => {
    const saved = localStorage.getItem('currentThreadId');
    if (isAuthenticated && selectedAgent && saved) {
      setThreadId(saved);
      setCurrentThreadId(saved);
    }
  }, [isAuthenticated, selectedAgent, setThreadId]);

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
        agentDetails={agentDetails}
        loadingAgentDetails={loadingAgentDetails}
        themeSettings={themeSettings}
        onThemeChange={handleThemeChange}
        agents={agents}
        selectedAgent={selectedAgent}
        onAgentChange={handleAgentChange}
        threads={threads}
        currentThreadId={currentThreadId}
        onThreadChange={handleSelectThread}
      />

      <SidebarMenu
        ref={rightMenuRef}
        id="right-menu"
        side="end"
        title="Settings"
        color="primary"
        agentDetails={agentDetails}
        loadingAgentDetails={loadingAgentDetails}
        themeSettings={themeSettings}
        onThemeChange={handleThemeChange}
      />

      <IonPage id="main-content">
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start">
              <IonButton onClick={() => leftMenuRef.current?.open()}>
                <IonIcon slot="icon-only" icon={cogOutline} />
              </IonButton>
            </IonButtons>
            <IonTitle className="ion-text-center">Agent: {selectedAgent?.id ?? 'none'} | Thread: {currentThreadId ?? 'new'}</IonTitle>
          </IonToolbar>
        </IonHeader>
        
        <IonContent fullscreen>
          {control ? (
            <ChatKit control={control} className="h-full w-full" />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <IonSpinner name="crescent" />
            </div>
          )}
        </IonContent>
      </IonPage>
    </>
  );
};

export default Chat;
