import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
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
  IonIcon,
  IonSpinner,
  IonButton,
  IonButtons,
} from '@ionic/react';
import { menu, chatbubblesOutline, peopleOutline } from 'ionicons/icons';
import { ModernSidebar } from '@/components/ModernSidebar';
import type { ThemeSettings } from '@/components/SidebarMenu';

const Chat = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<AgentRecord | null>(null);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [threads, setThreads] = useState<any[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Theme settings state
  const [themeSettings, setThemeSettings] = useState<ThemeSettings>(() => {
    return {
      colorScheme: 'light' as const,
      accentColor: '#3B82F6',
      accentLevel: 2,
      radius: 'soft' as const,
      density: 'normal' as const,
      fontFamily: "'Inter', sans-serif"
    };
  });

  // Agent details state
  const [agentDetails, setAgentDetails] = useState<AgentRecord | null>(null);
  const [loadingAgentDetails, setLoadingAgentDetails] = useState(false);

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

      // Set initial agent from URL or first agent
      if (!selectedAgent) {
        const agentParam = searchParams.get('agent');
        const agent = agentParam 
          ? agentsData.find((a) => a.id === agentParam)
          : agentsData[0];
        
        if (agent) {
          setSelectedAgent(agent);
          // Update URL if no agent param exists
          if (!agentParam && agentsData.length > 0) {
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.set('agent', agent.id);
            window.history.replaceState({}, '', newUrl);
          }
        }
      }
    } catch (error) {
      console.error('Error loading agents:', error);
      toast.error('Failed to load agents');
    } finally {
      setLoadingAgents(false);
    }
  }, [searchParams, selectedAgent]);

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
      setSelectedAgent(agent);
      
      // Update URL to reflect agent change
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('agent', agent.id);
      window.history.pushState({}, '', newUrl);
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

      // Update URL
      const newUrl = new URL(window.location.href);
      if (targetId) {
        newUrl.searchParams.set('thread', targetId);
      } else {
        newUrl.searchParams.delete('thread');
      }
      window.history.pushState({}, '', newUrl);
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
      
      // Update URL to reflect current thread
      const newUrl = new URL(window.location.href);
      if (threadId) {
        newUrl.searchParams.set('thread', threadId);
      } else {
        newUrl.searchParams.delete('thread');
      }
      window.history.replaceState({}, '', newUrl);
      
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

  // Load thread from URL when ChatKit is ready
  useEffect(() => {
    const threadParam = searchParams.get('thread');
    
    if (isAuthenticated && selectedAgent && threadParam && setThreadId) {
      console.log('Loading thread from URL:', threadParam);
      setThreadId(threadParam);
      setCurrentThreadId(threadParam);
    }
  }, [isAuthenticated, selectedAgent, setThreadId, searchParams]);

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
      <ModernSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        agents={agents}
        selectedAgent={selectedAgent}
        onAgentChange={handleAgentChange}
        threads={threads}
        currentThreadId={currentThreadId}
        onThreadChange={handleSelectThread}
        themeSettings={themeSettings}
        onThemeChange={handleThemeChange}
        agentDetails={agentDetails}
        loadingAgentDetails={loadingAgentDetails}
      />

      <IonPage id="main-content">
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start">
              <IonButton onClick={() => setSidebarOpen(true)}>
                <IonIcon slot="icon-only" icon={menu} />
              </IonButton>
            </IonButtons>
            <IonTitle>{selectedAgent?.name || 'Timestep AI'}</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={() => navigate('/chats')}>
                <IonIcon slot="icon-only" icon={chatbubblesOutline} />
              </IonButton>
              <IonButton onClick={() => navigate('/agents')}>
                <IonIcon slot="icon-only" icon={peopleOutline} />
              </IonButton>
            </IonButtons>
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
